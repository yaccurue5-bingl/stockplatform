"""
fetch_listed_shares.py
──────────────────────
data.go.kr GetStockSecuritiesInfoService/getStockPriceInfo →
companies.listed_shares 업데이트

주식대차 Short Interest % 계산용:
  short_interest % = loan_shares / listed_shares * 100

사용법:
  python fetch_listed_shares.py            # 전체 상장사
  python fetch_listed_shares.py --stock 005930

Cron (월 1회):
  0 9 1 * *  python fetch_listed_shares.py
"""

import os
import sys
import time
import logging
import argparse
import requests
from datetime import datetime, timedelta
from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

API_KEY      = os.environ.get("PUBLIC_DATA_API_KEY", "")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

BASE_URL     = (
    "https://apis.data.go.kr/1160100/service"
    "/GetStockSecuritiesInfoService/getStockPriceInfo"
)
RATE_LIMIT   = 0.15   # 초
BATCH_SIZE   = 200


def _init() -> Client:
    if not API_KEY:
        logger.error("PUBLIC_DATA_API_KEY 환경변수 누락")
        sys.exit(1)
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE 환경변수 누락")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _latest_trading_day() -> str:
    """최근 영업일 YYYYMMDD"""
    d = datetime.now()
    # 오늘이 월요일(0)이면 금요일(3일 전), 일요일(6)이면 금요일(2일 전)
    if d.weekday() == 0:
        d -= timedelta(days=3)
    elif d.weekday() == 6:
        d -= timedelta(days=2)
    else:
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


def fetch_listed_shares(stock_code: str, bas_dt: str) -> int | None:
    """단일 종목의 상장주식수 조회"""
    url = (
        f"{BASE_URL}"
        f"?serviceKey={API_KEY}"
        f"&pageNo=1&numOfRows=1&resultType=json"
        f"&basDt={bas_dt}&likeSrtnCd={stock_code}"
    )
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        body = r.json().get("response", {}).get("body", {})
        items = body.get("items", {})
        if not items or items == "":
            return None
        item = items.get("item", [])
        if isinstance(item, list):
            item = item[0] if item else {}
        val = item.get("lstgStCnt")
        return int(str(val).replace(",", "")) if val else None
    except Exception as e:
        logger.warning(f"  [{stock_code}] 조회 실패: {e}")
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stock", type=str, help="특정 stock_code만 처리")
    args = parser.parse_args()

    sb     = _init()
    bas_dt = _latest_trading_day()
    today  = datetime.now().date().isoformat()
    logger.info(f"기준일: {bas_dt}")

    # 대상 종목 로드
    query = sb.table("companies").select("stock_code")
    if args.stock:
        query = query.eq("stock_code", args.stock)
    else:
        query = query.neq("stock_code", "").not_.is_("stock_code", "null")
    result  = query.execute()
    stocks  = [r["stock_code"] for r in (result.data or []) if r.get("stock_code")]
    logger.info(f"대상 종목: {len(stocks)}개")

    updated = 0
    skipped = 0
    rows: list[dict] = []

    for i, code in enumerate(stocks):
        shares = fetch_listed_shares(code, bas_dt)
        time.sleep(RATE_LIMIT)

        if shares is None:
            skipped += 1
            continue

        rows.append({
            "stock_code":             code,
            "listed_shares":          shares,
            "listed_shares_updated":  today,
        })
        updated += 1

        if len(rows) >= BATCH_SIZE:
            _flush(sb, rows)
            rows = []

        if (i + 1) % 100 == 0:
            logger.info(f"  [{i+1}/{len(stocks)}] 진행 중 (저장={updated}, 스킵={skipped})")

    if rows:
        _flush(sb, rows)

    logger.info(f"\n[DONE] 업데이트={updated} 스킵={skipped}")


def _flush(sb: Client, rows: list[dict]) -> None:
    # upsert 대신 UPDATE만 — 기존 companies 행에만 업데이트 (신규 INSERT 방지)
    for row in rows:
        sb.table("companies").update({
            "listed_shares":         row["listed_shares"],
            "listed_shares_updated": row["listed_shares_updated"],
        }).eq("stock_code", row["stock_code"]).execute()
    logger.info(f"  [DB] {len(rows)}건 업데이트")


if __name__ == "__main__":
    main()
