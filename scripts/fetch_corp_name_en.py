"""
scripts/fetch_corp_name_en.py
==============================
DART /company API에서 영문 기업명(eng_name)을 가져와 dart_corp_codes.corp_name_en에 저장.

DART /company: https://opendart.fss.or.kr/api/company.json?crtfc_key=...&corp_code=...

사용법:
  python scripts/fetch_corp_name_en.py           # 전체 (corp_name_en이 없는 것들)
  python scripts/fetch_corp_name_en.py --limit 200  # 최대 N건만
  python scripts/fetch_corp_name_en.py --dry-run    # DB 저장 없이 테스트
"""

import os
import sys
import time
import argparse
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

import requests
from supabase import create_client

DART_API_URL = "https://opendart.fss.or.kr/api/company.json"
RATE_LIMIT = 0.15   # DART API 호출 간격 (초)
BATCH_SIZE = 100    # Supabase upsert 배치


def fetch_eng_name(dart_key: str, corp_code: str) -> str | None:
    """DART /company API에서 eng_name 조회"""
    try:
        resp = requests.get(
            DART_API_URL,
            params={"crtfc_key": dart_key, "corp_code": corp_code},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") == "000":
            return data.get("corp_name_eng") or None
    except Exception as e:
        print(f"  [WARN] corp_code={corp_code} 오류: {e}")
    return None


def _flush(sb, updates: list[dict]):
    """stock_code 기준으로 corp_name_en UPDATE (개별)"""
    for item in updates:
        sb.table("dart_corp_codes").update({"corp_name_en": item["corp_name_en"]}).eq("stock_code", item["stock_code"]).execute()
    print(f"  [DB] {len(updates)}건 저장 완료")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="처리할 최대 건수 (0=전체)")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 테스트")
    args = parser.parse_args()

    dart_key = os.environ.get("DART_API_KEY")
    if not dart_key:
        print("[ERROR] DART_API_KEY 환경변수 없음")
        sys.exit(1)

    sb = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    # corp_name_en이 없는 corp_code 목록 조회 (Supabase 기본 1000행 제한 → pagination)
    rows = []
    if args.limit:
        result = (sb.table("dart_corp_codes")
                    .select("stock_code, corp_code, corp_name")
                    .is_("corp_name_en", "null")
                    .limit(args.limit)
                    .execute())
        rows = result.data or []
    else:
        offset = 0
        page_size = 1000
        while True:
            result = (sb.table("dart_corp_codes")
                        .select("stock_code, corp_code, corp_name")
                        .is_("corp_name_en", "null")
                        .range(offset, offset + page_size - 1)
                        .execute())
            batch = result.data or []
            rows.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size

    print(f"[INFO] corp_name_en 없는 기업: {len(rows)}건 처리 시작")

    updates = []
    for i, row in enumerate(rows, 1):
        corp_code = row["corp_code"]
        corp_name = row["corp_name"]
        stock_code = row["stock_code"]

        eng_name = fetch_eng_name(dart_key, corp_code)
        print(f"  [{i}/{len(rows)}] {corp_name} ({stock_code}) → {eng_name or '(없음)'}")

        if eng_name:
            updates.append({"stock_code": stock_code, "corp_name_en": eng_name})

        # 배치 저장
        if not args.dry_run and len(updates) >= BATCH_SIZE:
            _flush(sb, updates)
            updates = []

        time.sleep(RATE_LIMIT)

    # 나머지 저장
    if not args.dry_run and updates:
        _flush(sb, updates)

    print(f"[DONE] 영문명 수집 완료")


if __name__ == "__main__":
    main()
