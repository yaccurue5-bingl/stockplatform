"""
scripts/backfill_foreign_flow.py
=================================
data.go.kr 금융위원회 투자자별 거래실적 API로
daily_indicators.foreign_net_buy_kospi 과거 데이터 백필.

일회성 스크립트: compute_backtest.py 의 시장 레짐 판단을 위해
daily_indicators 에 외국인 순매수 히스토리가 필요하나
fetch_mofe_indicator.py(HWP 파이프라인)가 최근에 추가되어 과거 데이터가 없음.
이 스크립트로 한 번 채우면 이후는 EOD 파이프라인이 자동 관리.

API:
  서비스: GetStockInvestorTradingVolumeService
  오퍼레이션: getStockInvestorTradingVolume
  URL: https://apis.data.go.kr/1160100/service/
         GetStockInvestorTradingVolumeService/getStockInvestorTradingVolume
  제공: 금융위원회 / data.go.kr
  단위: 순매수거래대금 → 원 → ÷1억 → 억원

주의:
  - 기존 daily_indicators 레코드에서 foreign_net_buy_kospi 만 업데이트
    (kospi_close, usd_krw 등 HWP 파이프라인 데이터는 덮어쓰지 않음)
  - 이미 값이 있는 날짜는 --force 옵션 없이는 스킵

사용법:
  python scripts/backfill_foreign_flow.py               # 최근 90일
  python scripts/backfill_foreign_flow.py --days 180    # 최근 180일
  python scripts/backfill_foreign_flow.py --dry-run     # 저장 없이 결과 확인
  python scripts/backfill_foreign_flow.py --force       # 기존 값도 덮어쓰기
  python scripts/backfill_foreign_flow.py --probe       # 첫 날 API 응답 구조만 출력
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

API_BASE    = (
    "https://apis.data.go.kr/1160100/service"
    "/GetStockInvestorTradingVolumeService"
    "/getStockInvestorTradingVolume"
)
API_SLEEP   = 1.0    # data.go.kr 호출 간 sleep (초)
PAGE_SIZE   = 50     # 투자자 유형 수 (넉넉하게)

# 외국인 투자자 행을 식별하는 키워드 (invstTpNm 필드)
FOREIGN_KEYWORDS = ["외국인", "외국인계"]

# 순매수거래대금 필드 후보 (API 버전마다 다를 수 있음)
NET_BUY_AMT_FIELDS = [
    "netBuyTrdAmt",      # 순매수거래대금
    "frinInvstNetBuyTrdAmt",  # 외국인순매수거래대금 (일부 버전)
    "ntBuyTrqty",
]


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


# ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────

def is_business_day(d: date) -> bool:
    return d.weekday() < 5   # 토(5) 일(6) 제외


def business_days_back(n: int) -> list[date]:
    """오늘로부터 최대 n 달력일 이전까지 영업일 목록 (내림차순)"""
    result = []
    cur = date.today() - timedelta(days=1)  # 어제부터 (당일 데이터는 +1일 lag)
    limit = date.today() - timedelta(days=n)
    while cur >= limit:
        if is_business_day(cur):
            result.append(cur)
        cur -= timedelta(days=1)
    return result


# ── data.go.kr API ────────────────────────────────────────────────────────────

def fetch_investor_trading(bas_dt: str, api_key: str) -> list[dict]:
    """
    특정 날짜의 KOSPI 투자자별 거래실적 조회.
    반환: 전체 row 리스트 (외국인 필터링은 caller에서)
    공휴일/주말은 빈 리스트 반환.
    """
    params = {
        "serviceKey": api_key,
        "numOfRows":  PAGE_SIZE,
        "pageNo":     1,
        "resultType": "json",
        "basDt":      bas_dt,
        "mrktCls":    "KOSPI",
    }

    try:
        resp = requests.get(API_BASE, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning(f"  API 오류 [{bas_dt}]: {e}")
        return []

    items = (
        data.get("response", {})
            .get("body", {})
            .get("items", {})
            .get("item", [])
    )

    if isinstance(items, dict):   # 단일 item인 경우
        items = [items]

    return items or []


def extract_foreign_net_buy(items: list[dict]) -> float | None:
    """
    투자자별 거래실적 rows에서 외국인 순매수거래대금(원) 추출 → 억원 변환.
    반환: float(억원) | None
    """
    if not items:
        return None

    for row in items:
        # 투자자 유형 필드 탐색
        inv_type = str(row.get("invstTpNm") or row.get("invstorNm") or "")
        if not any(kw in inv_type for kw in FOREIGN_KEYWORDS):
            continue

        # 순매수거래대금 필드 탐색
        for field in NET_BUY_AMT_FIELDS:
            raw = row.get(field)
            if raw is None or raw == "":
                continue
            try:
                won = float(str(raw).replace(",", ""))
                return round(won / 1e8, 2)   # 원 → 억원
            except (ValueError, TypeError):
                continue

    return None


# ── 기존 DB 데이터 조회 ───────────────────────────────────────────────────────

def fetch_existing_dates(sb, date_strs: list[str]) -> set[str]:
    """
    daily_indicators 에 이미 foreign_net_buy_kospi 가 있는 날짜 반환.
    날짜 형식: YYYYMMDD (DB가 그렇게 저장하므로)
    """
    existing: set[str] = set()
    chunk = 200
    for i in range(0, len(date_strs), chunk):
        batch = date_strs[i:i + chunk]
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
            logger.warning(f"  기존 데이터 조회 실패: {e}")
    return existing


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="data.go.kr 외국인 순매수 KOSPI 백필 → daily_indicators"
    )
    parser.add_argument("--days",    type=int,  default=90,
                        help="소급 달력일 수 (기본 90일)")
    parser.add_argument("--dry-run", action="store_true",
                        help="계산만, DB 저장 안 함")
    parser.add_argument("--force",   action="store_true",
                        help="이미 값이 있는 날짜도 덮어쓰기")
    parser.add_argument("--probe",   action="store_true",
                        help="첫 영업일 API 응답 구조만 출력하고 종료")
    args = parser.parse_args()

    logger.info("=" * 55)
    logger.info("  backfill_foreign_flow : 외국인 순매수 KOSPI 백필")
    logger.info(f"  days={args.days}  dry_run={args.dry_run}  "
                f"force={args.force}  probe={args.probe}")
    logger.info("=" * 55)

    api_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not api_key:
        logger.error("PUBLIC_DATA_API_KEY 환경변수 누락")
        sys.exit(1)

    sb = _get_supabase()

    # ── 대상 날짜 목록 ────────────────────────────────────────────────────────
    target_dates = business_days_back(args.days)
    logger.info(f"\n  대상 영업일: {len(target_dates)}일 "
                f"({target_dates[-1]} ~ {target_dates[0]})")

    # ── --probe: API 응답 구조 확인 후 종료 ───────────────────────────────────
    if args.probe:
        if not target_dates:
            logger.error("대상 날짜 없음")
            sys.exit(1)
        probe_date = target_dates[0]
        bas_dt = probe_date.strftime("%Y%m%d")
        logger.info(f"\n  [PROBE] {bas_dt} API 응답 구조 확인 중...")
        items = fetch_investor_trading(bas_dt, api_key)
        if not items:
            logger.warning("  빈 응답 (공휴일이거나 API 오류)")
        else:
            logger.info(f"  → {len(items)}개 row 반환")
            logger.info(f"  첫 번째 row 필드: {list(items[0].keys())}")
            for row in items:
                inv = row.get("invstTpNm") or row.get("invstorNm") or "(필드없음)"
                logger.info(f"    투자자유형: {inv}  | row: {row}")
        sys.exit(0)

    # ── 기존 데이터 확인 (--force 아닌 경우) ─────────────────────────────────
    date_strs = [d.strftime("%Y%m%d") for d in target_dates]
    if not args.force:
        existing = fetch_existing_dates(sb, date_strs)
        logger.info(f"  이미 값 있음: {len(existing)}일 (스킵 예정, --force 로 덮어쓰기 가능)")
    else:
        existing = set()
        logger.info("  --force: 기존 값 무시하고 전체 갱신")

    # ── API 호출 + 저장 ───────────────────────────────────────────────────────
    success = skip_existing = skip_nodata = 0
    fail    = 0

    for i, d in enumerate(target_dates, 1):
        bas_dt   = d.strftime("%Y%m%d")
        date_iso = d.isoformat()   # YYYY-MM-DD (Supabase date 컬럼)

        if bas_dt in existing:
            skip_existing += 1
            continue

        logger.info(f"  ({i}/{len(target_dates)}) {bas_dt} 조회 중...")
        items = fetch_investor_trading(bas_dt, api_key)

        if not items:
            logger.info(f"    → 데이터 없음 (공휴일/주말 또는 API 미제공)")
            skip_nodata += 1
            time.sleep(API_SLEEP)
            continue

        net_buy = extract_foreign_net_buy(items)

        if net_buy is None:
            logger.warning(f"    → 외국인 순매수 필드 추출 실패")
            logger.warning(f"       row 확인: {items[0].keys() if items else '(empty)'}")
            logger.warning(f"       --probe 옵션으로 API 응답 구조를 먼저 확인하세요")
            skip_nodata += 1
            time.sleep(API_SLEEP)
            continue

        sign = "+" if net_buy >= 0 else ""
        logger.info(f"    → 외국인 순매수: {sign}{net_buy:,.0f}억원")

        if not args.dry_run:
            try:
                # foreign_net_buy_kospi 만 upsert (다른 컬럼 보존)
                sb.table("daily_indicators").upsert(
                    {
                        "date":                  bas_dt,
                        "foreign_net_buy_kospi": net_buy,
                        "source":                "data.go.kr_투자자별거래실적",
                        "updated_at":            date_iso + "T00:00:00",
                    },
                    on_conflict="date",
                ).execute()
                success += 1
            except Exception as e:
                logger.error(f"    → 저장 실패: {e}")
                fail += 1
        else:
            logger.info(f"    [DRY] 저장 생략")
            success += 1

        time.sleep(API_SLEEP)

    # ── 결과 요약 ─────────────────────────────────────────────────────────────
    logger.info("\n" + "=" * 55)
    logger.info("  백필 결과 요약")
    logger.info("=" * 55)
    logger.info(f"  성공:      {success}일")
    logger.info(f"  스킵(기존): {skip_existing}일")
    logger.info(f"  스킵(데이터없음): {skip_nodata}일")
    logger.info(f"  실패:      {fail}일")

    if success > 0:
        logger.info("\n  ✅ 완료! 이제 compute_backtest.py 를 실행하세요:")
        logger.info("     python scripts/compute_backtest.py")
    elif skip_nodata > 0 and success == 0:
        logger.warning("\n  ⚠️  데이터를 가져오지 못했습니다.")
        logger.warning("  --probe 옵션으로 API 응답 구조를 먼저 확인하세요:")
        logger.warning("     python scripts/backfill_foreign_flow.py --probe")


if __name__ == "__main__":
    main()
