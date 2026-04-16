"""
scripts/backfill_foreign_flow.py
=================================
한국은행 ECOS API 로 외국인 순매수 KOSPI 일별 데이터를 백필.
daily_indicators.foreign_net_buy_kospi 컬럼만 업데이트 (다른 컬럼 보존).

출처: 한국은행 경제통계시스템 (ECOS)
이용 조건: 출처 명시 조건 하에 데이터 가공·2차 저작물 서비스 허용.
           원본 데이터 그대로의 유료 판매는 금지.

ECOS API 엔드포인트:
  StatisticTableList : 통계표 목록 검색
  StatisticItemList  : 통계표 항목(시리즈) 조회
  StatisticSearch    : 실제 수치 조회

실행 순서 (처음 사용 시):
  1. python scripts/backfill_foreign_flow.py --search 외국인
     → STAT_CODE 확인 (예: 064Y002)
  2. python scripts/backfill_foreign_flow.py --probe 064Y002
     → 항목명·코드 확인 (ITEM_CODE, DATA_VALUE 단위 등)
  3. python scripts/backfill_foreign_flow.py --stat-code 064Y002 --item-code XX --dry-run
  4. python scripts/backfill_foreign_flow.py --stat-code 064Y002 --item-code XX --days 365

일반 사용:
  python scripts/backfill_foreign_flow.py --stat-code 064Y002 --days 180
  python scripts/backfill_foreign_flow.py --stat-code 064Y002 --force  # 기존 덮어쓰기
"""

import os
import sys
import time
import argparse
import logging
import requests
from datetime import date, timedelta
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_foreign_flow")

# ── 설정 ──────────────────────────────────────────────────────────────────────

ECOS_BASE    = "https://ecos.bok.or.kr/api"
API_SLEEP    = 0.5   # ECOS 호출 간 sleep (초)
PAGE_SIZE    = 9999  # 한 번에 가져올 최대 rows (ECOS 상한 = 10000)

# 외국인 항목 식별 키워드 (ITEM_NAME 포함 여부)
FOREIGN_KEYWORDS = ["외국인"]

# 순매수 항목 식별 키워드 (ITEM_NAME 포함 여부)
NET_BUY_KEYWORDS = ["순매수", "순매도매수"]

# 단위 보정: ECOS 값이 억원이면 1, 원이면 1e-8, 백만원이면 0.01
# --probe 출력에서 단위 확인 후 필요 시 --unit-divisor 로 조정
DEFAULT_UNIT_DIVISOR = 1.0   # 기본값: 이미 억원 단위


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    if _supabase_create_client is None:
        logger.error("supabase 패키지 미설치")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("Supabase 환경변수 누락")
        sys.exit(1)
    return _supabase_create_client(url, key)


def _get_api_key() -> str:
    key = os.environ.get("ECOS_API_KEY", "").strip()
    if not key:
        logger.error("ECOS_API_KEY 환경변수 누락 (.env.local 확인)")
        sys.exit(1)
    return key


# ── ECOS API 헬퍼 ─────────────────────────────────────────────────────────────

def ecos_table_list(api_key: str, keyword: str = "") -> list[dict]:
    """
    StatisticTableList: 통계표 목록 조회.
    keyword: 통계명 검색어 (빈 문자열이면 전체)
    """
    url = f"{ECOS_BASE}/StatisticTableList/{api_key}/json/kr/1/{PAGE_SIZE}/"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f"StatisticTableList 호출 실패: {e}")
        return []

    rows = data.get("StatisticTableList", {}).get("row", [])
    if keyword:
        kw = keyword.lower()
        rows = [r for r in rows if kw in r.get("STAT_NAME", "").lower()]
    return rows


def ecos_item_list(api_key: str, stat_code: str) -> list[dict]:
    """
    StatisticItemList: 통계표 항목(시리즈) 조회.
    """
    url = f"{ECOS_BASE}/StatisticItemList/{api_key}/json/kr/1/{PAGE_SIZE}/{stat_code}/"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f"StatisticItemList 호출 실패: {e}")
        return []

    return data.get("StatisticItemList", {}).get("row", [])


def ecos_search(
    api_key: str,
    stat_code: str,
    start_date: str,   # YYYYMMDD
    end_date: str,     # YYYYMMDD
    item_code1: str = "",
    item_code2: str = "",
    item_code3: str = "",
    item_code4: str = "",
    period: str = "D",
) -> list[dict]:
    """
    StatisticSearch: 실제 데이터 조회.
    반환: [{"TIME": "YYYYMMDD", "DATA_VALUE": "...", ...}, ...]
    """
    parts = [
        ECOS_BASE,
        "StatisticSearch",
        api_key,
        "json",
        "kr",
        "1",
        str(PAGE_SIZE),
        stat_code,
        period,
        start_date,
        end_date,
    ]
    # 항목 코드 추가 (빈 문자열도 포함 — ECOS는 빈 값을 와일드카드로 처리)
    for code in [item_code1, item_code2, item_code3, item_code4]:
        parts.append(code)

    url = "/".join(parts) + "/"
    try:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f"StatisticSearch 호출 실패: {e}")
        return []

    result = data.get("StatisticSearch", {})
    # 오류 응답 처리
    if "RESULT" in result:
        code = result["RESULT"].get("CODE", "")
        msg  = result["RESULT"].get("MESSAGE", "")
        logger.warning(f"  ECOS 응답 오류: [{code}] {msg}")
        return []

    rows = result.get("row", [])
    if isinstance(rows, dict):
        rows = [rows]
    return rows or []


# ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────

def is_business_day(d: date) -> bool:
    return d.weekday() < 5


def date_range(days: int) -> tuple[str, str]:
    """(start YYYYMMDD, end YYYYMMDD) — 어제까지 days 달력일"""
    end   = date.today() - timedelta(days=1)
    start = end - timedelta(days=days)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")


# ── 외국인 순매수 파싱 ────────────────────────────────────────────────────────

def parse_rows(
    rows: list[dict],
    item_code: str,
    unit_divisor: float,
) -> dict[str, float]:
    """
    ECOS rows → {YYYY-MM-DD: float(억원)} 변환.
    item_code 가 비어 있으면 전체 rows 를 처리하고
    item_code 가 있으면 해당 항목만 필터링.
    """
    result: dict[str, float] = {}

    for row in rows:
        # 항목 필터링
        if item_code:
            row_code = (
                row.get("ITEM_CODE1", "") or
                row.get("ITEM_CODE2", "") or
                row.get("ITEM_CODE3", "") or
                row.get("ITEM_CODE4", "")
            )
            if row_code != item_code:
                # 다중 item_code 컬럼 중 어디에도 없으면 스킵
                all_codes = [
                    row.get("ITEM_CODE1", ""),
                    row.get("ITEM_CODE2", ""),
                    row.get("ITEM_CODE3", ""),
                    row.get("ITEM_CODE4", ""),
                ]
                if item_code not in all_codes:
                    continue

        time_str = str(row.get("TIME", ""))
        raw_val  = row.get("DATA_VALUE")

        if not time_str or raw_val in (None, "", "-"):
            continue

        # TIME 포맷 → YYYY-MM-DD
        time_str = time_str.replace("/", "").replace("-", "")
        if len(time_str) == 8:
            iso = f"{time_str[:4]}-{time_str[4:6]}-{time_str[6:]}"
        else:
            continue

        try:
            val = float(str(raw_val).replace(",", "")) / unit_divisor
            result[iso] = round(val, 2)
        except (ValueError, TypeError):
            continue

    return result


# ── 기존 DB 날짜 조회 ─────────────────────────────────────────────────────────

def fetch_existing_dates(sb, iso_dates: list[str]) -> set[str]:
    """이미 foreign_net_buy_kospi 값이 있는 날짜 반환 (YYYY-MM-DD)"""
    existing: set[str] = set()
    chunk = 200
    for i in range(0, len(iso_dates), chunk):
        batch = iso_dates[i:i + chunk]
        try:
            resp = (
                sb.table("daily_indicators")
                .select("date")
                .in_("date", batch)
                .not_.is_("foreign_net_buy_kospi", "null")
                .execute()
            )
            for row in (resp.data or []):
                existing.add(str(row["date"]))
        except Exception as e:
            logger.warning(f"기존 데이터 조회 실패: {e}")
    return existing


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="ECOS API → daily_indicators.foreign_net_buy_kospi 백필",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
처음 사용 시 단계:
  1. python scripts/backfill_foreign_flow.py --search 외국인
  2. python scripts/backfill_foreign_flow.py --probe <STAT_CODE>
  3. python scripts/backfill_foreign_flow.py --stat-code <CODE> --dry-run
  4. python scripts/backfill_foreign_flow.py --stat-code <CODE> --days 365
        """
    )

    # 모드
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--search",    metavar="KEYWORD",
                      help="통계표 목록에서 키워드 검색 (예: --search 외국인)")
    mode.add_argument("--probe",     metavar="STAT_CODE",
                      help="통계표 항목 목록 + 최근 샘플 데이터 출력")

    # 백필 파라미터
    parser.add_argument("--stat-code",     default="",
                        help="ECOS 통계코드 (예: 064Y002)")
    parser.add_argument("--item-code",     default="",
                        help="항목 필터 코드 (생략 시 전체 rows 처리)")
    parser.add_argument("--unit-divisor",  type=float, default=DEFAULT_UNIT_DIVISOR,
                        help=f"단위 변환 나눗수 (기본 {DEFAULT_UNIT_DIVISOR}: 억원 단위 그대로). "
                             "원 단위면 1e8, 백만원이면 100")
    parser.add_argument("--days",          type=int, default=365,
                        help="소급 달력일 수 (기본 365일)")
    parser.add_argument("--dry-run",       action="store_true",
                        help="계산만, DB 저장 안 함")
    parser.add_argument("--force",         action="store_true",
                        help="이미 값 있는 날짜도 덮어쓰기")

    args = parser.parse_args()
    api_key = _get_api_key()

    # ── --search 모드 ─────────────────────────────────────────────────────────
    if args.search:
        logger.info(f"\n  ECOS 통계표 검색: '{args.search}'")
        rows = ecos_table_list(api_key, args.search)
        if not rows:
            logger.warning("  검색 결과 없음")
        else:
            logger.info(f"  → {len(rows)}개 통계표 발견\n")
            for r in rows:
                cycle = r.get("CYCLE", "")
                logger.info(
                    f"  STAT_CODE={r.get('STAT_CODE'):12s}  "
                    f"CYCLE={cycle}  "
                    f"이름={r.get('STAT_NAME')}"
                )
            logger.info("\n  CYCLE=D 인 항목이 일별 데이터입니다.")
            logger.info("  다음 단계: --probe <STAT_CODE>")
        sys.exit(0)

    # ── --probe 모드 ──────────────────────────────────────────────────────────
    if args.probe:
        stat_code = args.probe
        logger.info(f"\n  ECOS 항목 목록: {stat_code}")
        items = ecos_item_list(api_key, stat_code)
        if not items:
            logger.warning("  항목 없음 (STAT_CODE 오류 가능)")
        else:
            logger.info(f"  → {len(items)}개 항목\n")
            for it in items:
                logger.info(
                    f"  ITEM_CODE1={it.get('ITEM_CODE1',''):6s}  "
                    f"ITEM_CODE2={it.get('ITEM_CODE2',''):6s}  "
                    f"ITEM_CODE3={it.get('ITEM_CODE3',''):6s}  "
                    f"이름={it.get('ITEM_NAME1','')} / {it.get('ITEM_NAME2','')} / {it.get('ITEM_NAME3','')}"
                )

        # 최근 5일 샘플 데이터
        logger.info(f"\n  최근 5일 샘플 (전체 항목):")
        end_dt   = date.today() - timedelta(days=1)
        start_dt = end_dt - timedelta(days=10)
        sample   = ecos_search(
            api_key, stat_code,
            start_dt.strftime("%Y%m%d"),
            end_dt.strftime("%Y%m%d"),
        )
        if not sample:
            logger.warning("  샘플 데이터 없음")
        else:
            for row in sample[:20]:
                logger.info(f"    {row}")
        sys.exit(0)

    # ── 백필 모드 ─────────────────────────────────────────────────────────────
    if not args.stat_code:
        parser.error("백필 모드에서는 --stat-code 가 필요합니다.\n"
                     "먼저 --search 외국인 으로 STAT_CODE 를 찾으세요.")

    logger.info("=" * 55)
    logger.info("  backfill_foreign_flow (ECOS)")
    logger.info(f"  stat_code={args.stat_code}  item_code='{args.item_code}'")
    logger.info(f"  days={args.days}  unit_divisor={args.unit_divisor}")
    logger.info(f"  dry_run={args.dry_run}  force={args.force}")
    logger.info("=" * 55)

    sb = _get_supabase()

    # 조회 기간
    start_yyyymmdd, end_yyyymmdd = date_range(args.days)
    logger.info(f"\n  조회 기간: {start_yyyymmdd} ~ {end_yyyymmdd}")

    # ECOS API 호출
    logger.info("\n  [1/3] ECOS API 조회 중...")
    rows = ecos_search(
        api_key,
        args.stat_code,
        start_yyyymmdd,
        end_yyyymmdd,
        item_code1=args.item_code,
    )
    logger.info(f"  → {len(rows)}개 row 수신")

    if not rows:
        logger.error("  데이터 없음. --probe 로 항목 구조를 먼저 확인하세요.")
        sys.exit(1)

    # 외국인 순매수 파싱
    logger.info("\n  [2/3] 외국인 순매수 파싱 중...")
    flow_map = parse_rows(rows, args.item_code, args.unit_divisor)
    logger.info(f"  → 파싱된 날짜: {len(flow_map)}일")

    if not flow_map:
        logger.error("  파싱 결과 없음. --item-code 또는 --unit-divisor 를 확인하세요.")
        logger.info(f"  첫 번째 raw row: {rows[0] if rows else '(없음)'}")
        sys.exit(1)

    # 통계 출력
    vals = list(flow_map.values())
    logger.info(
        f"  범위: min={min(vals):+,.0f}  max={max(vals):+,.0f}  "
        f"avg={sum(vals)/len(vals):+,.0f}  (억원)"
    )

    # 기존 데이터 확인
    logger.info("\n  [3/3] DB 저장 중...")
    iso_dates = sorted(flow_map.keys())

    if not args.force:
        existing = fetch_existing_dates(sb, iso_dates)
        skip_cnt = len(existing)
        logger.info(f"  이미 값 있음: {skip_cnt}일 스킵 (--force 로 덮어쓰기)")
    else:
        existing = set()
        logger.info("  --force: 기존 값 모두 덮어쓰기")

    success = skipped = failed = 0

    for iso_date in iso_dates:
        if iso_date in existing:
            skipped += 1
            continue

        val = flow_map[iso_date]
        sign = "+" if val >= 0 else ""

        if args.dry_run:
            logger.info(f"  [DRY] {iso_date}: {sign}{val:,.0f}억원")
            success += 1
            continue

        try:
            sb.table("daily_indicators").upsert(
                {
                    "date":                  iso_date,   # YYYY-MM-DD
                    "foreign_net_buy_kospi": val,
                    "source":                "한국은행_ECOS",
                    "updated_at":            iso_date + "T00:00:00+09:00",
                },
                on_conflict="date",
            ).execute()
            success += 1
            if success <= 5 or success % 50 == 0:
                logger.info(f"  저장: {iso_date} {sign}{val:,.0f}억원")
        except Exception as e:
            failed += 1
            logger.error(f"  저장 실패 {iso_date}: {e}")

        time.sleep(API_SLEEP)

    # ── 결과 요약 ─────────────────────────────────────────────────────────────
    logger.info("\n" + "=" * 55)
    logger.info(f"  성공: {success}일  스킵: {skipped}일  실패: {failed}일")
    if success > 0 and not args.dry_run:
        logger.info("\n  ✅ 완료! 다음 단계:")
        logger.info("     python scripts/compute_backtest.py --reset")


if __name__ == "__main__":
    main()
