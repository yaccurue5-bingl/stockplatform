"""
scripts/fetch_stock_securities.py
===================================
금융위원회_주식시세정보 API로 외국인 보유 현황 및 시세 수집.

API: GetStockSecuritiesInfoService / getStockPriceInfo
URL: https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo

수집 데이터:
  - foreign_hold_shares : 외국인 보유주식수 (frinInvstHldShrs)
  - foreign_ratio       : 외국인 보유비율 % (frinInvstHldShrs / lstgStckcnt * 100, 자동 계산)

참고:
  - 기관 순매수/외국인 순매수(daily trading by investor type)는
    이 API에 포함되지 않음. KRX 데이터 재배포 금지로 대체 불가.
  - frinInvstHldShrs: 외국인 투자자(금융감독원 등록)가 보유한 주식수
  - 데이터 생성: 전일 기준, 한국시간 오후 1시 이후 갱신

사용법:
  python scripts/fetch_stock_securities.py             # 전 영업일 전체
  python scripts/fetch_stock_securities.py --date 20260313
  python scripts/fetch_stock_securities.py --dry-run
"""

import os
import sys
import argparse
import requests
from datetime import datetime, timedelta
from pathlib import Path

# ── supabase를 sys.path 수정 전에 먼저 import ─────────────────────────────────
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

ENDPOINT   = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"
BATCH_SIZE = 100
PAGE_SIZE  = 1000


def get_prev_business_day(ref: datetime = None) -> str:
    d = ref or datetime.now()
    d -= timedelta(days=1)
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
    all_items = []
    page_no = 1

    print(f"  GetStockSecuritiesInfoService 호출 중 (기준일: {bas_dt})")

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


def parse_float(val) -> float | None:
    if val is None or val == "":
        return None
    try:
        return round(float(str(val).replace(",", "").strip()), 4)
    except (ValueError, TypeError):
        return None


def transform(items: list[dict]) -> list[dict]:
    """
    getStockPriceInfo 응답 → companies 업데이트용 딕셔너리

    응답 필드:
      srtnCd         : 단축코드 (종목코드, 앞에 'A' 붙는 경우 있음)
      mrktCtg        : 시장구분 (KOSPI/KOSDAQ)
      lstgStckcnt    : 상장주식수
      frinInvstHldShrs: 외국인 보유주식수

    주의:
      - frinInvstHldShrs 가 없는 API 버전도 있음 (필드명 확인 필요)
      - foreign_ratio = frinInvstHldShrs / lstgStckcnt * 100
    """
    rows = []
    missing_foreign = 0

    for item in items:
        mrkt = str(item.get("mrktCtg") or "").strip()
        if mrkt not in ("KOSPI", "KOSDAQ"):
            continue

        stock_code = str(item.get("srtnCd") or "").strip().lstrip("A")
        if not stock_code:
            continue

        listed_shares     = parse_int(item.get("lstgStckcnt"))
        foreign_hold_shrs = parse_int(item.get("frinInvstHldShrs"))

        # API 응답에 frinInvstHldShrs 없는 경우 집계
        if foreign_hold_shrs is None:
            missing_foreign += 1

        # 외국인 보유비율 계산
        foreign_ratio = None
        if foreign_hold_shrs is not None and listed_shares and listed_shares > 0:
            foreign_ratio = round(foreign_hold_shrs / listed_shares * 100, 2)

        row = {
            "stock_code":          stock_code,
            "foreign_hold_shares": foreign_hold_shrs,
            "foreign_ratio":       foreign_ratio,
            "updated_at":          datetime.now().isoformat(),
        }

        # listed_shares는 이미 fetch_krx로 채워지므로 덮어쓰기 방지
        # (None이면 업데이트하지 않음)
        if listed_shares is not None:
            row["listed_shares"] = listed_shares

        rows.append(row)

    if missing_foreign > 0:
        print(f"\n  [WARN] frinInvstHldShrs 없는 종목: {missing_foreign}건")
        print("    → API 응답에 외국인 보유주식수 필드가 없을 수 있습니다.")
        print("    → 실제 응답 필드명을 확인하세요 (--dry-run 으로 raw 데이터 출력 가능)")

    return rows


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def save_to_db(rows: list[dict]) -> tuple[int, int]:
    """배치 upsert → (성공수, 실패수)"""
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
            sb.table("companies").upsert(
                batch, on_conflict="stock_code"
            ).execute()
            success += len(batch)
            print(f"  Batch {bn} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] Batch {bn} 실패: {e}")

    return success, failure


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="주식시세 + 외국인 보유 현황 수집 (GetStockSecuritiesInfoService)")
    parser.add_argument("--date",    help="기준일 (YYYYMMDD). 미지정 시 전 영업일")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 출력 (raw 필드 확인용)")
    args = parser.parse_args()

    service_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not service_key:
        print("[ERROR] PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    bas_dt = args.date or get_prev_business_day()

    print("=" * 60)
    print("주식시세 + 외국인 보유 현황 수집 (GetStockSecuritiesInfoService)")
    print(f"  기준일: {bas_dt}")
    print(f"  모드:   {'DRY-RUN' if args.dry_run else '실제 저장'}")
    print("=" * 60)

    # 1. API 조회
    items = fetch_all(service_key, bas_dt)

    if not items:
        print("[WARN] 조회된 데이터가 없습니다.")
        print("  - 영업일 확인 (주말/공휴일은 데이터 없음)")
        print(f"  - KST 오후 1시 이후 전일 데이터 생성")
        sys.exit(0)

    print(f"  총 {len(items)}건 조회 완료")

    # DRY-RUN: 첫 번째 항목의 모든 필드 출력 (필드명 확인용)
    if args.dry_run:
        print("\n[DRY-RUN] 첫 번째 항목 raw 필드 목록:")
        first = items[0] if items else {}
        for k, v in sorted(first.items()):
            print(f"  {k:30s}: {v}")
        print()

    # 2. 변환
    rows = transform(items)
    kospi_cnt  = sum(1 for i in items if str(i.get("mrktCtg", "")).strip() == "KOSPI")
    kosdaq_cnt = sum(1 for i in items if str(i.get("mrktCtg", "")).strip() == "KOSDAQ")

    has_foreign = sum(1 for r in rows if r["foreign_hold_shares"] is not None)
    has_ratio   = sum(1 for r in rows if r["foreign_ratio"] is not None)

    print(f"  변환 완료: KOSPI {kospi_cnt}개 / KOSDAQ {kosdaq_cnt}개")
    print(f"  외국인 보유주식수 데이터: {has_foreign}/{len(rows)}건")
    print(f"  외국인 보유비율 계산 완료: {has_ratio}/{len(rows)}건")

    if args.dry_run:
        print("\n[DRY-RUN] 샘플 (상위 5건):")
        for r in rows[:5]:
            print(f"  {r['stock_code']:6s} | 보유주식수: {r['foreign_hold_shares']} | "
                  f"보유비율: {r['foreign_ratio']}%")
        print("\n[DRY-RUN] DB 저장 생략.")
        sys.exit(0)

    # 3. 저장
    print(f"\n  Supabase 저장 중 ({len(rows)}건)...")
    success, failure = save_to_db(rows)

    print("=" * 60)
    print(f"완료: 성공 {success}건 / 실패 {failure}건")
    print("=" * 60)
    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
