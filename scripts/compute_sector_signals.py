"""
scripts/compute_sector_signals.py
==================================
disclosure_insights 테이블을 집계하여 sector_signals 테이블을 갱신.

로직:
  - 지정일(기본: 전 영업일)의 공시 데이터를 companies.sector 기준으로 그룹핑
  - 섹터별 POSITIVE / NEGATIVE / NEUTRAL 카운트 집계
  - Signal 결정: POSITIVE% > 40% → Bullish / NEGATIVE% > 40% → Bearish / 그외 → Neutral
  - Confidence: |positive - negative| / total  (0.0 ~ 1.0)
  - Drivers: 해당 섹터의 당일 event_type 상위 3개
  - sector_en: sector_benchmarks 테이블에서 매핑

사용법:
  python scripts/compute_sector_signals.py             # 전 영업일
  python scripts/compute_sector_signals.py --date 20260313
  python scripts/compute_sector_signals.py --dry-run   # DB 저장 없이 출력
"""

import os
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

# ── supabase를 sys.path 수정 전에 먼저 import ─────────────────────────────────
# stockplatform/supabase/ 폴더와의 충돌 방지
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

BATCH_SIZE = 50
BULLISH_THRESHOLD = 0.40   # POSITIVE 비율이 이 이상이면 Bullish
BEARISH_THRESHOLD = 0.40   # NEGATIVE 비율이 이 이상이면 Bearish


def get_prev_business_day(ref: datetime = None) -> str:
    """전 영업일 (YYYYMMDD). 주말이면 금요일로."""
    d = ref or datetime.now()
    d -= timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


# ── Supabase 연결 ─────────────────────────────────────────────────────────────

def get_supabase():
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지가 설치되지 않았습니다. pip install supabase 를 실행하세요.")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
        sys.exit(1)
    return create_client(url, key)


# ── 데이터 조회 ───────────────────────────────────────────────────────────────

def fetch_disclosures_for_date(supabase, date_str: str) -> list[dict]:
    """
    지정일의 공시 + 회사 섹터 JOIN 데이터 반환.
    disclosure_insights.stock_code → companies.sector 매핑.
    """
    # Supabase Python client는 복잡한 JOIN을 지원하지 않으므로 두 번 쿼리
    # 1) 해당 날짜 공시 조회
    resp = (
        supabase.table("disclosure_insights")
        .select("id, stock_code, corp_name, sentiment, event_type, rcept_dt")
        .eq("rcept_dt", date_str)
        .not_.is_("sentiment", "null")
        .not_.is_("stock_code", "null")
        .neq("stock_code", "")
        .execute()
    )
    disclosures = resp.data or []

    if not disclosures:
        return []

    # 2) 사용된 stock_code 수집 후 companies 섹터 조회
    stock_codes = list({d["stock_code"] for d in disclosures})
    # Supabase in() 필터 (최대 500개 단위로 분할)
    sector_map: dict[str, str] = {}
    sector_en_map: dict[str, str] = {}

    for i in range(0, len(stock_codes), 500):
        chunk = stock_codes[i:i + 500]
        c_resp = (
            supabase.table("companies")
            .select("stock_code, sector, sector_en")
            .in_("stock_code", chunk)
            .execute()
        )
        for row in (c_resp.data or []):
            if row.get("sector"):
                sector_map[row["stock_code"]] = row["sector"]
            if row.get("sector_en"):
                sector_en_map[row["stock_code"]] = row["sector_en"]

    # sector_benchmarks에서 sector_en 보충 (companies.sector_en이 없는 경우)
    sb_resp = supabase.table("sector_benchmarks").select("sector, sector_en").execute()
    sb_sector_en: dict[str, str] = {
        row["sector"]: row["sector_en"]
        for row in (sb_resp.data or [])
        if row.get("sector_en")
    }

    # 3) 섹터 정보 합치기
    enriched = []
    for d in disclosures:
        sc = d["stock_code"]
        sector = sector_map.get(sc)
        if not sector:
            continue  # 섹터 미분류 종목 제외
        sector_en = sector_en_map.get(sc) or sb_sector_en.get(sector)
        enriched.append({
            **d,
            "sector":    sector,
            "sector_en": sector_en,
        })

    return enriched


# ── 신호 계산 ─────────────────────────────────────────────────────────────────

def compute_signal(positive: int, negative: int, neutral: int) -> tuple[str, float]:
    """(signal, confidence) 반환"""
    total = positive + negative + neutral
    if total == 0:
        return "Neutral", 0.0

    pos_ratio = positive / total
    neg_ratio = negative / total

    if pos_ratio >= BULLISH_THRESHOLD and pos_ratio > neg_ratio:
        signal = "Bullish"
    elif neg_ratio >= BEARISH_THRESHOLD and neg_ratio > pos_ratio:
        signal = "Bearish"
    else:
        signal = "Neutral"

    confidence = round(abs(positive - negative) / total, 3)
    return signal, confidence


def aggregate_by_sector(disclosures: list[dict], date_str: str) -> list[dict]:
    """섹터별 집계 → sector_signals 행 목록 반환"""
    # {sector: {sentiment_counts, event_types, sector_en}}
    buckets: dict[str, dict] = defaultdict(lambda: {
        "positive": 0, "negative": 0, "neutral": 0,
        "event_types": defaultdict(int),
        "sector_en": None,
    })

    for d in disclosures:
        sector = d["sector"]
        sentiment = (d.get("sentiment") or "").upper()
        event_type = d.get("event_type") or ""

        b = buckets[sector]
        if b["sector_en"] is None and d.get("sector_en"):
            b["sector_en"] = d["sector_en"]

        if sentiment == "POSITIVE":
            b["positive"] += 1
        elif sentiment == "NEGATIVE":
            b["negative"] += 1
        else:
            b["neutral"] += 1

        if event_type:
            b["event_types"][event_type] += 1

    rows = []
    for sector, b in sorted(buckets.items()):
        positive  = b["positive"]
        negative  = b["negative"]
        neutral   = b["neutral"]
        total     = positive + negative + neutral

        signal, confidence = compute_signal(positive, negative, neutral)

        # drivers: 상위 3개 event_type
        drivers = [
            et for et, _ in sorted(
                b["event_types"].items(), key=lambda x: -x[1]
            )[:3]
        ]

        rows.append({
            "date":             date_str,   # YYYYMMDD → DATE 컬럼 (Supabase가 처리)
            "sector":           sector,
            "sector_en":        b["sector_en"],
            "signal":           signal,
            "confidence":       confidence,
            "disclosure_count": total,
            "positive_count":   positive,
            "negative_count":   negative,
            "neutral_count":    neutral,
            "drivers":          drivers,
        })

    return rows


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def save_to_db(supabase, rows: list[dict]) -> tuple[int, int]:
    """배치 upsert → (성공수, 실패수)"""
    success = 0
    failure = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        try:
            supabase.table("sector_signals").upsert(
                batch,
                on_conflict="date,sector"
            ).execute()
            success += len(batch)
            print(f"  Batch {batch_num} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] Batch {batch_num} 실패: {e}")

    return success, failure


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="섹터 신호 집계 (disclosure_insights → sector_signals)")
    parser.add_argument("--date",    help="기준일 (YYYYMMDD). 미지정 시 전 영업일")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 출력만")
    args = parser.parse_args()

    date_str = args.date or get_prev_business_day()

    print("=" * 60)
    print("섹터 신호 집계")
    print(f"  기준일: {date_str}")
    print(f"  모드:   {'DRY-RUN' if args.dry_run else '실제 저장'}")
    print("=" * 60)

    supabase = get_supabase()

    # 1. 공시 데이터 조회
    print(f"  disclosure_insights 조회 중 (rcept_dt={date_str})...")
    disclosures = fetch_disclosures_for_date(supabase, date_str)
    print(f"  섹터 매핑된 공시: {len(disclosures)}건")

    if not disclosures:
        print("[WARN] 집계할 공시가 없습니다.")
        print("  - 영업일 확인 (주말/공휴일은 공시 없음)")
        print("  - companies.sector 매핑 여부 확인")
        sys.exit(0)

    # 2. 섹터별 집계
    rows = aggregate_by_sector(disclosures, date_str)
    print(f"  집계 완료: {len(rows)}개 섹터")

    # 3. 결과 출력
    print()
    print(f"{'섹터':<20} {'Signal':<8} {'Conf':>6}  {'공시':>4}  (+/−/0)   Drivers")
    print("-" * 72)
    for r in rows:
        drivers_str = ", ".join(r["drivers"][:2]) if r["drivers"] else "-"
        print(
            f"{r['sector']:<20} {r['signal']:<8} {r['confidence']:>6.3f}  "
            f"{r['disclosure_count']:>4}  "
            f"({r['positive_count']}/{r['negative_count']}/{r['neutral_count']})  "
            f"{drivers_str}"
        )

    # 4. 저장
    if args.dry_run:
        print("\n[DRY-RUN] DB 저장 생략.")
        sys.exit(0)

    print(f"\n  Supabase 저장 중 ({len(rows)}건)...")
    success, failure = save_to_db(supabase, rows)

    print("=" * 60)
    print(f"완료: 성공 {success}건 / 실패 {failure}건")
    print("=" * 60)
    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
