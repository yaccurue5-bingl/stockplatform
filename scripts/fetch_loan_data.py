"""
scripts/fetch_loan_data.py
===========================
금융위원회_주식 대차정보 API로 종목별 대차잔여주식수(L_t) 수집.

API: GetStocLendBorrInfoService / getStLendAndBorrItemRank
URL: https://apis.data.go.kr/1160100/service/GetStocLendBorrInfoService/getStLendAndBorrItemRank

확인된 응답 필드 (dry-run 기준):
  isinCd          : 종목코드 (6자리 단축코드, A prefix 없음)
  isinCdNm        : 종목명
  lnbRmanStckCnt  : 대차잔여주식수 = L_t ← LPS 계산에 사용
  lnbCclStckCnt   : 대차체결주식수 (당일 신규)
  rdptStckCnt     : 상환주식수
  rcalRdptStckCnt : 리콜상환주식수
  lnbBal          : 대차잔고 금액(원) - 미사용
  lnbScrtDcd      : 증권구분코드 (21=주식)
  lnbScrtDcdNm    : 증권구분명 (주식/ETF 등) ← 필터용
  basDt           : 기준일자

주의:
  - 시장구분(mrktCtg) 없음 → lnbScrtDcdNm=="주식" 로 필터, 종목코드로 companies 조인
  - volume(거래량)은 fetch_market_data.py 가 loan_stats 에 별도 upsert
  - LPS 계산은 compute_loan_pressure.py 에서 수행

사용법:
  python scripts/fetch_loan_data.py --dry-run          # raw 필드 확인
  python scripts/fetch_loan_data.py                    # 전일 데이터 저장
  python scripts/fetch_loan_data.py --date 20260315    # 특정일
"""

import os
import sys
import argparse
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path

# KST = UTC+9 (외부 패키지 없이 처리)
KST = timezone(timedelta(hours=9))

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

ENDPOINT   = "https://apis.data.go.kr/1160100/service/GetStocLendBorrInfoService/getStLendAndBorrItemRank"
BATCH_SIZE = 100
PAGE_SIZE  = 1000

# 확인된 필드명
FIELD_STOCK_CODE    = "isinCd"          # 6자리 종목코드
FIELD_LOAN_BALANCE  = "lnbRmanStckCnt"  # 대차잔여주식수 = L_t
FIELD_SCRT_TYPE_NM  = "lnbScrtDcdNm"   # 증권구분명 (필터: "주식"만)


def get_target_business_day(ref: datetime = None) -> str:
    """
    data.go.kr 조회 기준일 반환 (YYYYMMDD).

    data.go.kr은 전일 데이터를 KST 오후 2시 이후에 갱신하므로:
    - KST 14:00 이후 → 전 영업일 데이터 사용 가능
    - KST 14:00 이전 → 전전 영업일 데이터 사용 (전일 미갱신)
    """
    now = ref or datetime.now(KST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=KST)

    if now.hour < 14:
        d = now.date() - timedelta(days=2)
    else:
        d = now.date() - timedelta(days=1)

    while d.weekday() >= 5:
        d -= timedelta(days=1)

    return d.strftime("%Y%m%d")


# ── API 호출 ──────────────────────────────────────────────────────────────────

def fetch_page(service_key: str, bas_dt: str, page_no: int) -> dict:
    params = {
        "serviceKey": service_key,
        "numOfRows":  PAGE_SIZE,
        "pageNo":     page_no,
        "resultType": "json",
        "basDt":      bas_dt,
    }
    resp = requests.get(ENDPOINT, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_all(service_key: str, bas_dt: str) -> list[dict]:
    """전체 페이지 순회하여 모든 종목 대차 데이터 수집"""
    all_items = []
    page_no = 1

    print(f"  GetStocLendBorrInfoService 호출 중 (기준일: {bas_dt})")

    while True:
        print(f"  페이지 {page_no} 조회중...", end=" ", flush=True)
        try:
            data = fetch_page(service_key, bas_dt, page_no)
        except requests.exceptions.ConnectionError:
            print("\n[ERROR] 네트워크 연결 실패.")
            sys.exit(1)
        except requests.exceptions.HTTPError as e:
            print(f"\n[ERROR] HTTP 오류: {e}")
            sys.exit(1)

        header = data.get("response", {}).get("header", {})
        result_code = header.get("resultCode", "")
        result_msg  = header.get("resultMsg", "")

        if result_code not in ("00", "0"):
            print(f"\n[ERROR] API 오류: {result_code} - {result_msg}")
            break

        body       = data.get("response", {}).get("body", {})
        items_wrap = body.get("items", {})

        if not items_wrap:
            print("데이터 없음 (영업일 아님 또는 API 키 문제)")
            break

        raw = items_wrap.get("item", [])
        if isinstance(raw, dict):
            raw = [raw]

        print(f"{len(raw)}건")
        all_items.extend(raw)

        total_count = int(body.get("totalCount", 0))
        if len(all_items) >= total_count or len(raw) < PAGE_SIZE:
            break

        page_no += 1

    return all_items


# ── 데이터 변환 ───────────────────────────────────────────────────────────────

def parse_int(val) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def transform(items: list[dict], bas_dt: str) -> list[dict]:
    """
    getStLendAndBorrItemRank 응답 → loan_stats 테이블 upsert용 딕셔너리

    - lnbScrtDcdNm == "주식" 만 포함 (ETF, 채권 등 제외)
    - 시장구분(KOSPI/KOSDAQ) 필터는 compute_loan_pressure.py에서 companies 조인으로 처리
    """
    rows = []
    skipped = 0
    date_str = str(datetime.strptime(bas_dt, "%Y%m%d").date())

    for item in items:
        # 주식만 필터 (ETF, 채권, 선물 등 제외)
        scrt_type = str(item.get(FIELD_SCRT_TYPE_NM) or "").strip()
        if scrt_type != "주식":
            skipped += 1
            continue

        stock_code = str(item.get(FIELD_STOCK_CODE) or "").strip().lstrip("A")
        if not stock_code:
            continue

        loan_balance = parse_int(item.get(FIELD_LOAN_BALANCE))

        rows.append({
            "stock_code":   stock_code,
            "date":         date_str,
            "loan_balance": loan_balance,
            # volume 컬럼은 fetch_market_data.py 가 별도 upsert
        })

    if skipped:
        print(f"  [INFO] 주식 외 증권 제외: {skipped}건 (ETF/채권 등)")

    return rows


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def save_to_db(rows: list[dict]) -> tuple[int, int]:
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지 미설치. pip install supabase")
        sys.exit(1)

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락")
        sys.exit(1)

    sb = create_client(url, key)
    success = failure = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        bn = i // BATCH_SIZE + 1
        try:
            sb.table("loan_stats").upsert(
                batch, on_conflict="stock_code,date"
            ).execute()
            success += len(batch)
            print(f"  Batch {bn} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] Batch {bn} 실패: {e}")

    return success, failure


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="주식 대차잔고 수집 (GetStocLendBorrInfoService)")
    parser.add_argument("--date",    help="기준일 (YYYYMMDD). 미지정 시 KST 기준 자동 계산")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 raw 필드 출력")
    args = parser.parse_args()

    service_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not service_key:
        print("[ERROR] PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    bas_dt = args.date or get_target_business_day()

    print("=" * 60)
    print("주식 대차잔고 수집 (GetStocLendBorrInfoService)")
    print(f"  기준일: {bas_dt}")
    print(f"  모드:   {'DRY-RUN' if args.dry_run else '실제 저장'}")
    print("=" * 60)

    # 1. API 조회
    items = fetch_all(service_key, bas_dt)

    if not items:
        print("[WARN] 조회된 데이터가 없습니다.")
        print("  - 영업일 확인 / KST 오후 2시 이후 재시도 / API 키 확인")
        sys.exit(0)

    print(f"  총 {len(items)}건 조회 완료")

    # DRY-RUN: raw 필드 출력
    if args.dry_run:
        print("\n[DRY-RUN] 첫 번째 항목 raw 필드 목록:")
        for k, v in sorted(items[0].items()):
            print(f"  {k:35s}: {v}")
        sys.exit(0)

    # 2. 변환 (주식만 필터)
    rows = transform(items, bas_dt)
    print(f"  변환 완료: {len(rows)}건 (주식)")

    # 3. 저장
    print(f"\n  Supabase 저장 중 ({len(rows)}건)...")
    success, failure = save_to_db(rows)

    print("=" * 60)
    print(f"완료: 성공 {success}건 / 실패 {failure}건")
    print("=" * 60)
    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
