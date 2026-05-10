"""
scripts/reclassify_dividends.py
================================
disclosure_insights 에서 event_type='OTHER' 인데 실제로는 배당 공시인 레코드를
DIVIDEND 로 일괄 재분류합니다.

대상 패턴 (report_nm 기준):
  • 현금·현물배당결정  /  현금배당결정  /  주식배당결정
  • 중간배당결정  /  특별배당결정
  • 공통: "배당결정" 포함

사용법:
  # dry-run (변경 없이 대상 건수만 확인)
  python scripts/reclassify_dividends.py

  # 실제 업데이트
  python scripts/reclassify_dividends.py --apply

  # 배치 크기 조정
  python scripts/reclassify_dividends.py --apply --batch 500
"""

import os
import re
import argparse
import logging
from datetime import datetime

from supabase import create_client, Client
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── 환경변수 ──────────────────────────────────────────────────────────────────
# auto_analyst.py 와 동일한 경로 우선순위로 로드
for _env_path in [
    r"C:\stockplatform\.env.local",
    r"C:\Users\user\stockplatform\frontend\.env.local",
    r"C:\Users\user\stockplatform\.env.local",
]:
    if os.path.exists(_env_path):
        load_dotenv(_env_path, override=False)
        break
else:
    load_dotenv()  # 현재 디렉터리 기준 탐색

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.\n"
        ".env.local 파일 경로를 확인하거나 환경변수를 직접 설정하세요."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── 배당 공시 패턴 ────────────────────────────────────────────────────────────
# report_nm 에 이 패턴이 포함되어 있으면 DIVIDEND 로 재분류
DIVIDEND_PATTERNS: list[re.Pattern] = [
    re.compile(r"현금[\ㆍ·\s]?현물배당결정", re.IGNORECASE),
    re.compile(r"현금배당결정",               re.IGNORECASE),
    re.compile(r"주식배당결정",               re.IGNORECASE),
    re.compile(r"중간배당결정",               re.IGNORECASE),
    re.compile(r"특별배당결정",               re.IGNORECASE),
    re.compile(r"배당결정",                   re.IGNORECASE),  # 위에서 안 잡힌 변형 포함
]


def is_dividend(report_nm: str) -> bool:
    nm = (report_nm or "").strip()
    return any(p.search(nm) for p in DIVIDEND_PATTERNS)


def run(apply: bool = False, batch_size: int = 1000) -> None:
    logger.info("=" * 60)
    logger.info(f"모드: {'APPLY (실제 업데이트)' if apply else 'DRY-RUN (조회만)'}")
    logger.info("=" * 60)

    updated_total = 0
    skipped_total = 0
    offset = 0

    while True:
        # OTHER 레코드 배치 조회 (completed + low_quality 포함)
        resp = (
            supabase.table("disclosure_insights")
            .select("id, report_nm, event_type, analysis_status, rcept_dt")
            .eq("event_type", "OTHER")
            .order("rcept_dt", desc=True)
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break

        batch_updated = 0
        batch_skipped = 0
        ids_to_update: list[str] = []

        for row in rows:
            if is_dividend(row["report_nm"] or ""):
                ids_to_update.append(row["id"])
                logger.info(
                    f"  [DIVIDEND] {row['rcept_dt']} | {row['report_nm'][:60]}"
                )
                batch_updated += 1
            else:
                batch_skipped += 1

        if apply and ids_to_update:
            # Supabase는 in_() 로 일괄 업데이트 지원
            upd_resp = (
                supabase.table("disclosure_insights")
                .update({
                    "event_type": "DIVIDEND",
                    "updated_at": datetime.now().isoformat(),
                })
                .in_("id", ids_to_update)
                .execute()
            )
            if upd_resp.data is not None:
                logger.info(f"  ✅ {batch_updated}건 DIVIDEND 로 업데이트 완료")
            else:
                logger.error(f"  ❌ 업데이트 실패: {upd_resp}")

        updated_total += batch_updated
        skipped_total += batch_skipped

        logger.info(
            f"[Batch offset={offset}] 배당={batch_updated} / 비배당={batch_skipped} / "
            f"누적 배당={updated_total}"
        )

        offset += batch_size
        if len(rows) < batch_size:
            break

    logger.info("=" * 60)
    if apply:
        logger.info(f"완료: DIVIDEND 재분류 {updated_total}건 / 스킵 {skipped_total}건")
    else:
        logger.info(
            f"[DRY-RUN] DIVIDEND 대상: {updated_total}건 / 비해당: {skipped_total}건\n"
            f"실제 적용하려면 --apply 플래그를 추가하세요."
        )


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
        help="배치당 처리 건수 (기본 1000)",
    )
    args = parser.parse_args()
    run(apply=args.apply, batch_size=args.batch)
