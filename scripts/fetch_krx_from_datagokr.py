"""
scripts/fetch_krx_from_datagokr.py
====================================
data.go.kr 공공데이터 API를 통해 KRX 상장종목 정보 수집

API: 금융위원회_KRX상장종목정보 (15094775)
Endpoint: https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo

제공 데이터:
  - 종목코드 (srtnCd)
  - 종목명 (itmsNm)
  - 시장구분 (mrktCtg): KOSPI / KOSDAQ
  - 시가총액 (mrktTotAmt): 원 단위
  - 상장주식수 (lstgStckcnt)

미제공 데이터:
  - 외국인보유비율 (foreign_ratio): 별도 API 필요

데이터 생성 시점: 전일 기준, 한국시간 오후 1시 이후 갱신
실행 권장 시각: 매일 KST 14:00 이후

사용법:
  python scripts/fetch_krx_from_datagokr.py             # 전일 데이터
  python scripts/fetch_krx_from_datagokr.py --date 20260315  # 특정일
  python scripts/fetch_krx_from_datagokr.py --dry-run   # DB 저장 없이 테스트
"""

import os
import sys
import argparse
import requests
from datetime import datetime, timedelta
from pathlib import Path

# ── supabase를 sys.path 수정 전에 먼저 import ─────────────────────────────────
# stockplatform/supabase/ 폴더가 설치된 supabase 패키지보다 먼저 검색되는
# 충돌을 방지하기 위해 반드시 sys.path.insert 전에 import해야 합니다.
try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None

# 프로젝트 루트를 Python path에 추가
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

# ── 설정 ──────────────────────────────────────────────────────────────────────

API_BASE = "https://apis.data.go.kr/1160100/service/GetKrxListedInfoService"
ENDPOINT = f"{API_BASE}/getItemInfo"
BATCH_SIZE = 100   # Supabase upsert 배치 크기
PAGE_SIZE  = 1000  # API 1회 호출당 최대 조회수


def get_prev_business_day(ref: datetime = None) -> str:
    """전 영업일 날짜 반환 (YYYYMMDD). 주말은 금요일로."""
    d = ref or datetime.now()
    d -= timedelta(days=1)
    while d.weekday() >= 5:  # 5=토, 6=일
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


# ── API 호출 ──────────────────────────────────────────────────────────────────

def fetch_page(service_key: str, bas_dt: str, page_no: int) -> dict:
    """API 단일 페이지 호출"""
    params = {
        "serviceKey": service_key,
        "numOfRows": PAGE_SIZE,
        "pageNo": page_no,
        "resultType": "json",
        "basDt": bas_dt,
    }
    resp = requests.get(ENDPOINT, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_all_items(service_key: str, bas_dt: str) -> list[dict]:
    """전체 페이지 순회하여 모든 종목 수집"""
    all_items = []
    page_no = 1

    print(f"  data.go.kr API 호출 중 (기준일: {bas_dt})")

    while True:
        print(f"  페이지 {page_no} 조회중...", end=" ", flush=True)
        data = fetch_page(service_key, bas_dt, page_no)

        header = data.get("response", {}).get("header", {})
        result_code = header.get("resultCode", "")
        result_msg  = header.get("resultMsg", "")

        if result_code not in ("00", "0"):
            print(f"\n[ERROR] API 오류: {result_code} - {result_msg}")
            break

        body  = data.get("response", {}).get("body", {})
        items_wrap = body.get("items", {})

        # 결과가 없으면 종료
        if not items_wrap:
            print("데이터 없음 (영업일 아님 또는 API 키 문제)")
            break

        raw = items_wrap.get("item", [])
        if isinstance(raw, dict):   # 단일 건인 경우 list로 변환
            raw = [raw]

        print(f"{len(raw)}건")
        all_items.extend(raw)

        total_count = int(body.get("totalCount", 0))
        if len(all_items) >= total_count or len(raw) < PAGE_SIZE:
            break

        page_no += 1

    return all_items


# ── 데이터 변환 ───────────────────────────────────────────────────────────────

def parse_int(value) -> int | None:
    """콤마 포함 숫자 문자열 → int"""
    if value is None or value == "":
        return None
    try:
        return int(str(value).replace(",", ""))
    except (ValueError, TypeError):
        return None


def transform(items: list[dict], bas_dt: str) -> list[dict]:
    """API 응답 → companies 테이블 upsert용 딕셔너리"""
    rows = []
    for item in items:
        mrkt = item.get("mrktCtg", "").strip()
        # KOSPI / KOSDAQ 만 허용 (KONEX 등 제외)
        if mrkt not in ("KOSPI", "KOSDAQ"):
            continue

        stock_code = str(item.get("srtnCd", "")).strip().lstrip("A")
        if not stock_code:
            continue

        rows.append({
            "stock_code":    stock_code,
            "corp_name":     item.get("itmsNm", "").strip(),
            "market_type":   mrkt,
            "market_cap":    parse_int(item.get("mrktTotAmt")),
            "listed_shares": parse_int(item.get("lstgStckcnt")),
            "updated_at":    datetime.now().isoformat(),
        })
    return rows


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def save_to_db(rows: list[dict]) -> tuple[int, int]:
    """배치 upsert. (성공수, 실패수) 반환"""
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지가 설치되지 않았습니다.")
        print("  pip install supabase 를 실행하세요.")
        sys.exit(1)

    sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not sb_url or not sb_key:
        print("[ERROR] Supabase 환경변수 누락 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
        sys.exit(1)

    supabase = create_client(sb_url, sb_key)
    success = 0
    failure = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        try:
            supabase.table("companies").upsert(
                batch,
                on_conflict="stock_code"
            ).execute()
            success += len(batch)
            print(f"  Batch {batch_num} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] Batch {batch_num} 실패: {e}")

    return success, failure


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="KRX 상장종목 정보 수집 (data.go.kr)")
    parser.add_argument("--date",    help="기준일 (YYYYMMDD). 미지정 시 전 영업일")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 조회만 테스트")
    args = parser.parse_args()

    service_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not service_key:
        print("[ERROR] PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다.")
        print("  frontend/.env.local 또는 .env.local 에 추가하세요.")
        sys.exit(1)

    bas_dt = args.date or get_prev_business_day()

    print("=" * 60)
    print("KRX 상장종목 정보 수집 (data.go.kr)")
    print(f"  기준일: {bas_dt}")
    print(f"  모드:   {'DRY-RUN (DB 저장 안함)' if args.dry_run else '실제 저장'}")
    print("=" * 60)

    # 1. API 조회
    try:
        items = fetch_all_items(service_key, bas_dt)
    except requests.exceptions.HTTPError as e:
        print(f"[ERROR] API HTTP 오류: {e}")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        print("[ERROR] 네트워크 연결 실패. 인터넷 연결을 확인하세요.")
        sys.exit(1)

    if not items:
        print("[WARN] 조회된 종목이 없습니다.")
        print("  - 영업일 확인 (주말/공휴일은 데이터 없음)")
        print(f"  - 한국시간 오후 1시 이후에 전일 데이터 생성됨")
        print(f"  - API 키 승인 여부 확인: https://www.data.go.kr")
        sys.exit(0)

    print(f"  총 {len(items)}건 조회 완료")

    # 2. 변환
    rows = transform(items, bas_dt)
    kospi_cnt  = sum(1 for r in rows if r["market"] == "KOSPI")
    kosdaq_cnt = sum(1 for r in rows if r["market"] == "KOSDAQ")
    print(f"  변환 완료: KOSPI {kospi_cnt}개 / KOSDAQ {kosdaq_cnt}개")

    # 3. 저장 (dry-run 시 샘플 출력 후 종료)
    if args.dry_run:
        print("\n[DRY-RUN] 샘플 데이터 (상위 3건):")
        for row in rows[:3]:
            print(f"  {row['stock_code']} | {row['corp_name']:20s} | "
                  f"{row['market']:6s} | "
                  f"시가총액: {row['market_cap']:,}" if row['market_cap'] else f"  {row['stock_code']} | {row['corp_name']}")
        print("\n[DRY-RUN] DB 저장 생략. 실제 저장하려면 --dry-run 제거 후 실행.")
        sys.exit(0)

    print(f"\n  Supabase 저장 중 ({len(rows)}건)...")
    success, failure = save_to_db(rows)

    print("=" * 60)
    print(f"완료: 성공 {success}건 / 실패 {failure}건")
    print("=" * 60)

    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
