"""
scripts/backfill_sector_macro.py
=================================
산업통상자원부 월별 수출입동향 데이터를 sector_macro 테이블에 upsert.

PDF에서 읽은 15개 품목 데이터를 우리 12개 sector_en으로 매핑하여
금액 가중평균으로 집계한 뒤 macro_score / macro_label / export_momentum을 산출한다.

사용법:
  python scripts/backfill_sector_macro.py           # 전체 업서트
  python scripts/backfill_sector_macro.py --dry-run # 출력만, DB 저장 안 함
"""

import sys
import argparse
import logging
from collections import defaultdict
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env, get_supabase_config
load_env()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_sector_macro")


# ── 하드코딩 원시 데이터 ────────────────────────────────────────────────────────
# △ = 음수로 이미 변환됨
# 형식: {품목: [(year_month, export_yoy, export_amount_mn), ...]}

RAW_EXPORT_DATA = {
    "반도체": [
        ("2025-02",  -3.0,  9647),
        ("2025-12",  43.2, 20768),
        ("2026-01", 102.8, 20541),
        ("2026-02", 160.8, 25160),
    ],
    "석유제품": [
        ("2025-02", -12.5, 3877),
        ("2025-12",   5.4, 4178),
        ("2026-01",   7.7, 3712),
        ("2026-02",  -3.9, 3726),
    ],
    "석유화학": [
        ("2025-02",  -0.6, 3937),
        ("2025-12",  -8.2, 3552),
        ("2026-01",  -0.9, 3543),
        ("2026-02", -15.4, 3331),
    ],
    "자동차": [
        ("2025-02",  17.7, 6065),
        ("2025-12",  -1.5, 5952),
        ("2026-01", -21.7, 6067),
        ("2026-02", -20.8, 4806),
    ],
    "일반기계": [
        ("2025-02", -12.2, 3894),
        ("2025-12",  -2.2, 4227),
        ("2026-01",   8.5, 3708),
        ("2026-02", -16.3, 3259),
    ],
    "철강제품": [
        ("2025-02",  -4.3, 2557),
        ("2025-12", -10.8, 2473),
        ("2026-01",   0.2, 2633),
        ("2026-02",  -7.8, 2358),
    ],
    "자동차부품": [
        ("2025-02",  -4.3, 1868),
        ("2025-12",  -2.1, 1831),
        ("2026-01",   4.0, 1632),
        ("2026-02", -22.4, 1449),
    ],
    "디스플레이": [
        ("2025-02",  -5.8, 1267),
        ("2025-12",   0.8, 1489),
        ("2026-01",  26.1, 1379),
        ("2026-02",  -4.2, 1215),
    ],
    "선박": [
        ("2025-02",  -9.9, 1566),
        ("2025-12",  -1.9, 3033),
        ("2026-01",  -0.1, 2476),
        ("2026-02",  41.2, 2210),
    ],
    "무선통신기기": [
        ("2025-02",  26.5, 1307),
        ("2025-12",  24.7, 1686),
        ("2026-01",  66.9, 2026),
        ("2026-02",  12.7, 1473),
    ],
    "바이오헬스": [
        ("2025-02",   4.9, 1223),
        ("2025-12",  23.8, 1569),
        ("2026-01",  16.2, 1321),
        ("2026-02",   7.1, 1310),
    ],
    "컴퓨터": [
        ("2025-02",  28.5,  796),
        ("2025-12",  36.6, 2044),
        ("2026-01",  89.0, 1552),
        ("2026-02", 221.6, 2561),
    ],
    "섬유": [
        ("2025-02",  -1.7,  803),
        ("2025-12",  -1.0,  883),
        ("2026-01",   5.8,  767),
        ("2026-02", -14.5,  687),
    ],
    "이차전지": [
        ("2025-02",  -9.6,  629),
        ("2025-12", -13.0,  715),
        ("2026-01",   5.8,  549),
        ("2026-02",  -5.7,  593),
    ],
    "가전": [
        ("2025-02",  -4.2,  634),
        ("2025-12",  -1.6,  603),
        ("2026-01",   0.3,  559),
        ("2026-02", -19.9,  508),
    ],
}

# ── 품목 → sector_en 매핑 ────────────────────────────────────────────────────

ITEM_TO_SECTOR = {
    "반도체":     "Semiconductors, IT & Displays",
    "디스플레이":  "Semiconductors, IT & Displays",
    "무선통신기기": "Semiconductors, IT & Displays",
    "컴퓨터":     "Semiconductors, IT & Displays",
    "자동차":     "Automobiles, Aerospace & Logistics",
    "자동차부품":  "Automobiles, Aerospace & Logistics",
    "선박":       "Automobiles, Aerospace & Logistics",
    "석유제품":   "Materials & Chemicals",
    "석유화학":   "Materials & Chemicals",
    "철강제품":   "Materials & Chemicals",
    "이차전지":   "Materials & Chemicals",
    "일반기계":   "Industrial Machinery",
    "바이오헬스": "Healthcare & Biotech",
    "섬유":       "Consumer Goods & Retail",
    "가전":       "Consumer Goods & Retail",
}


# ── 집계 / 점수 계산 로직 ────────────────────────────────────────────────────

def compute_macro_score(yoy: float, prev_yoy: float) -> float:
    """YoY 수준과 모멘텀(전월 대비 변화)을 각 0.5씩 반영해 -1 ~ +1 점수 산출."""
    score = 0.0
    score += 0.5 if yoy > 0 else -0.5
    momentum = yoy - prev_yoy
    score += 0.5 if momentum > 0 else -0.5
    return round(score, 2)


def map_macro_label(score: float) -> str:
    if score >= 0.75:
        return "STRONG_TAILWIND"
    elif score >= 0.25:
        return "POSITIVE"
    elif score > -0.25:
        return "NEUTRAL"
    elif score > -0.75:
        return "NEGATIVE"
    else:
        return "HEADWIND"


def map_momentum(yoy: float, prev_yoy: float) -> str:
    diff = yoy - prev_yoy
    if diff > 2:
        return "ACCELERATING"
    elif diff < -2:
        return "DECELERATING"
    else:
        return "STABLE"


def aggregate() -> list[dict]:
    """
    RAW_EXPORT_DATA를 sector_en + year_month 기준으로 집계.

    - export_yoy: 수출금액 가중평균
    - export_amount_mn: 합산
    - prev_export_yoy: 해당 sector의 직전 월 export_yoy (데이터 내 순서 기준)

    반환값: sector_macro 테이블에 upsert할 dict 리스트
    """
    # {(sector_en, year_month): [(yoy, amount_mn), ...]}
    bucket: dict[tuple, list] = defaultdict(list)

    for item_kr, rows in RAW_EXPORT_DATA.items():
        sector = ITEM_TO_SECTOR.get(item_kr)
        if sector is None:
            logger.warning("매핑 없음: %s — 건너뜁니다.", item_kr)
            continue
        for year_month, yoy, amount_mn in rows:
            bucket[(sector, year_month)].append((yoy, amount_mn))

    # sector 별 정렬된 year_month 목록 파악 (prev_yoy 계산용)
    # {sector_en: sorted list of year_month}
    sector_months: dict[str, list] = defaultdict(set)
    for sector, ym in bucket:
        sector_months[sector].add(ym)
    sector_months = {s: sorted(months) for s, months in sector_months.items()}

    # 집계 결과: {(sector_en, year_month): {export_yoy, export_amount_mn}}
    aggregated: dict[tuple, dict] = {}
    for (sector, ym), entries in bucket.items():
        total_amount = sum(amt for _, amt in entries)
        if total_amount == 0:
            w_avg_yoy = 0.0
        else:
            w_avg_yoy = sum(yoy * amt for yoy, amt in entries) / total_amount
        aggregated[(sector, ym)] = {
            "export_yoy": round(w_avg_yoy, 2),
            "export_amount_mn": round(total_amount, 2),
        }

    # prev_export_yoy 채우기
    records = []
    for sector, months in sector_months.items():
        for i, ym in enumerate(months):
            key = (sector, ym)
            agg = aggregated[key]
            export_yoy = agg["export_yoy"]

            if i > 0:
                prev_key = (sector, months[i - 1])
                prev_export_yoy = aggregated[prev_key]["export_yoy"]
            else:
                # 가장 오래된 월은 prev가 없으므로 자기 자신으로 대체 → momentum=0
                prev_export_yoy = export_yoy

            macro_score = compute_macro_score(export_yoy, prev_export_yoy)
            records.append({
                "sector_en":        sector,
                "year_month":       ym,
                "export_yoy":       export_yoy,
                "prev_export_yoy":  round(prev_export_yoy, 2),
                "export_amount_mn": agg["export_amount_mn"],
                "export_momentum":  map_momentum(export_yoy, prev_export_yoy),
                "macro_score":      macro_score,
                "macro_label":      map_macro_label(macro_score),
                "source":           "산업통상자원부",
            })

    # 정렬: sector_en → year_month
    records.sort(key=lambda r: (r["sector_en"], r["year_month"]))
    return records


def print_records(records: list[dict]) -> None:
    header = f"{'sector_en':<40} {'year_month':<10} {'yoy':>7} {'prev_yoy':>9} {'amount_mn':>10} {'momentum':<13} {'score':>6} {'label'}"
    print(header)
    print("-" * len(header))
    for r in records:
        print(
            f"{r['sector_en']:<40} {r['year_month']:<10} "
            f"{r['export_yoy']:>7.1f} {r['prev_export_yoy']:>9.1f} "
            f"{r['export_amount_mn']:>10.0f} {r['export_momentum']:<13} "
            f"{r['macro_score']:>6.2f} {r['macro_label']}"
        )


def upsert_records(records: list[dict]) -> None:
    try:
        from supabase import create_client
    except ImportError:
        logger.error("supabase 패키지가 없습니다. pip install supabase")
        sys.exit(1)

    url, key = get_supabase_config(use_service_role=True)
    if not url or not key:
        logger.error("Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)가 없습니다.")
        sys.exit(1)

    client = create_client(url, key)

    logger.info("총 %d건 upsert 시작...", len(records))
    result = (
        client.table("sector_macro")
        .upsert(records, on_conflict="sector_en,year_month")
        .execute()
    )

    upserted_count = len(result.data) if result.data else 0
    logger.info("upsert 완료: %d건", upserted_count)


def main() -> None:
    parser = argparse.ArgumentParser(description="sector_macro 백필 스크립트")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="DB에 저장하지 않고 집계 결과만 출력합니다.",
    )
    args = parser.parse_args()

    records = aggregate()
    logger.info("집계 완료: 총 %d개 레코드", len(records))

    print_records(records)

    if args.dry_run:
        logger.info("--dry-run 모드: DB 저장을 건너뜁니다.")
        return

    upsert_records(records)


if __name__ == "__main__":
    main()
