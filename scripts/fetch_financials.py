"""
fetch_financials.py
───────────────────
DART 사업보고서(연간)에서 매출액 / 영업이익 / 당기순이익 수집 → financials 테이블 upsert

사용법:
  python fetch_financials.py               # 전체 상장사, 직전 2개 연도
  python fetch_financials.py --year 2024   # 특정 연도만
  python fetch_financials.py --stock 005930 --year 2024  # 특정 종목

Cron (연 2회):
  0 2 5 4  * python fetch_financials.py   # 4월 5일  (대부분 제출 완료)
  0 2 15 4 * python fetch_financials.py   # 4월 15일 (늦게 제출한 기업 캐치)
"""

import os
import sys
import time
import logging
import argparse
import requests
from datetime import datetime
from supabase import create_client, Client

# ── 로깅 ──────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ── 상수 ──────────────────────────────────────────────────────────────────────
DART_API_KEY   = os.environ.get("DART_API_KEY", "")
SUPABASE_URL   = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

REPRT_CODE     = "11011"   # 사업보고서(연간)만 사용
RATE_LIMIT     = 0.7       # DART API 100 req/min 기준
BATCH_SIZE     = 50        # Supabase upsert 배치

# 금융업 sector 목록 (companies 테이블 기준)
FINANCIAL_SECTORS = {"금융", "금융지원서비스", "보험·연금", "지주회사(금융)"}

# 매출액 계정명 변형 (업종별 차이)
REVENUE_NAMES  = {"매출액", "수익(매출액)", "영업수익"}
# 영업이익 계정명 변형
OP_PROFIT_NAMES = {"영업이익", "영업이익(손실)"}
# 당기순이익 계정명 변형
NET_PROFIT_NAMES = {"당기순이익", "당기순이익(손실)"}


# ── Supabase / DART 초기화 ────────────────────────────────────────────────────
def _init():
    if not DART_API_KEY:
        logger.error("❌ DART_API_KEY 환경변수 누락")
        sys.exit(1)
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 누락")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ── 금융업 여부 조회 ──────────────────────────────────────────────────────────
def _load_financial_sector_set(sb: Client) -> set:
    """companies 테이블에서 금융업 stock_code 목록 로드"""
    result = sb.table("companies").select("stock_code, sector").execute()
    codes = set()
    for row in (result.data or []):
        if row.get("sector") in FINANCIAL_SECTORS:
            codes.add(row["stock_code"])
    logger.info(f"📌 금융업 종목 수: {len(codes)}")
    return codes


# ── dart_corp_codes → 상장사 목록 ─────────────────────────────────────────────
def _load_listed_corps(sb: Client, stock_code_filter: str | None) -> list[dict]:
    """stock_code가 있는 상장사만 반환 (비상장 제외)"""
    query = sb.table("dart_corp_codes").select("stock_code, corp_code, corp_name")
    if stock_code_filter:
        query = query.eq("stock_code", stock_code_filter)
    else:
        query = query.neq("stock_code", "").not_.is_("stock_code", "null")

    result = query.execute()
    corps = result.data or []
    logger.info(f"📋 대상 상장사: {len(corps)}개")
    return corps


# ── DART 재무제표 API 호출 ────────────────────────────────────────────────────
def _fetch_dart_financials(corp_code: str, year: int) -> dict | None:
    """
    DART fnlttSinglAcnt 호출 → {revenue, op_profit, net_profit} 반환
    데이터 없거나 net_profit 미확인이면 None
    """
    url = "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json"
    params = {
        "crtfc_key": DART_API_KEY,
        "corp_code": corp_code,
        "bsns_year": str(year),
        "reprt_code": REPRT_CODE,
    }
    try:
        res = requests.get(url, params=params, timeout=10)
        data = res.json()
    except Exception as e:
        logger.warning(f"  ⚠ DART 호출 실패: {e}")
        return None

    if data.get("status") != "000":
        return None

    revenue = op_profit = net_profit = None

    for item in data.get("list", []):
        name   = (item.get("account_nm") or "").strip()
        amount = item.get("thstrm_amount", "")
        if not amount:
            continue
        try:
            amount = int(str(amount).replace(",", "").replace(" ", ""))
        except ValueError:
            continue

        if name in REVENUE_NAMES and revenue is None:
            revenue = amount
        elif name in OP_PROFIT_NAMES and op_profit is None:
            op_profit = amount
        elif name in NET_PROFIT_NAMES and net_profit is None:
            net_profit = amount

    # 순이익은 필수 — 없으면 저장 의미 없음
    if net_profit is None:
        return None

    return {"revenue": revenue, "op_profit": op_profit, "net_profit": net_profit}


# ── Supabase upsert (배치) ────────────────────────────────────────────────────
def _flush(sb: Client, rows: list[dict]):
    sb.table("financials").upsert(rows, on_conflict="stock_code,fiscal_year").execute()
    logger.info(f"  [DB] {len(rows)}건 저장")


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year",  type=int, help="수집 연도 (기본: 직전 2개년)")
    parser.add_argument("--stock", type=str, help="특정 stock_code만 처리")
    args = parser.parse_args()

    sb = _init()
    financial_sector_codes = _load_financial_sector_set(sb)
    corps = _load_listed_corps(sb, args.stock)

    # 수집 연도 결정
    current_year = datetime.now().year
    years = [args.year] if args.year else [current_year - 1, current_year - 2]
    logger.info(f"📅 수집 연도: {years}")

    rows: list[dict] = []
    success = skip = fail = 0

    for i, corp in enumerate(corps):
        stock_code = corp["stock_code"]
        corp_code  = corp["corp_code"]
        corp_name  = corp.get("corp_name", stock_code)
        is_fin     = stock_code in financial_sector_codes

        for year in years:
            result = _fetch_dart_financials(corp_code, year)
            time.sleep(RATE_LIMIT)

            if result is None:
                skip += 1
                continue

            # 금융업이면 revenue / op_profit None 처리
            if is_fin:
                result["revenue"]    = None
                result["op_profit"]  = None

            rows.append({
                "stock_code":          stock_code,
                "fiscal_year":         year,
                "revenue":             result["revenue"],
                "op_profit":           result["op_profit"],
                "net_profit":          result["net_profit"],
                "is_financial_sector": is_fin,
                "updated_at":          datetime.now().isoformat(),
            })
            success += 1
            logger.info(f"  [{i+1}/{len(corps)}] {corp_name} ({stock_code}) {year} → "
                        f"rev={result['revenue']} op={result['op_profit']} net={result['net_profit']}")

            if len(rows) >= BATCH_SIZE:
                _flush(sb, rows)
                rows = []

    if rows:
        _flush(sb, rows)

    logger.info(f"\n[DONE] 성공={success} 스킵={skip} 실패={fail}")


if __name__ == "__main__":
    main()
