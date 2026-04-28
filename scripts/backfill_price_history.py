"""
backfill_price_history.py
=========================
price_history 테이블에 과거 날짜 데이터를 일괄 수집 (금융위원회 API).

fetch_market_data.py의 API/변환 로직을 재사용하되:
  - companies 테이블은 건드리지 않음 (과거 시총으로 현재값 덮어쓰기 방지)
  - price_history 만 upsert
  - 이미 존재하는 날짜는 자동 skip (resume 지원)

【사용법】
  python scripts/backfill_price_history.py                    # 2025-01-02 ~ 어제
  python scripts/backfill_price_history.py --start 20250101   # 시작일 지정
  python scripts/backfill_price_history.py --end   20260319   # 종료일 지정
  python scripts/backfill_price_history.py --dry-run          # DB 저장 없이 날짜 목록만 출력
  python scripts/backfill_price_history.py --force            # 기존 날짜도 재수집

【예상 소요시간】
  250 거래일 × (페이지 3개 × 1초) ≈ 15~20분
"""

import os
import sys
import argparse
import time
from datetime import date, timedelta
from pathlib import Path

# ── 의존성: supabase 먼저 import (충돌 방지) ──────────────────────────────────
try:
    from supabase import create_client as _sb_create
except ImportError:
    _sb_create = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

# fetch_market_data 에서 API 로직 재사용
sys.path.insert(0, str(Path(__file__).parent))
from fetch_market_data import fetch_all, transform

# ── 설정 ──────────────────────────────────────────────────────────────────────
BATCH_SIZE       = 100
DELAY_PER_DATE   = 1.2   # 날짜간 sleep (초) — API rate limit 여유
DEFAULT_START    = date(2025, 1, 2)


def business_days(start: date, end: date) -> list[date]:
    """start ~ end 사이 주중 영업일(월~금) 목록 반환."""
    days = []
    d = start
    while d <= end:
        if d.weekday() < 5:   # 0=Mon, 4=Fri
            days.append(d)
        d += timedelta(days=1)
    return days


def get_existing_dates(sb) -> set[str]:
    """price_history 에 이미 있는 날짜 집합 반환 (YYYY-MM-DD 문자열)."""
    print("  기존 날짜 조회 중...", end=" ", flush=True)
    resp = sb.table("price_history").select("date").execute()
    dates = {r["date"] for r in (resp.data or [])}
    print(f"{len(dates)}개 날짜 확인")
    return dates


def save_price_history(sb, price_rows: list[dict], bas_dt: str) -> tuple[int, int]:
    """price_history 만 upsert (companies 제외)."""
    date_str = str(__import__("datetime").datetime.strptime(bas_dt, "%Y%m%d").date())
    for row in price_rows:
        row["date"]       = date_str
        row["updated_at"] = __import__("datetime").datetime.now().isoformat()

    success = failure = 0
    for i in range(0, len(price_rows), BATCH_SIZE):
        batch = price_rows[i:i + BATCH_SIZE]
        try:
            sb.table("price_history").upsert(
                batch, on_conflict="stock_code,date"
            ).execute()
            success += len(batch)
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] batch {i // BATCH_SIZE + 1} 실패: {e}")

    return success, failure


def main():
    parser = argparse.ArgumentParser(description="price_history 과거 데이터 일괄 수집")
    parser.add_argument("--start",   default=None, help="시작일 YYYYMMDD (기본: 20250102)")
    parser.add_argument("--end",     default=None, help="종료일 YYYYMMDD (기본: 어제)")
    parser.add_argument("--dry-run", action="store_true", help="날짜 목록만 출력, DB 저장 없음")
    parser.add_argument("--force",   action="store_true", help="기존 날짜도 재수집")
    args = parser.parse_args()

    service_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not service_key:
        print("[ERROR] PUBLIC_DATA_API_KEY 환경변수 누락")
        sys.exit(1)

    # ── 날짜 범위 결정 ─────────────────────────────────────────────────────────
    start = date.fromisoformat(
        f"{args.start[:4]}-{args.start[4:6]}-{args.start[6:]}"
    ) if args.start else DEFAULT_START

    yesterday = date.today() - timedelta(days=1)
    end = date.fromisoformat(
        f"{args.end[:4]}-{args.end[4:6]}-{args.end[6:]}"
    ) if args.end else yesterday

    all_biz_days = business_days(start, end)
    print(f"\n[DATE] 대상 기간: {start} ~ {end}  ({len(all_biz_days)}개 주중 영업일)")

    if args.dry_run:
        print("\n[DRY-RUN] 날짜 목록 (처음 10개):")
        for d in all_biz_days[:10]:
            print(f"  {d}")
        if len(all_biz_days) > 10:
            print(f"  ... 외 {len(all_biz_days) - 10}개")
        print("\n--dry-run 완료. DB 저장 없음.")
        return

    # ── Supabase 연결 ─────────────────────────────────────────────────────────
    if _sb_create is None:
        print("[ERROR] supabase 패키지 미설치")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락")
        sys.exit(1)
    sb = _sb_create(url, key)

    # ── 기존 날짜 확인 (skip 기준) ────────────────────────────────────────────
    existing = get_existing_dates(sb) if not args.force else set()

    target_days = [
        d for d in all_biz_days
        if str(d) not in existing
    ]
    skipped = len(all_biz_days) - len(target_days)

    print(f"  skip (이미 존재): {skipped}개")
    print(f"  수집 대상:        {len(target_days)}개")
    if not target_days:
        print("\n[DONE] 모든 날짜가 이미 존재합니다. 완료.")
        return

    # ── 날짜별 수집 루프 ─────────────────────────────────────────────────────
    print(f"\n[START] 수집 시작...\n")
    total_success = total_failure = 0
    empty_days    = []

    for idx, d in enumerate(target_days, 1):
        bas_dt = d.strftime("%Y%m%d")
        print(f"[{idx:3d}/{len(target_days)}] {bas_dt}", end="  ")

        items = fetch_all(service_key, bas_dt)

        if not items:
            print("→ 데이터 없음 (공휴일/API 오류)")
            empty_days.append(bas_dt)
            time.sleep(DELAY_PER_DATE)
            continue

        _, price_rows = transform(items)
        s, f = save_price_history(sb, price_rows, bas_dt)
        total_success += s
        total_failure += f

        status = "OK" if f == 0 else f"FAIL {f}건"
        print(f"→ {len(price_rows)}종목  저장 {s}건  {status}")
        time.sleep(DELAY_PER_DATE)

    # ── 결과 요약 ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"[DONE] price_history backfill 완료")
    print(f"  수집 날짜:   {len(target_days)}일")
    print(f"  총 저장:     {total_success}건")
    print(f"  총 실패:     {total_failure}건")
    if empty_days:
        print(f"  빈 날짜({len(empty_days)}개): {empty_days[:5]}{'...' if len(empty_days) > 5 else ''}")
    print("=" * 60)
    print("\n💡 다음 단계: python scripts/compute_volume_zscore.py 실행")


if __name__ == "__main__":
    main()
