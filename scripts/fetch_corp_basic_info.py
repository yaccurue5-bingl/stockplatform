"""
scripts/fetch_corp_basic_info.py
==================================
금융위원회_기업기본정보 API로 상장기업 상세 정보 수집.

API: GetCorpBasicInfoService_V2 / getCorpOutline_V2
URL: https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2

제공 데이터 (companies 테이블 업데이트):
  - representative   : 대표자명 (enpRprFnm)
  - established_at   : 설립일자 (enpEstbDt, YYYYMMDD → DATE)
  - employee_count   : 직원수 (enpEmpeCnt)
  - homepage_url     : 홈페이지 URL (enpHmpgUrl)
  - corp_reg_no      : 법인등록번호 (crno)

참고:
  - basDt 없이 조회하면 최신 데이터 반환
  - 상장 종목코드(srtCd)로 필터링 가능
  - 비상장 법인도 포함되므로 stock_code 매핑 필요

사용법:
  python scripts/fetch_corp_basic_info.py             # 전체 상장종목 조회
  python scripts/fetch_corp_basic_info.py --code 005930  # 특정 종목만
  python scripts/fetch_corp_basic_info.py --dry-run   # DB 저장 없이 테스트
"""

import os
import sys
import argparse
import time
import requests
from datetime import datetime
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

ENDPOINT = "https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2"
BATCH_SIZE  = 50     # Supabase upsert 배치
PAGE_SIZE   = 100    # API 1회 호출당 조회수 (최대 100 권장 - 상세 데이터라 응답 큼)
RATE_LIMIT  = 0.2    # API 호출 간 대기 (초)


# ── API 호출 ──────────────────────────────────────────────────────────────────

def fetch_page(service_key: str, page_no: int, stock_code: str = None) -> dict:
    """getCorpOutline_V2 단일 페이지 호출"""
    params = {
        "serviceKey": service_key,
        "numOfRows":  PAGE_SIZE,
        "pageNo":     page_no,
        "resultType": "json",
        # 상장 종목만 필터링: Y=상장법인 포함
        "lstgYn":     "Y",
    }
    if stock_code:
        params["srtCd"] = stock_code  # 단축코드로 필터

    resp = requests.get(ENDPOINT, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_all(service_key: str, stock_code: str = None) -> list[dict]:
    """전체 페이지 조회"""
    all_items = []
    page_no = 1

    filter_desc = f"종목코드={stock_code}" if stock_code else "상장법인 전체"
    print(f"  GetCorpBasicInfoService_V2 호출 중 ({filter_desc})")

    while True:
        print(f"  페이지 {page_no} 조회중...", end=" ", flush=True)
        try:
            data = fetch_page(service_key, page_no, stock_code)
        except requests.exceptions.RequestException as e:
            print(f"\n[ERROR] 네트워크 오류: {e}")
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
            print("데이터 없음")
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
        time.sleep(RATE_LIMIT)

    return all_items


# ── 데이터 변환 ───────────────────────────────────────────────────────────────

def parse_date(val: str) -> str | None:
    """YYYYMMDD → YYYY-MM-DD (DB DATE 형식)"""
    if not val or len(val) != 8 or not val.isdigit():
        return None
    try:
        datetime.strptime(val, "%Y%m%d")
        return f"{val[:4]}-{val[4:6]}-{val[6:]}"
    except ValueError:
        return None


def parse_int(val) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def clean_url(url: str) -> str | None:
    if not url:
        return None
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url if len(url) > 10 else None


def transform(items: list[dict]) -> list[dict]:
    """
    getCorpOutline_V2 응답 → companies 업데이트용 딕셔너리

    key: stock_code (srtCd 기준)
    srtCd: 단축코드 (6자리) - KOSPI/KOSDAQ 상장 종목
    """
    rows = []
    seen = set()

    for item in items:
        # 단축코드 (종목코드)
        stock_code = str(item.get("srtCd") or "").strip()
        if not stock_code or stock_code in seen:
            continue
        seen.add(stock_code)

        # 설립일 파싱
        estb_dt = parse_date(str(item.get("enpEstbDt") or ""))

        rows.append({
            "stock_code":     stock_code,
            "representative": str(item.get("enpRprFnm") or "").strip() or None,
            "established_at": estb_dt,
            "employee_count": parse_int(item.get("enpEmpeCnt")),
            "homepage_url":   clean_url(item.get("enpHmpgUrl")),
            "corp_reg_no":    str(item.get("crno") or "").strip() or None,
            "updated_at":     datetime.now().isoformat(),
        })

    return rows


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def save_to_db(rows: list[dict]) -> tuple[int, int]:
    """배치 upsert → (성공수, 실패수)"""
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지가 설치되지 않았습니다. pip install supabase")
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
    parser = argparse.ArgumentParser(description="기업기본정보 수집 (GetCorpBasicInfoService_V2)")
    parser.add_argument("--code",    help="특정 종목코드만 조회 (예: 005930)")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 출력만")
    args = parser.parse_args()

    service_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not service_key:
        print("[ERROR] PUBLIC_DATA_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    print("=" * 60)
    print("기업 기본 정보 수집 (GetCorpBasicInfoService_V2)")
    print(f"  대상: {'종목코드=' + args.code if args.code else '상장법인 전체'}")
    print(f"  모드: {'DRY-RUN' if args.dry_run else '실제 저장'}")
    print("=" * 60)

    # 1. API 조회
    items = fetch_all(service_key, stock_code=args.code)

    if not items:
        print("[WARN] 조회된 기업 정보가 없습니다.")
        sys.exit(0)
    print(f"  총 {len(items)}건 조회 완료")

    # 2. 변환
    rows = transform(items)
    print(f"  변환 완료: {len(rows)}개 종목")

    # 3. 출력 (dry-run)
    if args.dry_run:
        print("\n[DRY-RUN] 샘플 데이터 (상위 3건):")
        for r in rows[:3]:
            print(f"  {r['stock_code']} | 대표: {r['representative']} | "
                  f"설립: {r['established_at']} | 직원: {r['employee_count']} | "
                  f"홈페이지: {r['homepage_url']}")
        print("\n[DRY-RUN] DB 저장 생략.")
        sys.exit(0)

    # 4. 저장
    print(f"\n  Supabase 저장 중 ({len(rows)}건)...")
    success, failure = save_to_db(rows)

    print("=" * 60)
    print(f"완료: 성공 {success}건 / 실패 {failure}건")
    print("=" * 60)
    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
