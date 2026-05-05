"""
scripts/compute_base_score.py
==============================
disclosure_insights 의 AI 분석 결과로 BaseScore / FinalScore 계산.

계산 공식:
  s   = ((sentiment_score + 1) / 2) * 40            # 0~40  (감성 컴포넌트)
  i   = (short_term_impact_score / 5) * 30           # 0~30  (중요도 컴포넌트)
  e   = (z_clipped + 3) / 6 * 30                       # 0~30 (이벤트 강도 컴포넌트, Z-score 기반)
  # ※ z = clip(open_return_z, -3, +3), entry=D+1 open, exit=D+5 close
  #    n < 30: 중립(15), 30~99: 부분 적용, ≥100: 완전 적용

  base_score_raw = s + i + e                          # 0~100 (정규화 전)
  base_score     = clamp(raw, 0, 100)                 # 선형 (sigmoid 제거 — 40raw→27 압축 비직관적)

  lps            = loan_stats 에서 조회 (rcept_dt 기준 당일 또는 최근일)
  loan_weight    = min(lps / 100, 0.4)               # 최대 40% 패널티
  final_score    = base_score * (1 - loan_weight)    # 0~100

시그널 태그 (2026-04-20 재설계 — LPS 수집 중단으로 event_type + sentiment 기반으로 전환):
  부정 우선:
    "⚖️ Legal Alert"    : event_type = LEGAL
    "⚠️ Dilution Risk"  : event_type = DILUTION AND sentiment ≤ -0.2
    "📉 Earnings Miss"  : event_type = EARNINGS AND sentiment ≤ -0.4 AND base_score ≤ 45
  고신뢰 긍정:
    "🔥 High Conviction": base_score ≥ 63 AND sentiment ≥ 0.5
    "🚀 Earnings Beat"  : event_type = EARNINGS AND sentiment ≥ 0.5 AND base_score ≥ 59
    "📋 Major Contract" : event_type = CONTRACT AND sentiment ≥ 0.4 AND base_score ≥ 59
    "🔄 Buyback Signal" : event_type = BUYBACK  AND sentiment ≥ 0.3 AND base_score ≥ 55
    "🤝 M&A Activity"   : event_type = MNA      AND sentiment ≥ 0.35 AND base_score ≥ 56
  전반 하방:
    "⛔ High Risk"       : base_score ≤ 40 AND sentiment ≤ -0.5

사전 조건:
  - auto_analyst.py 가 완료되어 sentiment_score, short_term_impact_score, event_type 이 채워져 있어야 함

사용법:
  python scripts/compute_base_score.py             # 전체 미계산 처리
  python scripts/compute_base_score.py --dry-run   # DB 저장 없이 결과 출력
  python scripts/compute_base_score.py --recompute # base_score 가 있어도 재계산
"""

import asyncio
import json
import os
import sys
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
    이벤트 수익률 컴포넌트: 0~30  (레거시 — Z-score 데이터 없을 때 fallback)
      sample_size <  10 : 통계 불충분 → 중립(15) 반환
      sample_size 10~29 : 부분 신뢰도 적용 (중립 15 기준으로 scale)
      sample_size >= 30 : 완전 가중치
    """
    if avg_5d_return is None:
        return 15.0   # 데이터 없으면 중립
    n = int(sample_size) if sample_size is not None else 0
    if n < 10:
        return 15.0   # 샘플 부족 → 중립
    e_full = (float(avg_5d_return) + 3.0) / 6.0 * 30.0
    e_full = max(0.0, min(30.0, e_full))
    if n < 30:
        # 신뢰도 부분: 중립(15)에서 e_full 방향으로 선형 보간
        confidence = 0.5 + 0.5 * (n - 10) / 20.0   # 10→0.5, 29→0.975
        return round(15.0 + (e_full - 15.0) * confidence, 4)
    return round(e_full, 4)


def compute_e_zscore(z_score: float | None, sample_size: int | None) -> float:
    """
    시총 버킷 Z-score 기반 E 컴포넌트: 0~30 (중립=15)

    Z-score = (이벤트유형 open평균수익률 - 버킷시장open평균) / 버킷시장open표준편차
    스펙 (절대 고정):
      z_clipped = clip(z, -3, +3)
      E = (z_clipped + 3) / 6 * 30
      z = -3 → E = 0   (매우 부정)
      z =  0 → E = 15  (중립)
      z = +3 → E = 30  (매우 긍정)

    샘플 기준 (스펙 §8.4):
      n < 30  : 통계 신뢰 불가 → 중립(15) 반환
      30~99   : 약한 신호 — 중립 방향 부분 수렴
      100+    : 완전 적용
    """
    if z_score is None:
        return 15.0
    n = int(sample_size) if sample_size is not None else 0
    if n < 30:
        return 15.0   # 스펙: n<30 신뢰 불가
    z      = max(-3.0, min(3.0, float(z_score)))
    e_full = (z + 3.0) / 6.0 * 30.0   # [-3, +3] → [0, 30]
    if n < 100:
        # 약한 신호 구간: 중립(15)에서 e_full 방향 선형 보간
        confidence = (n - 30) / 70.0   # 30→0.0, 100→1.0
        return round(15.0 + (e_full - 15.0) * confidence, 4)
    return round(e_full, 4)


def compute_base_score(s: float, i: float, e: float) -> tuple[float, float]:
    """
    (base_score_raw, base_score) 반환.

    선형 정규화: base_score = clamp(raw, 0, 100)
    (구: sigmoid 정규화 — 40점 raw → 26.8점 압축 등 비직관적 왜곡으로 제거)
    """
    raw = s + i + e                              # 0~100
    normalized = max(0.0, min(100.0, raw))       # 선형: raw 그대로 사용
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


def compute_signal_tag(
    base_score: float,
    lps: float | None,                    # 하위 호환 유지 (현재 미사용)
    event_type: str | None = None,
    sentiment_score: float | None = None,
) -> str | None:
    """
    시그널 태그 결정.
    LPS 데이터 수집 중단(2026-04-20) 이후 event_type + sentiment_score + base_score 기반으로 재설계.

    우선순위 (앞에서 먼저 매칭):
      1. 부정 이벤트 (event_type 확정적)
      2. 고신뢰 긍정 시그널 (base_score × sentiment 조합)
      3. 전반적 하방 위험 (catchall)
    """
    et = str(event_type or "").upper()
    ss = float(sentiment_score) if sentiment_score is not None else 0.0
    bs = float(base_score)

    # ── 1순위: 부정 이벤트 ────────────────────────────────────────────────────
    if et == "LEGAL":
        return "⚖️ Legal Alert"

    if et == "DILUTION" and ss <= -0.2:
        return "⚠️ Dilution Risk"

    if et == "EARNINGS" and ss <= -0.4 and bs <= 48:
        return "📉 Earnings Miss"

    # ── 2순위: 고신뢰 긍정 시그널 ────────────────────────────────────────────
    # 임계값: sigmoid 등가 raw 값으로 재보정 (선형 정규화 전환에 따른 조정)
    if bs >= 63 and ss >= 0.5:
        return "🔥 High Conviction"

    if et == "EARNINGS" and ss >= 0.5 and bs >= 59:
        return "🚀 Earnings Beat"

    if et == "CONTRACT" and ss >= 0.4 and bs >= 59:
        return "📋 Major Contract"

    if et == "BUYBACK" and ss >= 0.3 and bs >= 55:
        return "🔄 Buyback Signal"

    if et == "MNA" and ss >= 0.35 and bs >= 56:
        return "🤝 M&A Activity"

    # ── 3순위: 전반적 하방 위험 ──────────────────────────────────────────────
    if bs <= 40 and ss <= -0.5:
        return "⛔ High Risk"

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
    event_stats 전체 로드.
    Z-score 컬럼(avg_z_5d_large/mid/small, n_large/mid/small) 포함.
    """
    resp = sb.table("event_stats").select(
        "event_type, avg_5d_return, sample_size, "
        "avg_z_5d_large, avg_z_5d_mid, avg_z_5d_small, "
        "n_large, n_mid, n_small"
    ).execute()
    result: dict[str, dict] = {}
    for row in (resp.data or []):
        result[row["event_type"]] = {
            "avg_5d_return": row.get("avg_5d_return"),
            "sample_size":   row.get("sample_size"),
            "z_large": row.get("avg_z_5d_large"),
            "z_mid":   row.get("avg_z_5d_mid"),
            "z_small": row.get("avg_z_5d_small"),
            "n_large": row.get("n_large") or 0,
            "n_mid":   row.get("n_mid")   or 0,
            "n_small": row.get("n_small") or 0,
        }
    return result


# 시총 버킷 기준 (backfill_prices.py 와 동일)
_CAP_LARGE = 245_000_000_000
_CAP_MID   =  65_000_000_000


def get_cap_bucket(market_cap: int | None) -> str:
    if not market_cap or market_cap <= 0:
        return 'SMALL'
    if market_cap >= _CAP_LARGE:
        return 'LARGE'
    if market_cap >= _CAP_MID:
        return 'MID'
    return 'SMALL'


def load_market_caps(sb) -> dict[str, int]:
    """companies 테이블에서 stock_code → market_cap 매핑 로드."""
    resp = sb.table("companies").select("stock_code, market_cap").not_.is_("market_cap", "null").execute()
    return {
        r["stock_code"]: int(r["market_cap"])
        for r in (resp.data or [])
        if r.get("market_cap") and int(r["market_cap"]) > 0
    }


def fetch_unscored(sb, recompute: bool, from_dt: str | None = None, to_dt: str | None = None) -> list[dict]:
    """
    base_score 가 null 인 공시 (또는 recompute=True 이면 전체) 조회.
    sentiment_score IS NOT NULL + analysis_status = 'completed' 조건 포함.
    Supabase 1000행 제한을 우회하기 위해 페이지네이션 적용.
    from_dt / to_dt: rcept_dt 범위 필터 (YYYYMMDD 형식, 포함)
    """
    PAGE = 1000
    all_rows: list[dict] = []
    offset = 0

    while True:
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
        if from_dt:
            query = query.gte("rcept_dt", from_dt)
        if to_dt:
            query = query.lte("rcept_dt", to_dt)

        page = (
            query
            .order("rcept_dt", desc=True)
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        rows = page.data or []
        all_rows.extend(rows)
        if len(rows) < PAGE:
            break
        offset += PAGE

    return all_rows


def load_m_scores(sb) -> dict[str, float]:
    """
    daily_indicators 에서 M_score 날짜별 맵 생성.
    M_score = 1 + 0.5 * tanh(z_flow)
    z_flow  = (foreign_net_buy_kospi - mean_25d) / std_25d
    반환: {date_str(YYYY-MM-DD): m_score}
    """
    import math
    resp = (
        sb.table("daily_indicators")
        .select("date, foreign_net_buy_kospi")
        .not_.is_("foreign_net_buy_kospi", "null")
        .order("date")
        .execute()
    )
    rows_di = resp.data or []
    result: dict[str, float] = {}
    window_size = 25

    for idx, r in enumerate(rows_di):
        date_str = str(r["date"])[:10]
        flow = float(r["foreign_net_buy_kospi"])
        # 이전 최대 25개 사용
        hist = [
            float(rows_di[j]["foreign_net_buy_kospi"])
            for j in range(max(0, idx - window_size), idx)
            if rows_di[j].get("foreign_net_buy_kospi") is not None
        ]
        if len(hist) < 2:
            result[date_str] = 1.0  # 데이터 부족 → 중립
            continue
        mean_h = sum(hist) / len(hist)
        var_h  = sum((x - mean_h) ** 2 for x in hist) / len(hist)
        std_h  = var_h ** 0.5
        if std_h == 0:
            result[date_str] = 1.0
        else:
            z = (flow - mean_h) / std_h
            result[date_str] = round(1.0 + 0.5 * math.tanh(z), 4)

    return result


def load_f_scores(sb) -> dict[str, dict[int, float]]:
    """
    financials 에서 stock_code → {fiscal_year: f_score} 맵 로드.
    반환: {stock_code: {fiscal_year(int): f_score}}
    """
    resp = (
        sb.table("financials")
        .select("stock_code, fiscal_year, f_score")
        .not_.is_("f_score", "null")
        .execute()
    )
    result: dict[str, dict[int, float]] = {}
    for r in (resp.data or []):
        code = r.get("stock_code")
        fy   = r.get("fiscal_year")
        fs   = r.get("f_score")
        if code and fy is not None and fs is not None:
            result.setdefault(code, {})[int(fy)] = float(fs)
    return result


def get_f_score_for_event(f_score_map: dict[str, dict[int, float]],
                           stock_code: str, event_year: int) -> float | None:
    """event_year 이하 최신 fiscal_year 의 f_score 반환."""
    stock_fs = f_score_map.get(stock_code)
    if not stock_fs:
        return None
    valid = {fy: fs for fy, fs in stock_fs.items() if fy <= event_year}
    if not valid:
        return None
    return valid[max(valid)]


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
    parser.add_argument("--from",  dest="from_dt", default=None, help="시작 날짜 (YYYYMMDD, rcept_dt 기준)")
    parser.add_argument("--to",    dest="to_dt",   default=None, help="종료 날짜 (YYYYMMDD, rcept_dt 기준)")
    args = parser.parse_args()

    print("=" * 60)
    print("BaseScore / FinalScore 계산")
    print(f"  모드: {'DRY-RUN' if args.dry_run else '실제 저장'}"
          + (" + 재계산" if args.recompute else ""))
    print("=" * 60)

    sb = _get_supabase()

    # 1. event_stats + market_cap 로드
    print("\n  [1/5] event_stats + 시총 데이터 로드 중...")
    event_stats = load_event_stats(sb)
    print(f"  → {len(event_stats)}개 이벤트 유형 로드")
    if not event_stats:
        print("  [WARN] event_stats 가 비어 있습니다. e 컴포넌트는 중립(15)으로 처리됩니다.")

    cap_map = load_market_caps(sb)
    print(f"  → 시총 매핑: {len(cap_map)}개 종목")

    m_score_map = load_m_scores(sb)
    print(f"  → M_score 날짜 맵: {len(m_score_map)}일치 로드")

    f_score_map = load_f_scores(sb)
    print(f"  → F_score 종목 맵: {len(f_score_map)}개 종목 로드")

    # 2. 미계산 공시 조회
    print("\n  [2/5] 미계산 공시 조회 중...")
    rows = fetch_unscored(sb, args.recompute, from_dt=args.from_dt, to_dt=args.to_dt)
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

        # event_stats 조회 + 시총 버킷 기반 Z-score E 컴포넌트
        ev_key  = str(row.get("event_type") or "").upper()
        ev_info = event_stats.get(ev_key, {})
        bucket  = get_cap_bucket(cap_map.get(code))

        z_key = f"z_{bucket.lower()}"   # z_large / z_mid / z_small
        n_key = f"n_{bucket.lower()}"   # n_large / n_mid / n_small
        z_score  = ev_info.get(z_key)
        n_bucket = ev_info.get(n_key, 0)

        s  = compute_s(row.get("sentiment_score"))
        i_ = compute_i(row.get("short_term_impact_score"))
        # Z-score 데이터 있으면 버킷별 Z-score 사용, 없으면 레거시 fallback
        if z_score is not None:
            e = compute_e_zscore(z_score, n_bucket)
        else:
            e = compute_e(ev_info.get("avg_5d_return"), ev_info.get("sample_size"))
        raw, bs = compute_base_score(s, i_, e)

        lps         = lps_map.get((code, rdt))
        reliability = compute_reliability(row.get("key_numbers"))
        fs  = compute_final_score(bs, lps, reliability)
        tag = compute_signal_tag(
            bs, lps,
            event_type=ev_key,
            sentiment_score=row.get("sentiment_score"),
        )

        insight_updates.append({
            "id":             row["id"],
            "base_score_raw": raw,
            "base_score":     bs,
            "final_score":    fs,
            "signal_tag":     tag,
        })

        event_year = datetime.strptime(rdt, "%Y%m%d").year if len(rdt) == 8 else None
        m_val = m_score_map.get(iso_date)          # None if no daily_indicators for that date
        f_val = get_f_score_for_event(f_score_map, code, event_year) if event_year else None

        log_rows.append({
            "stock_code":    code,
            "date":          iso_date,
            "disclosure_id": row["id"],
            "base_score_raw": raw,
            "base_score":    bs,
            "lps":           lps,
            "final_score":   fs,
            "signal_tag":    tag,
            "m_score":       m_val,
            "f_score":       f_val,
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
