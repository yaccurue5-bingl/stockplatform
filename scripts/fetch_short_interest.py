"""
fetch_short_interest.py
───────────────────────
data.go.kr 주식대차종목순위조회 API → short_interest 테이블 upsert

사용법:
  python fetch_short_interest.py               # 최근 5 영업일
  python fetch_short_interest.py --days 30     # 최근 30일
  python fetch_short_interest.py --date 20250328       # 특정 날짜
  python fetch_short_interest.py --start 20250101 --end 20250328  # 날짜 범위

Cron (일 1회, 장 마감 후):
  0 18 * * 1-5  python fetch_short_interest.py --days 1
"""

import os
import sys
import time
import logging
import argparse
import requests
from datetime import datetime, timedelta
from supabase import create_client, Client

# ── 로깅 ──────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ── 상수 ──────────────────────────────────────────────────────────────────────
API_KEY       = os.environ.get("PUBLIC_DATA_API_KEY", "")
SUPABASE_URL  = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

BASE_URL      = (
    "https://apis.data.go.kr/1160100/service"
    "/GetStocLendBorrInfoService/getStLendAndBorrItemRank"
)
NUM_OF_ROWS   = 1000   # 최대 허용값
BATCH_SIZE    = 500    # Supabase upsert 배치
RATE_LIMIT    = 0.2    # 초 (5 req/s 이하 유지)
STOCK_CODE    = "21"   # lnbScrtDcd: 21 = 주식 (22 = 채권 제외)


# ── 초기화 ────────────────────────────────────────────────────────────────────
def _init() -> Client:
    if not API_KEY:
        logger.error("PUBLIC_DATA_API_KEY 환경변수 누락")
        sys.exit(1)
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE 환경변수 누락")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ── 날짜 유틸 ─────────────────────────────────────────────────────────────────
def _recent_business_days(n: int) -> list[str]:
    """최근 n 영업일(평일) 날짜 목록 (YYYYMMDD), 오늘 제외 과거 순"""
    days: list[str] = []
    d = datetime.now()
    while len(days) < n:
        d -= timedelta(days=1)
        if d.weekday() < 5:  # 0=월 … 4=금
            days.append(d.strftime("%Y%m%d"))
    return days


def _date_range(start: str, end: str) -> list[str]:
    """start~end 사이 평일 날짜 목록 (YYYYMMDD)"""
    s = datetime.strptime(start, "%Y%m%d")
    e = datetime.strptime(end,   "%Y%m%d")
    days: list[str] = []
    d = s
    while d <= e:
        if d.weekday() < 5:
            days.append(d.strftime("%Y%m%d"))
        d += timedelta(days=1)
    return days


# ── API 호출 ──────────────────────────────────────────────────────────────────
def fetch_date(date_str: str) -> list[dict]:
    """
    특정 날짜의 주식 대차잔고 전체 페이지 수집.
    휴장일이면 빈 리스트 반환.
    """
    all_items: list[dict] = []
    page_no = 1

    while True:
        # serviceKey를 URL에 직접 포함 (data.go.kr 이중 인코딩 방지)
        url = (
            f"{BASE_URL}"
            f"?serviceKey={API_KEY}"
            f"&pageNo={page_no}"
            f"&numOfRows={NUM_OF_ROWS}"
            f"&resultType=json"
            f"&basDt={date_str}"
        )
        try:
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            logger.warning(f"  [{date_str}] p{page_no} 호출 실패: {e}")
            break

        body  = data.get("response", {}).get("body", {})
        items = body.get("items", {})

        # 휴장일이면 items가 빈 문자열 또는 None
        if not items or items == "":
            break

        item_list = items.get("item", [])
        if not item_list:
            break

        # 단건 응답은 dict로 오는 경우가 있음
        if isinstance(item_list, dict):
            item_list = [item_list]

        # 주식(lnbScrtDcd=21)만 필터
        stock_items = [i for i in item_list if i.get("lnbScrtDcd") == STOCK_CODE]
        all_items.extend(stock_items)

        total_count = int(body.get("totalCount", 0))
        if len(all_items) >= total_count or len(item_list) < NUM_OF_ROWS:
            break

        page_no += 1
        time.sleep(RATE_LIMIT)

    return all_items


# ── Supabase upsert ───────────────────────────────────────────────────────────
def _flush(sb: Client, rows: list[dict]) -> None:
    sb.table("short_interest").upsert(
        rows, on_conflict="stock_code,date"
    ).execute()
    logger.info(f"  [DB] {len(rows)}건 저장")


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date",  type=str, help="특정 날짜 (YYYYMMDD)")
    parser.add_argument("--start", type=str, help="범위 시작 (YYYYMMDD)")
    parser.add_argument("--end",   type=str, help="범위 끝   (YYYYMMDD)")
    parser.add_argument("--days",  type=int, default=5,
                        help="최근 N 영업일 (기본 5)")
    args = parser.parse_args()

    sb = _init()

    # 날짜 목록 결정
    if args.date:
        dates = [args.date]
    elif args.start and args.end:
        dates = _date_range(args.start, args.end)
    else:
        dates = _recent_business_days(args.days)

    logger.info(f"수집 날짜 {len(dates)}일: {dates[0]} ~ {dates[-1]}")

    total_saved = 0

    for date_str in dates:
        items = fetch_date(date_str)
        time.sleep(RATE_LIMIT)

        if not items:
            logger.info(f"  [{date_str}] 데이터 없음 (휴장일)")
            continue

        # DB 행 변환
        rows: list[dict] = []
        for item in items:
            stock_code = (item.get("isinCd") or "").strip()
            if not stock_code:
                continue

            raw_bal = item.get("lnbBal")
            try:
                loan_balance = int(str(raw_bal).replace(",", ""))
            except (ValueError, TypeError):
                continue

            # date: YYYYMMDD → YYYY-MM-DD
            d = date_str
            rows.append({
                "stock_code":   stock_code,
                "date":         f"{d[:4]}-{d[4:6]}-{d[6:8]}",
                "loan_balance": loan_balance,
            })

        if not rows:
            logger.info(f"  [{date_str}] 유효 행 없음")
            continue

        # 배치 upsert
        for i in range(0, len(rows), BATCH_SIZE):
            _flush(sb, rows[i : i + BATCH_SIZE])

        total_saved += len(rows)
        logger.info(f"  [{date_str}] 총 {len(rows)}개 종목 저장 완료")

    logger.info(f"\n[DONE] 총 {total_saved}건 저장")


if __name__ == "__main__":
    main()
