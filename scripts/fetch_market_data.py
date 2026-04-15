"""
scripts/fetch_market_data.py
============================
금융위원회_주식시세정보 API로 KRX 상장종목 시장 데이터 수집.

API: GetStockSecuritiesInfoService / getStockPriceInfo
URL: https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo

수집 데이터:
  - stock_code          : 종목코드 (srtnCd, 'A' prefix 제거)
  - corp_name           : 종목명 (itmsNm)
  - market_type         : 시장구분 (mrktCtg): KOSPI / KOSDAQ
  - market_cap          : 시가총액 원 단위 (mrktTotAmt)
  - listed_shares       : 상장주식수 (lstgStckcnt)
  - foreign_hold_shares : 외국인 보유주식수 (frinInvstHldShrs)
  - foreign_ratio       : 외국인 보유비율 % (자동 계산)

데이터 생성 시점: 전일 기준, 한국시간 오후 1시 이후 갱신
실행 권장 시각: 매일 KST 14:00 이후

사용법:
  python scripts/fetch_market_data.py             # 전일 데이터
  python scripts/fetch_market_data.py --date 20260315  # 특정일
  python scripts/fetch_market_data.py --dry-run   # DB 저장 없이 raw 필드 확인
"""

import os
import sys
import argparse
import time
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path

# KST = UTC+9 (외부 패키지 없이 처리)
KST = timezone(timedelta(hours=9))

# ── supabase를 sys.path 수정 전에 먼저 import ─────────────────────────────────
# stockplatform/supabase/ 폴더가 설치된 supabase 패키지보다 먼저 검색되는
# 충돌을 방지하기 위해 반드시 sys.path.insert 전에 import해야 합니다.
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

ENDPOINT      = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"
BATCH_SIZE    = 100
PAGE_SIZE     = 1000
MAX_RETRIES   = 3    # 점검/일시 오류 시 재시도 횟수
RETRY_BACKOFF = 5    # 재시도 간 대기 초 (5 → 10 → 20초 지수 증가)


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

    # 14:00 이전이면 전일 데이터가 아직 없으므로 하루 더 이전으로
    if now.hour < 14:
        d = now.date() - timedelta(days=2)
    else:
        d = now.date() - timedelta(days=1)

    # 주말이면 금요일로
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


def fetch_page_with_retry(service_key: str, bas_dt: str, page_no: int) -> dict | None:
    """재시도 로직 포함 페이지 호출. 점검/일시 장애 시 None 반환."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fetch_page(service_key, bas_dt, page_no)
        except requests.exceptions.ConnectionError as e:
            wait = RETRY_BACKOFF * (2 ** (attempt - 1))
            print(f"\n[WARN] 네트워크 연결 실패 (시도 {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                print(f"  {wait}초 후 재시도...")
                time.sleep(wait)
            else:
                print("[ERROR] 최대 재시도 초과 — API 점검 중일 수 있습니다. 빈 결과 반환.")
                return None
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else "?"
            # 503 Service Unavailable: 점검 중 → 재시도
            if status in (429, 500, 502, 503, 504):
                wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                print(f"\n[WARN] HTTP {status} (시도 {attempt}/{MAX_RETRIES}). {wait}초 후 재시도...")
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
                else:
                    print("[ERROR] 최대 재시도 초과 — 빈 결과 반환.")
                    return None
            else:
                print(f"\n[ERROR] HTTP {status} — 재시도 불가 오류. 빈 결과 반환.")
                return None
        except requests.exceptions.Timeout:
            wait = RETRY_BACKOFF * (2 ** (attempt - 1))
            print(f"\n[WARN] 타임아웃 (시도 {attempt}/{MAX_RETRIES}). {wait}초 후 재시도...")
            if attempt < MAX_RETRIES:
                time.sleep(wait)
            else:
                print("[ERROR] 최대 재시도 초과 — 빈 결과 반환.")
                return None
    return None


def fetch_all(service_key: str, bas_dt: str) -> list[dict]:
    """전체 페이지 순회하여 모든 종목 수집. 오류 시 수집된 데이터 그대로 반환."""
    all_items = []
    page_no = 1

    print(f"  GetStockSecuritiesInfoService 호출 중 (기준일: {bas_dt})")

    while True:
        print(f"  페이지 {page_no} 조회중...", end=" ", flush=True)
        data = fetch_page_with_retry(service_key, bas_dt, page_no)
        if data is None:
            print(f"[WARN] 페이지 {page_no} 조회 실패. 지금까지 수집된 {len(all_items)}건으로 계속 진행.")
            break

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
        if isinstance(raw, dict):  # 단일 건인 경우 list로 변환
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


def transform(items: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    getStockPriceInfo 응답 → companies 테이블 + loan_stats 테이블 upsert용 딕셔너리

    응답 필드:
      srtnCd          : 단축코드 (앞에 'A' 붙는 경우 있음)
      itmsNm          : 종목명
      mrktCtg         : 시장구분 (KOSPI/KOSDAQ)
      mrktTotAmt      : 시가총액
      lstgStCnt       : 상장주식수 (주의: lstgStckcnt 아님)
      frinInvstHldShrs: 외국인 보유주식수 (이 API 미제공 → 항상 None)
      trqu            : 거래량 (V_t, loan_stats.volume 에 저장)

    반환: (companies_rows, volume_rows)
    """
    company_rows = []
    volume_rows  = []
    missing_foreign = 0

    for item in items:
        mrkt = str(item.get("mrktCtg") or "").strip()
        if mrkt not in ("KOSPI", "KOSDAQ"):
            continue

        stock_code = str(item.get("srtnCd") or "").strip().lstrip("A")
        if not stock_code:
            continue

        listed_shares     = parse_int(item.get("lstgStCnt"))
        foreign_hold_shrs = parse_int(item.get("frinInvstHldShrs"))  # 이 API 미제공

        if foreign_hold_shrs is None:
            missing_foreign += 1

        foreign_ratio = None
        if foreign_hold_shrs is not None and listed_shares and listed_shares > 0:
            foreign_ratio = round(foreign_hold_shrs / listed_shares * 100, 2)

        company_rows.append({
            "stock_code":          stock_code,
            "corp_name":           str(item.get("itmsNm") or "").strip(),
            "market_type":         mrkt,
            "market_cap":          parse_int(item.get("mrktTotAmt")),
            "listed_shares":       listed_shares,
            "foreign_hold_shares": foreign_hold_shrs,
            "foreign_ratio":       foreign_ratio,
            "updated_at":          datetime.now().isoformat(),
        })

        # 거래량 → loan_stats.volume (V_t, LPS 계산에 사용)
        volume = parse_int(item.get("trqu"))
        if volume is not None:
            volume_rows.append({
                "stock_code": stock_code,
                "date":       None,   # save_to_db에서 bas_dt 주입
                "volume":     volume,
            })

    if missing_foreign > 0:
        print(f"\n  [WARN] frinInvstHldShrs 없는 종목: {missing_foreign}건")
        print("    → API 응답에 외국인 보유주식수 필드가 없을 수 있습니다.")

    return company_rows, volume_rows


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def save_to_db(
    company_rows: list[dict],
    volume_rows:  list[dict],
    bas_dt: str,
) -> tuple[int, int]:
    """
    배치 upsert.
      - companies 테이블: stock_code 기준 upsert
      - loan_stats 테이블: (stock_code, date) 기준 volume 만 upsert
    반환: (성공수, 실패수)
    """
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지가 설치되지 않았습니다. pip install supabase")
        sys.exit(1)

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
        sys.exit(1)

    sb = create_client(url, key)
    success = failure = 0

    # ── 1. companies 테이블 ────────────────────────────────────────────────────
    # 같은 배치 내 stock_code 중복 시 companies_pkey 충돌 방지 → 마지막 row 우선 유지
    seen_sc: dict[str, dict] = {}
    for row in company_rows:
        seen_sc[row["stock_code"]] = row
    deduped_company_rows = list(seen_sc.values())

    for i in range(0, len(deduped_company_rows), BATCH_SIZE):
        batch = deduped_company_rows[i:i + BATCH_SIZE]
        bn = i // BATCH_SIZE + 1
        try:
            sb.table("companies").upsert(
                batch, on_conflict="stock_code"
            ).execute()
            success += len(batch)
            print(f"  [companies] Batch {bn} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] [companies] Batch {bn} 실패: {e}")

    # ── 2. loan_stats 테이블: volume 컬럼만 upsert ─────────────────────────────
    # bas_dt 주입 (transform 시점에는 날짜 미정이므로 여기서 설정)
    date_str = str(datetime.strptime(bas_dt, "%Y%m%d").date())
    for row in volume_rows:
        row["date"] = date_str

    vol_success = vol_failure = 0
    for i in range(0, len(volume_rows), BATCH_SIZE):
        batch = volume_rows[i:i + BATCH_SIZE]
        bn = i // BATCH_SIZE + 1
        try:
            sb.table("loan_stats").upsert(
                batch, on_conflict="stock_code,date"
            ).execute()
            vol_success += len(batch)
            print(f"  [loan_stats/volume] Batch {bn} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            vol_failure += len(batch)
            print(f"  [ERROR] [loan_stats/volume] Batch {bn} 실패: {e}")

    print(f"  거래량 저장: 성공 {vol_success}건 / 실패 {vol_failure}건")
    failure += vol_failure

    return success, failure


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="KRX 시장 데이터 수집 (GetStockSecuritiesInfoService)")
    parser.add_argument("--date",    help="기준일 (YYYYMMDD). 미지정 시 전 영업일")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 raw 필드 확인")
    args = parser.parse_args()

    service_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not service_key:
        print("[ERROR] PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다.")
        print("  로컬: .env.local 에 PUBLIC_DATA_API_KEY=<키값> 추가")
        print("  GitHub Actions: 레포 Settings → Secrets → PUBLIC_DATA_API_KEY 등록 확인")
        sys.exit(1)

    bas_dt = args.date or get_target_business_day()

    print("=" * 60)
    print("KRX 시장 데이터 수집 (GetStockSecuritiesInfoService)")
    print(f"  기준일: {bas_dt}")
    print(f"  모드:   {'DRY-RUN (DB 저장 안함)' if args.dry_run else '실제 저장'}")
    print("=" * 60)

    # 1. API 조회
    items = fetch_all(service_key, bas_dt)

    if not items:
        print("[WARN] 조회된 종목이 없습니다.")
        print("  - 영업일 확인 (주말/공휴일은 데이터 없음)")
        print("  - 한국시간 오후 1시 이후에 전일 데이터 생성됨")
        print("  - API 키 승인 여부 확인: https://www.data.go.kr")
        sys.exit(0)

    print(f"  총 {len(items)}건 조회 완료")

    # DRY-RUN: 첫 번째 항목 raw 필드 출력
    if args.dry_run:
        print("\n[DRY-RUN] 첫 번째 항목 raw 필드 목록:")
        for k, v in sorted(items[0].items()):
            print(f"  {k:30s}: {v}")
        print()

    # 2. 변환
    company_rows, volume_rows = transform(items)
    kospi_cnt  = sum(1 for r in company_rows if r["market_type"] == "KOSPI")
    kosdaq_cnt = sum(1 for r in company_rows if r["market_type"] == "KOSDAQ")
    has_cap    = sum(1 for r in company_rows if r["market_cap"] is not None)
    has_ratio  = sum(1 for r in company_rows if r["foreign_ratio"] is not None)

    print(f"  변환 완료: KOSPI {kospi_cnt}개 / KOSDAQ {kosdaq_cnt}개")
    print(f"  시가총액 데이터: {has_cap}/{len(company_rows)}건")
    print(f"  외국인 보유비율: {has_ratio}/{len(company_rows)}건")
    print(f"  거래량 데이터:   {len(volume_rows)}건 → loan_stats.volume")

    if args.dry_run:
        print("\n[DRY-RUN] 샘플 데이터 (상위 5건):")
        for r in company_rows[:5]:
            cap_str = f"{r['market_cap']:>15,}" if r['market_cap'] else "           None"
            print(f"  {r['stock_code']:6s} | {r['corp_name']:20s} | {r['market_type']:6s} | 시총: {cap_str}")
        print("\n[DRY-RUN] DB 저장 생략. 실제 저장하려면 --dry-run 제거 후 실행.")
        sys.exit(0)

    # 3. 저장
    print(f"\n  Supabase 저장 중 (companies {len(company_rows)}건, loan_stats volume {len(volume_rows)}건)...")
    success, failure = save_to_db(company_rows, volume_rows, bas_dt)

    print("=" * 60)
    print(f"완료: 성공 {success}건 / 실패 {failure}건")
    print("=" * 60)
    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
