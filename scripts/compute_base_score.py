"""
scripts/compute_base_score.py
==============================
disclosure_insights 의 AI 분석 결과로 BaseScore / FinalScore 계산.

계산 공식:
  s   = ((sentiment_score + 1) / 2) * 40            # 0~40  (감성 컴포넌트)
  i   = (short_term_impact_score / 5) * 30           # 0~30  (중요도 컴포넌트)
  e   = min(max((avg_5d_return + 3) / 6 * 30, 0), 30) # 0~30 (이벤트 수익률 컴포넌트)

  base_score_raw = s + i + e                          # 0~100 (정규화 전)
  base_score     = sigmoid((raw - 50) / 10) * 100     # sigmoid 정규화 (0~100)

  lps            = loan_stats 에서 조회 (rcept_dt 기준 당일 또는 최근일)
  loan_weight    = min(lps / 100, 0.4)               # 최대 40% 패널티
  final_score    = base_score * (1 - loan_weight)    # 0~100

시그널 태그:
  "⚠️ Smart Money Selling" : LPS ≥ 70 AND base_score ≥ 60
  "🔥 Short Covering + Momentum": LPS ≤ 20 AND base_score ≥ 70
  "❌ High Risk Zone"       : LPS ≥ 80 AND base_score ≤ 40

사전 조건:
  - auto_analyst.py 가 완료되어 sentiment_score, short_term_impact_score, event_type 이 채워져 있어야 함
  - compute_loan_pressure.py 가 완료되어 loan_stats.lps 가 채워져 있어야 함

사용법:
  python scripts/compute_base_score.py             # 전체 미계산 처리
  python scripts/compute_base_score.py --dry-run   # DB 저장 없이 결과 출력
  python scripts/compute_base_score.py --recompute # base_score 가 있어도 재계산
"""

import asyncio
import json
import os
import sys
import math
import argparse
from datetime import datetime, timedelta
from pathlib import Path

try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

# ── 설정 ──────────────────────────────────────────────────────────────────────

BATCH_SIZE = 100
# LPS 조회 시 rcept_dt 전후 허용 범위 (영업일 미일치 보정)
LPS_DATE_TOLERANCE_DAYS = 5


# ── 수학 헬퍼 ─────────────────────────────────────────────────────────────────

def sigmoid(x: float) -> float:
    x = max(-500.0, min(500.0, x))
    return 1.0 / (1.0 + math.exp(-x))


# ── 스코어 계산 함수 ──────────────────────────────────────────────────────────

def compute_s(sentiment_score: float | None) -> float:
    """감성 컴포넌트: 0~40"""
    if sentiment_score is None:
        return 20.0   # 중립 fallback
    s = ((float(sentiment_score) + 1.0) / 2.0) * 40.0
    return max(0.0, min(40.0, s))


def compute_i(short_term_impact_score: int | None) -> float:
    """중요도 컴포넌트: 0~30"""
    if short_term_impact_score is None:
        return 15.0   # 중립 fallback (3/5)
    i = (int(short_term_impact_score) / 5.0) * 30.0
    return max(0.0, min(30.0, i))


def compute_e(avg_5d_return: float | None, sample_size: int | None) -> float:
    """
    이벤트 수익률 컴포넌트: 0~30
    sample_size < 30 이면 통계 불신뢰 → 0 반환
    """
    if avg_5d_return is None or (sample_size is not None and sample_size < 30):
        return 0.0
    e = (float(avg_5d_return) + 3.0) / 6.0 * 30.0
    return max(0.0, min(30.0, e))


def compute_base_score(s: float, i: float, e: float) -> tuple[float, float]:
    """(base_score_raw, base_score) 반환"""
    raw = s + i + e                              # 0~100
    normalized = sigmoid((raw - 50.0) / 10.0) * 100.0
    return round(raw, 4), round(normalized, 4)


def compute_reliability(key_numbers: object) -> float:
    """
    Reliability multiplier: key_numbers 개수 기반 (0.5~1.0).
    key_numbers 가 없거나 파싱 실패 시 0.5 (패널티 없음 대신 최소 신뢰도).
    """
    try:
        if not key_numbers:
            return 0.5
        parsed = json.loads(key_numbers) if isinstance(key_numbers, str) else key_numbers
        n = len(parsed) if isinstance(parsed, (list, dict)) else 0
        return min(1.0, 0.5 + n * 0.1)
    except Exception:
        return 0.5


def compute_final_score(base_score: float, lps: float | None, reliability: float = 1.0) -> float:
    """FinalScore = base_score * (1 - min(LPS/100, 0.4)) * reliability"""
    if lps is None:
        lps = 0.0   # LPS 데이터 없으면 패널티 없음 (대차 데이터 수집 중단 2026-04-20)
    loan_weight = min(float(lps) / 100.0, 0.4)
    final = base_score * (1.0 - loan_weight) * reliability
    return round(max(0.0, min(100.0, final)), 4)


def compute_signal_tag(base_score: float, lps: float | None) -> str | None:
    """시그널 태그 결정"""
    if lps is None:
        return None
    if lps >= 80 and base_score <= 40:
        return "❌ High Risk Zone"
    if lps >= 70 and base_score >= 60:
        return "⚠️ Smart Money Selling"
    if lps <= 20 and base_score >= 70:
        return "🔥 Short Covering + Momentum"
    return None


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지 미설치. pip install supabase")
        sys.exit(1)

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락")
        sys.exit(1)

    return create_client(url, key)


def load_event_stats(sb) -> dict[str, dict]:
    """
    event_stats 전체 로드 → {event_type: {avg_5d_return, sample_size}} dict.
    """
    resp = sb.table("event_stats").select("event_type, avg_5d_return, sample_size").execute()
    result: dict[str, dict] = {}
    for row in (resp.data or []):
        result[row["event_type"]] = {
            "avg_5d_return": row.get("avg_5d_return"),
            "sample_size":   row.get("sample_size"),
        }
    return result


def fetch_unscored(sb, recompute: bool) -> list[dict]:
    """
    base_score 가 null 인 공시 (또는 recompute=True 이면 전체) 조회.
    sentiment_score IS NOT NULL + analysis_status = 'completed' 조건 포함.
    """
    query = (
        sb.table("disclosure_insights")
        .select(
            "id, stock_code, rcept_dt, "
            "sentiment_score, short_term_impact_score, event_type, key_numbers"
        )
        .eq("analysis_status", "completed")
        .not_.is_("sentiment_score", "null")
    )

    if not recompute:
        query = query.is_("base_score", "null")

    resp = query.order("rcept_dt", desc=True).limit(2000).execute()
    return resp.data or []


def fetch_lps_for_disclosures(sb, rows: list[dict]) -> dict[tuple[str, str], float | None]:
    """
    각 공시의 (stock_code, rcept_dt) 에 해당하는 LPS 조회.
    rcept_dt(YYYYMMDD TEXT) → date(YYYY-MM-DD) 변환 후 loan_stats 검색.
    당일 데이터가 없으면 LPS_DATE_TOLERANCE_DAYS 이내의 최근 데이터 사용.

    반환: {(stock_code, rcept_dt): lps_float_or_None}
    """
    # 조회할 (stock_code, date) 집합 수집
    pairs: dict[tuple[str, str], str] = {}   # (code, rcept_dt_str) → iso_date
    for row in rows:
        code = row.get("stock_code")
        rdt  = row.get("rcept_dt")
        if not code or not rdt:
            continue
        try:
            iso = str(datetime.strptime(str(rdt), "%Y%m%d").date())
        except ValueError:
            continue
        pairs[(code, str(rdt))] = iso

    if not pairs:
        return {}

    stock_codes = list({k[0] for k in pairs})
    iso_dates   = list(set(pairs.values()))
    # 여유 날짜 범위 추가
    dt_min = min(datetime.strptime(d, "%Y-%m-%d").date() for d in iso_dates) - timedelta(days=LPS_DATE_TOLERANCE_DAYS)
    dt_max = max(datetime.strptime(d, "%Y-%m-%d").date() for d in iso_dates)

    # loan_stats 에서 범위 조회
    chunk = 500
    all_lps: list[dict] = []
    for i in range(0, len(stock_codes), chunk):
        batch = stock_codes[i:i + chunk]
        resp = (
            sb.table("loan_stats")
            .select("stock_code, date, lps")
            .in_("stock_code", batch)
            .gte("date", str(dt_min))
            .lte("date", str(dt_max))
            .not_.is_("lps", "null")
            .execute()
        )
        all_lps.extend(resp.data or [])

    # stock_code → sorted (date, lps) 리스트
    from collections import defaultdict
    lps_by_code: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for r in all_lps:
        if r.get("lps") is not None:
            lps_by_code[r["stock_code"]].append((r["date"], float(r["lps"])))
    for code in lps_by_code:
        lps_by_code[code].sort(key=lambda x: x[0])

    # 각 (code, rcept_dt) 에 가장 가까운 LPS 매핑
    result: dict[tuple[str, str], float | None] = {}
    for (code, rdt_str), iso in pairs.items():
        entries = lps_by_code.get(code, [])
        if not entries:
            result[(code, rdt_str)] = None
            continue
        # iso 이하 최신 날짜 찾기 (앞으로 탐색)
        best_lps = None
        for dt_str, lps_val in reversed(entries):
            if dt_str <= iso:
                delta = (datetime.strptime(iso, "%Y-%m-%d").date() -
                         datetime.strptime(dt_str, "%Y-%m-%d").date()).days
                if delta <= LPS_DATE_TOLERANCE_DAYS:
                    best_lps = lps_val
                break
        result[(code, rdt_str)] = best_lps

    return result


def save_insights(sb, updates: list[dict], dry_run: bool) -> tuple[int, int]:
    """disclosure_insights 에 스코어 업데이트"""
    if dry_run:
        print(f"  [DRY-RUN] {len(updates)}건 (저장 안함)")
        for r in updates[:5]:
            print(f"    {r['id'][:8]}... bs_raw={r['base_score_raw']:.1f} "
                  f"bs={r['base_score']:.1f} fs={r['final_score']:.1f} "
                  f"tag={r.get('signal_tag') or '-'}")
        return len(updates), 0

    success = failure = 0
    for row in updates:
        row_id = row.pop("id")
        try:
            sb.table("disclosure_insights").update(row).eq("id", row_id).execute()
            success += 1
        except Exception as e:
            failure += 1
            print(f"  [ERROR] id={row_id[:8]}... 업데이트 실패: {e}")
        row["id"] = row_id   # 복원 (scores_log 에서 사용)

    return success, failure


def save_scores_log(sb, log_rows: list[dict], dry_run: bool) -> tuple[int, int]:
    """scores_log 테이블 upsert"""
    if dry_run:
        return len(log_rows), 0

    success = failure = 0
    for i in range(0, len(log_rows), BATCH_SIZE):
        batch = log_rows[i:i + BATCH_SIZE]
        bn = i // BATCH_SIZE + 1
        try:
            sb.table("scores_log").upsert(
                batch, on_conflict="stock_code,date,disclosure_id"
            ).execute()
            success += len(batch)
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] scores_log Batch {bn} 실패: {e}")

    return success, failure


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BaseScore / FinalScore 계산")
    parser.add_argument("--dry-run",   action="store_true", help="DB 저장 없이 결과 출력")
    parser.add_argument("--recompute", action="store_true", help="이미 계산된 항목도 재계산")
    args = parser.parse_args()

    print("=" * 60)
    print("BaseScore / FinalScore 계산")
    print(f"  모드: {'DRY-RUN' if args.dry_run else '실제 저장'}"
          + (" + 재계산" if args.recompute else ""))
    print("=" * 60)

    sb = _get_supabase()

    # 1. event_stats 로드
    print("\n  [1/5] event_stats 로드 중...")
    event_stats = load_event_stats(sb)
    print(f"  → {len(event_stats)}개 이벤트 유형 로드")
    if not event_stats:
        print("  [WARN] event_stats 가 비어 있습니다. e 컴포넌트는 모두 0으로 처리됩니다.")

    # 2. 미계산 공시 조회
    print("\n  [2/5] 미계산 공시 조회 중...")
    rows = fetch_unscored(sb, args.recompute)
    if not rows:
        print("  계산할 공시가 없습니다.")
        sys.exit(0)
    print(f"  → {len(rows)}건")

    # 3. LPS 조회
    print("\n  [3/5] LPS 데이터 조회 중...")
    lps_map = fetch_lps_for_disclosures(sb, rows)
    lps_found = sum(1 for v in lps_map.values() if v is not None)
    print(f"  → LPS 매핑: {lps_found}/{len(rows)}건")

    # 4. 스코어 계산
    print("\n  [4/5] 스코어 계산 중...")
    insight_updates: list[dict] = []
    log_rows:        list[dict] = []

    for row in rows:
        code  = row.get("stock_code") or ""
        rdt   = str(row.get("rcept_dt") or "")
        try:
            iso_date = str(datetime.strptime(rdt, "%Y%m%d").date())
        except ValueError:
            iso_date = rdt

        # event_stats 조회
        ev_key = str(row.get("event_type") or "").upper()
        ev_info = event_stats.get(ev_key, {})

        s   = compute_s(row.get("sentiment_score"))
        i_  = compute_i(row.get("short_term_impact_score"))
        e   = compute_e(ev_info.get("avg_5d_return"), ev_info.get("sample_size"))
        raw, bs = compute_base_score(s, i_, e)

        lps         = lps_map.get((code, rdt))
        reliability = compute_reliability(row.get("key_numbers"))
        fs  = compute_final_score(bs, lps, reliability)
        tag = compute_signal_tag(bs, lps)

        insight_updates.append({
            "id":             row["id"],
            "base_score_raw": raw,
            "base_score":     bs,
            "final_score":    fs,
            "signal_tag":     tag,
        })

        log_rows.append({
            "stock_code":    code,
            "date":          iso_date,
            "disclosure_id": row["id"],
            "base_score_raw": raw,
            "base_score":    bs,
            "lps":           lps,
            "final_score":   fs,
            "signal_tag":    tag,
        })

    # 통계
    bs_vals  = [r["base_score"]  for r in insight_updates]
    fs_vals  = [r["final_score"] for r in insight_updates]
    tag_cnt  = sum(1 for r in insight_updates if r.get("signal_tag"))
    print(f"  BaseScore : min={min(bs_vals):.1f}  max={max(bs_vals):.1f}  avg={sum(bs_vals)/len(bs_vals):.1f}")
    print(f"  FinalScore: min={min(fs_vals):.1f}  max={max(fs_vals):.1f}  avg={sum(fs_vals)/len(fs_vals):.1f}")
    print(f"  시그널 태그: {tag_cnt}건")

    # 5. 저장
    print(f"\n  [5/5] Supabase 저장 중...")
    ins_ok, ins_fail = save_insights(sb, insight_updates, args.dry_run)
    log_ok, log_fail = save_scores_log(sb, log_rows, args.dry_run)

    print("=" * 60)
    print(f"완료: disclosure_insights {ins_ok}건 저장 / {ins_fail}건 실패")
    print(f"      scores_log          {log_ok}건 저장 / {log_fail}건 실패")
    print("=" * 60)

    # 6. 캐시 무효화 — 스코어가 갱신된 종목의 공시 목록 캐시 삭제
    if not args.dry_run and ins_ok > 0:
        try:
            sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
            from backend.core.cache import cache_delete_pattern
            deleted = asyncio.run(cache_delete_pattern("v1:disclosures:*"))
            print(f"[cache] 무효화 완료: v1:disclosures:* ({deleted}개 삭제)")
        except Exception as e:
            print(f"[cache] 무효화 실패 (무시): {e}")

    sys.exit(0 if (ins_fail + log_fail) == 0 else 1)


if __name__ == "__main__":
    main()
