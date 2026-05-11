"""
scripts/fetch_index_data.py
============================
금융위원회 주가지수시세정보 API로 코스피/코스닥/코스피 200 지수 이력 수집.

API: GetMarketIndexInfoService / getStockMarketIndex
URL: https://apis.data.go.kr/1160100/service/GetMarketIndexInfoService/getStockMarketIndex

수집 지수 (API 실제 idxNm 기준):
  "코스피"    → KOSPI    (메인 벤치마크)
  "코스닥"    → KOSDAQ   (메인 벤치마크)
  "코스피 200" → KOSPI200 (DB 저장, 향후 활용)

동작:
  - idxNm URL 파라미터 필터는 서버에서 무시됨 → 전체 지수 조회 후 Python에서 exact 필터
  - date range 단위로 1회 API 호출 → 3개 지수 동시 수집

사용법:
  python scripts/fetch_index_data.py                     # 전 영업일 1일
  python scripts/fetch_index_data.py --date 20260315     # 특정일
  python scripts/fetch_index_data.py --backfill          # 2025-01-02 ~ 오늘 전체
  python scripts/fetch_index_data.py --backfill --from 20260101
  python scripts/fetch_index_data.py --dry-run           # DB 저장 없이 확인
"""

import os
import sys
import argparse
import time
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))

# ── supabase 충돌 방지 ────────────────────────────────────────────────────────
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

ENDPOINT      = "https://apis.data.go.kr/1160100/service/GetMarketIndexInfoService/getStockMarketIndex"
PAGE_SIZE     = 1000   # 한 페이지당 최대 행 수 (전체 지수 × 일수)
BATCH_SIZE    = 300    # Supabase upsert 배치 크기
MAX_RETRIES   = 3
RETRY_BACKOFF = 5

# API 실제 idxNm(exact) → DB 저장 코드 매핑
# ※ "코스피 200"은 공백 포함 (API 응답 그대로)
INDEX_MAP: dict[str, str] = {
    "코스피":     "KOSPI",
    "코스닥":     "KOSDAQ",
    "코스피 200": "KOSPI200",
}

BACKFILL_START = "20250102"   # price_history 시작일과 동일


# ── 영업일 헬퍼 ───────────────────────────────────────────────────────────────

def get_target_business_day(ref: datetime = None) -> str:
    """전 영업일 (YYYYMMDD). KST 14:00 이전이면 전전 영업일."""
    now = ref or datetime.now(KST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=KST)
    offset = 2 if now.hour < 14 else 1
    d = now.date() - timedelta(days=offset)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


# ── API 호출 ──────────────────────────────────────────────────────────────────

def fetch_page(service_key: str, begin_dt: str, end_dt: str, page_no: int) -> dict:
    """
    전체 지수 조회 (idxNm 필터 없음 — 서버 측 한글 필터 미작동 확인).
    Python 레벨에서 INDEX_MAP exact 매칭으로 필요한 지수만 추출.
    """
    params = {
        "serviceKey": service_key,
        "numOfRows":  PAGE_SIZE,
        "pageNo":     page_no,
        "resultType": "json",
        "beginBasDt": begin_dt,
        "endBasDt":   end_dt,
    }
    resp = requests.get(ENDPOINT, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_page_with_retry(
    service_key: str, begin_dt: str, end_dt: str, page_no: int
) -> dict | None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fetch_page(service_key, begin_dt, end_dt, page_no)
        except requests.exceptions.ConnectionError as e:
            wait = RETRY_BACKOFF * (2 ** (attempt - 1))
            print(f"\n[WARN] 네트워크 연결 실패 (시도 {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                print(f"  {wait}초 후 재시도...")
                time.sleep(wait)
            else:
                print("[ERROR] 최대 재시도 초과 — 빈 결과 반환.")
                return None
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else "?"
            if status in (429, 500, 502, 503, 504):
                wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                print(f"\n[WARN] HTTP {status} (시도 {attempt}/{MAX_RETRIES}). {wait}초 후 재시도...")
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
                else:
                    print("[ERROR] 최대 재시도 초과 — 빈 결과 반환.")
                    return None
            else:
                print(f"\n[ERROR] HTTP {status} — 재시도 불가. 빈 결과 반환.")
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


def fetch_range(service_key: str, begin_dt: str, end_dt: str) -> list[dict]:
    """date range 전체를 페이징하여 원시 API 응답 수집."""
    all_items: list[dict] = []
    page_no = 1

    while True:
        print(f"  {begin_dt}~{end_dt} 페이지 {page_no} 조회중...", end=" ", flush=True)
        data = fetch_page_with_retry(service_key, begin_dt, end_dt, page_no)

        if data is None:
            print(f"[WARN] 페이지 {page_no} 실패. 수집된 {len(all_items)}건으로 계속.")
            break

        header      = data.get("response", {}).get("header", {})
        result_code = header.get("resultCode", "")
        result_msg  = header.get("resultMsg",  "")

        if result_code not in ("00", "0"):
            print(f"\n[ERROR] API 오류: {result_code} - {result_msg}")
            break

        body       = data.get("response", {}).get("body", {})
        items_wrap = body.get("items", {})

        if not items_wrap:
            print("데이터 없음 (영업일 없는 기간 또는 API 키 문제)")
            break

        raw = items_wrap.get("item", [])
        if isinstance(raw, dict):
            raw = [raw]

        # 불필요한 지수 미리 제외 (메모리 절약)
        filtered = [it for it in raw if it.get("idxNm", "") in INDEX_MAP]
        print(f"전체 {len(raw)}건 중 대상 {len(filtered)}건")
        all_items.extend(filtered)

        total_count = int(body.get("totalCount", 0))
        if len(all_items) >= total_count or len(raw) < PAGE_SIZE:
            break

        page_no += 1

    return all_items


# ── 데이터 변환 ───────────────────────────────────────────────────────────────

def parse_float(val) -> float | None:
    if val is None or val == "":
        return None
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def parse_int(val) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def transform(items: list[dict]) -> list[dict]:
    """
    API 응답 → market_index_history upsert용 딕셔너리.

    주요 응답 필드:
      basDt          : 기준일자 (YYYYMMDD)
      idxNm          : 지수명 (exact match → INDEX_MAP)
      clpr           : 종가
      mkp            : 시가
      hipr           : 고가
      lopr           : 저가
      fltRt          : 등락률 (%)
      trPrc          : 거래대금 (백만원)
      lstgMrktTotAmt : 상장시가총액 (백만원)
    """
    rows = []
    for item in items:
        idx_nm_raw = str(item.get("idxNm") or "").strip()
        index_code = INDEX_MAP.get(idx_nm_raw)
        if index_code is None:
            continue  # 대상 외 지수 스킵

        bas_dt_raw = str(item.get("basDt") or "").strip()
        if len(bas_dt_raw) != 8:
            continue
        try:
            date_val = datetime.strptime(bas_dt_raw, "%Y%m%d").date().isoformat()
        except ValueError:
            continue

        close = parse_float(item.get("clpr"))
        if close is None:
            continue  # 종가 없으면 휴장일 → 스킵

        rows.append({
            "index_code":  index_code,
            "date":        date_val,
            "close":       close,
            "open":        parse_float(item.get("mkp")),
            "high":        parse_float(item.get("hipr")),
            "low":         parse_float(item.get("lopr")),
            "change_rate": parse_float(item.get("fltRt")),
            "trade_value": parse_int(item.get("trPrc")),
            "market_cap":  parse_int(item.get("lstgMrktTotAmt")),
            "updated_at":  datetime.now().isoformat(),
        })
    return rows


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def get_supabase():
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지 없음. pip install supabase")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락")
        sys.exit(1)
    return create_client(url, key)


def save_to_db(rows: list[dict]) -> tuple[int, int]:
    sb = get_supabase()
    success = failure = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        bn    = i // BATCH_SIZE + 1
        try:
            sb.table("market_index_history").upsert(
                batch, on_conflict="index_code,date"
            ).execute()
            success += len(batch)
            print(f"  [market_index_history] Batch {bn} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] Batch {bn} 실패: {e}")
    return success, failure


# ── 실행 로직 ─────────────────────────────────────────────────────────────────

def run_single_day(service_key: str, bas_dt: str, dry_run: bool) -> int:
    print(f"\n  기준일: {bas_dt}")
    # ⚠️ API quirk: beginBasDt == endBasDt → 빈 응답 반환 (data.go.kr 버그)
    #   해결: end = target + 1일 (캘린더 기준), Python에서 target 날짜만 필터링
    target_date = datetime.strptime(bas_dt, "%Y%m%d").date()
    end_dt      = (target_date + timedelta(days=1)).strftime("%Y%m%d")
    all_items   = fetch_range(service_key, bas_dt, end_dt)
    # 목표일 데이터만 추출 (end_dt 데이터 제거)
    items = [it for it in all_items if it.get("basDt", "") == bas_dt]
    rows  = transform(items)

    print(f"\n  변환: {len(rows)}건 (KOSPI/KOSDAQ/KOSPI200)")
    if not rows:
        print("[WARN] 저장할 데이터 없음 (공휴일 또는 API 미갱신 가능)")
        return 0

    if dry_run:
        print("\n[DRY-RUN] 상위 5건:")
        for r in rows[:5]:
            print(f"  {r['index_code']:8s} | {r['date']} | close={r['close']} | chg={r['change_rate']}%")
        print("[DRY-RUN] DB 저장 생략.")
        return len(rows)

    success, failure = save_to_db(rows)
    print(f"  저장: 성공 {success}건 / 실패 {failure}건")
    return success


def run_backfill(service_key: str, from_dt: str, dry_run: bool):
    """
    from_dt ~ 전 영업일까지 90일 청크 단위로 백필.
    청크당 API 1회 호출 (지수별 분리 불필요).
    """
    end_dt = get_target_business_day()
    print(f"\n  백필 범위: {from_dt} ~ {end_dt}")

    CHUNK_DAYS = 90
    chunks: list[tuple[str, str]] = []
    s = datetime.strptime(from_dt, "%Y%m%d").date()
    e = datetime.strptime(end_dt,  "%Y%m%d").date()
    cur = s
    while cur <= e:
        chunk_end = min(cur + timedelta(days=CHUNK_DAYS - 1), e)
        chunks.append((cur.strftime("%Y%m%d"), chunk_end.strftime("%Y%m%d")))
        cur = chunk_end + timedelta(days=1)

    print(f"  청크 수: {len(chunks)}개 (90일 단위)\n")
    total_rows = 0

    for chunk_begin, chunk_end in chunks:
        print(f"── 청크: {chunk_begin} ~ {chunk_end} ──")
        items = fetch_range(service_key, chunk_begin, chunk_end)
        rows  = transform(items)
        print(f"  변환: {len(rows)}건")

        if dry_run:
            print("  [DRY-RUN] DB 저장 생략.")
            total_rows += len(rows)
        elif rows:
            success, failure = save_to_db(rows)
            total_rows += success
            if failure:
                print(f"  [WARN] 실패 {failure}건")

        time.sleep(0.5)  # 청크 간 API 부하 분산

    print(f"\n  백필 완료: 총 {total_rows}건 저장")


# ── 진입점 ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="주가지수 시세 수집 (GetMarketIndexInfoService)")
    parser.add_argument("--date",     help="기준일 (YYYYMMDD). 미지정 시 전 영업일")
    parser.add_argument("--backfill", action="store_true",
                        help=f"전체 이력 백필 ({BACKFILL_START} ~ 오늘)")
    parser.add_argument("--from",     dest="from_dt", default=BACKFILL_START,
                        help=f"백필 시작일 (YYYYMMDD, 기본: {BACKFILL_START})")
    parser.add_argument("--dry-run",  action="store_true",
                        help="DB 저장 없이 확인")
    args = parser.parse_args()

    service_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not service_key:
        print("[ERROR] PUBLIC_DATA_API_KEY 환경변수 미설정.")
        sys.exit(1)

    print("=" * 60)
    print("주가지수 시세 수집 (GetMarketIndexInfoService)")
    print(f"  대상: KOSPI / KOSDAQ / KOSPI200")
    print(f"  모드: {'DRY-RUN' if args.dry_run else ('백필' if args.backfill else '단일일')}")
    print("=" * 60)

    if args.backfill:
        run_backfill(service_key, args.from_dt, args.dry_run)
    else:
        bas_dt = args.date or get_target_business_day()
        run_single_day(service_key, bas_dt, args.dry_run)

    print("=" * 60)
    print("완료")
    print("=" * 60)


if __name__ == "__main__":
    main()
