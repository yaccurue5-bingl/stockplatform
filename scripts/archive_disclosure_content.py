"""
scripts/archive_disclosure_content.py
======================================
disclosure_insights.content(DART 원문)을 Supabase Storage로 백업하고 DB에서는 null 처리.

예전에 용량 문제로 content 컬럼을 일회성으로 전체 백업+null 처리했었는데,
이후 분석이 새로 완료되는 행마다 content가 다시 계속 쌓이고 있어서
상시 배치로 전환한다.

대상 조건:
  analysis_status IN ('completed', 'low_quality')
  AND content IS NOT NULL
  AND content_archived_at IS NULL
  AND updated_at < now() - grace_days

grace_days(기본 3일)를 두는 이유:
  backfill_scores.py / reprocess_db.py 등 "완료됐지만 sentiment_score 등 일부
  필드가 비어 있는 행"을 content 기반으로 재분석하는 스크립트들이 있다.
  분석 완료 직후 바로 content를 지우면 이 복구 창구가 사라지므로, 며칠간
  QA/backfill이 먼저 돌 수 있는 여유를 준다.

저장 경로: {bucket}/{id}.txt (원문 그대로, plain text)
복구 방법: Supabase Storage에서 {id}.txt 다운로드 → disclosure_insights.content에
           다시 채워넣으면 원상 복구 (content_archived_at은 참고용으로 남겨둠).

Usage:
  python scripts/archive_disclosure_content.py --dry-run
  python scripts/archive_disclosure_content.py --limit 500
  python scripts/archive_disclosure_content.py --grace-days 7
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path

# ── Path / env setup ─────────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    from utils.env_loader import load_env
    load_env()
except Exception:
    from dotenv import load_dotenv
    local_env = _ROOT / ".env.local"
    load_dotenv(local_env if local_env.exists() else None)

from supabase import create_client, Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("archive_content")

_sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
_sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(_sb_url, _sb_key)

BUCKET = "disclosure-content-archive"
ARCHIVABLE_STATUSES = ["completed", "low_quality"]


# ── 대상 조회 ──────────────────────────────────────────────────────────────────

def fetch_batch(grace_days: int, limit: int) -> list[dict]:
    cutoff = (datetime.now() - timedelta(days=grace_days)).isoformat()
    res = (
        supabase.table("disclosure_insights")
        .select("id, content, updated_at")
        .in_("analysis_status", ARCHIVABLE_STATUSES)
        .not_.is_("content", "null")
        .is_("content_archived_at", "null")
        .lt("updated_at", cutoff)
        .order("updated_at", desc=False)
        .limit(limit)
        .execute()
    )
    return res.data or []


# ── 1건 백업 + null 처리 ────────────────────────────────────────────────────────

def archive_one(row: dict, dry_run: bool) -> bool:
    """성공 시 True. Storage 업로드가 확인된 뒤에만 DB content를 지운다 (데이터 유실 방지)."""
    sig_id = row["id"]
    content = row.get("content") or ""
    path = f"{sig_id}.txt"

    if dry_run:
        logger.info(f"  [DRY] would archive {sig_id[:8]}... ({len(content)} chars)")
        return True

    try:
        supabase.storage.from_(BUCKET).upload(
            path,
            content.encode("utf-8"),
            file_options={"content-type": "text/plain; charset=utf-8", "upsert": "true"},
        )
    except Exception as e:
        logger.error(f"  ❌ [{sig_id[:8]}] Storage 업로드 실패: {e}")
        return False

    try:
        supabase.table("disclosure_insights").update({
            "content": None,
            "content_archived_at": datetime.now().isoformat(),
        }).eq("id", sig_id).execute()
    except Exception as e:
        logger.error(f"  ❌ [{sig_id[:8]}] DB 업데이트 실패 (Storage엔 이미 백업됨 — 재시도 시 자동 복구): {e}")
        return False

    return True


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="disclosure_insights.content → Storage 백업 + null 처리")
    parser.add_argument("--dry-run", action="store_true", help="미리보기만, 실제 백업/DB 변경 없음")
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument(
        "--grace-days", type=int, default=3,
        help="분석 완료 후 이 기간(일)이 지난 행만 백업 — backfill/QA 스크립트에 여유 기간 제공 (기본 3일)",
    )
    args = parser.parse_args()

    logger.info(f"content 백업 대상 조회 (grace={args.grace_days}일, limit={args.limit})...")
    rows = fetch_batch(args.grace_days, args.limit)
    if not rows:
        logger.info("✅ 백업할 대상 없음")
        return

    logger.info(f"  → {len(rows)}건 발견{' (DRY-RUN)' if args.dry_run else ''}")

    success = failure = 0
    for row in rows:
        if archive_one(row, args.dry_run):
            success += 1
        else:
            failure += 1

    logger.info(f"완료: 성공 {success}건 / 실패 {failure}건")


if __name__ == "__main__":
    main()
