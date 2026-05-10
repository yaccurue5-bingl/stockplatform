"""
scripts/reclassify_dividends.py
================================
disclosure_insights 에서 event_type='OTHER' 인데 실제로는 배당 공시인 레코드를
DIVIDEND 로 일괄 재분류합니다.

대상 패턴 (report_nm 기준):
  • 현금·현물배당결정  /  현금배당결정  /  주식배당결정
  • 중간배당결정  /  특별배당결정
  • 공통: "배당결정" 포함

2-pass 설계:
  Pass 1: OTHER 전체 스캔 → 배당 ID 목록 수집  (DB 변경 없음)
  Pass 2: 100개씩 청크로 PATCH               (URL 길이 ≤ ~4 KB, 안전)

  → 스캔 중 수정 없으므로 오프셋 밀림 없음
  → UUID 100개 × 39 byte ≈ 3.9 KB, Supabase nginx 8 KB 한도 내

사용법:
  # dry-run (변경 없이 대상 건수만 확인)
  python scripts/reclassify_dividends.py

  # 실제 업데이트
  python scripts/reclassify_dividends.py --apply

  # 스캔 배치 크기 조정 (기본 1000)
  python scripts/reclassify_dividends.py --apply --batch 2000
"""

import os
import re
import argparse
import logging
import calendar
from datetime import datetime, date

from supabase import create_client, Client
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── 환경변수 ──────────────────────────────────────────────────────────────────
for _env_path in [
    r"C:\stockplatform\.env.local",
    r"C:\Users\user\stockplatform\frontend\.env.local",
    r"C:\Users\user\stockplatform\.env.local",
]:
    if os.path.exists(_env_path):
        load_dotenv(_env_path, override=False)
        break
else:
    load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.\n"
        ".env.local 파일 경로를 확인하거나 환경변수를 직접 설정하세요."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 배당 공시 패턴 ────────────────────────────────────────────────────────────
DIVIDEND_PATTERNS: list[re.Pattern] = [
    re.compile(r"현금[\ㆍ·\s]?현물배당결정", re.IGNORECASE),
    re.compile(r"현금배당결정",               re.IGNORECASE),
    re.compile(r"주식배당결정",               re.IGNORECASE),
    re.compile(r"중간배당결정",               re.IGNORECASE),
    re.compile(r"특별배당결정",               re.IGNORECASE),
    re.compile(r"배당결정",                   re.IGNORECASE),
]

UPDATE_CHUNK = 100  # PATCH URL 길이: UUID 100개 × 39 byte ≈ 3.9 KB


def is_dividend(report_nm: str) -> bool:
    nm = (report_nm or "").strip()
    return any(p.search(nm) for p in DIVIDEND_PATTERNS)


def run(apply: bool = False, scan_batch: int = 1000) -> None:
    logger.info("=" * 60)
    logger.info(f"모드: {'APPLY (실제 업데이트)' if apply else 'DRY-RUN (조회만)'}")
    logger.info("=" * 60)

    # ── Pass 1: 월별 date range 청크로 스캔 ─────────────────────────────────
    # 큰 OFFSET/ilike 전체 스캔 → statement timeout 발생
    # 해결: 1개월 단위 gte+lte 쿼리 (~1,600행/월) → 각 쿼리 <3초 내 완료
    logger.info("▶ Pass 1: 월별 청크로 OTHER 레코드 스캔 중...")
    all_dividend_ids: list[str] = []

    # 커버 범위: 2025-01 ~ 현재 월
    today = date.today()
    cur = date(2025, 1, 1)  # 데이터 시작 하한

    while cur <= today:
        last_day = calendar.monthrange(cur.year, cur.month)[1]
        dt_from = cur.strftime("%Y%m01")
        dt_to   = cur.strftime(f"%Y%m{last_day:02d}")

        month_ids: list[str] = []
        offset = 0

        while True:
            resp = (
                supabase.table("disclosure_insights")
                .select("id, report_nm, rcept_dt")
                .eq("event_type", "OTHER")
                .gte("rcept_dt", dt_from)
                .lte("rcept_dt", dt_to)
                .order("rcept_dt", desc=True)
                .range(offset, offset + scan_batch - 1)
                .execute()
            )
            rows = resp.data or []
            if not rows:
                break

            for row in rows:
                if is_dividend(row["report_nm"] or ""):
                    month_ids.append(row["id"])
                    logger.info(
                        f"  [DIVIDEND] {row['rcept_dt']} | "
                        f"{(row['report_nm'] or '')[:60]}"
                    )

            offset += scan_batch
            if len(rows) < scan_batch:
                break

        all_dividend_ids.extend(month_ids)
        logger.info(
            f"  {dt_from[:6]} | 배당={len(month_ids)} | 누적={len(all_dividend_ids)}"
        )

        # 다음 달로 이동
        if cur.month == 12:
            cur = date(cur.year + 1, 1, 1)
        else:
            cur = date(cur.year, cur.month + 1, 1)

    logger.info(
        f"▶ Pass 1 완료 — 배당 {len(all_dividend_ids)}건 발견"
    )

    if not all_dividend_ids:
        logger.info("업데이트 대상 없음 — 종료")
        return

    if not apply:
        logger.info("=" * 60)
        logger.info(
            f"[DRY-RUN] DIVIDEND 대상: {len(all_dividend_ids)}건\n"
            f"실제 적용하려면 --apply 플래그를 추가하세요."
        )
        return

    # ── Pass 2: 100개 청크로 나눠 PATCH ─────────────────────────────────────
    logger.info(f"▶ Pass 2: {len(all_dividend_ids)}건 업데이트 중 (청크 {UPDATE_CHUNK}개씩)...")
    updated = 0
    failed  = 0
    now_iso = datetime.now().isoformat()

    for chunk_start in range(0, len(all_dividend_ids), UPDATE_CHUNK):
        chunk = all_dividend_ids[chunk_start : chunk_start + UPDATE_CHUNK]
        try:
            upd_resp = (
                supabase.table("disclosure_insights")
                .update({
                    "event_type": "DIVIDEND",
                    "updated_at": now_iso,
                })
                .in_("id", chunk)
                .execute()
            )
            # Supabase Python client: data=[] on no-match, data=[...] on match
            # None only on error (raised as exception usually)
            logger.info(
                f"  ✅ [{chunk_start}–{chunk_start + len(chunk) - 1}] "
                f"{len(chunk)}건 업데이트 완료"
            )
            updated += len(chunk)
        except Exception as e:
            logger.error(
                f"  ❌ [{chunk_start}–{chunk_start + len(chunk) - 1}] "
                f"업데이트 실패: {e}"
            )
            failed += len(chunk)

    logger.info("=" * 60)
    logger.info(f"완료: DIVIDEND 재분류 {updated}건 성공 / {failed}건 실패")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OTHER → DIVIDEND 재분류")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="실제 DB 업데이트 (없으면 dry-run)",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=1000,
        help="스캔 배치 크기 (기본 1000)",
    )
    args = parser.parse_args()
    run(apply=args.apply, scan_batch=args.batch)
