"""
populate_snapshot_signals.py
============================
scores_log + disclosure_insights → snapshot_signals 테이블 갱신

새로운 scores_log 행이 생겼을 때 snapshot_signals 에 추가.
기존에 이미 있는 event_id는 SKIP (중복 방지).

【사용법】
  python scripts/populate_snapshot_signals.py           # 신규 행만 추가
  python scripts/populate_snapshot_signals.py --rebuild # 전체 재구성
  python scripts/populate_snapshot_signals.py --dry-run # 건수 확인만

【실행 주기】
  compute_base_score.py 실행 직후
"""

import os
import sys
import argparse
import time
from pathlib import Path

try:
    from supabase import create_client as _sb_create
except ImportError:
    _sb_create = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BATCH_SIZE   = 200

# 현재 룰 정의 — 변경 시 여기만 수정
SIGNAL_RULE  = "M>=1.1 AND vol_z>=1.0"


def is_buy_signal(m_score, volume_z) -> bool:
    if m_score is None or volume_z is None:
        return False
    return m_score >= 1.1 and volume_z >= 1.0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuild",  action="store_true", help="snapshot_signals 전체 재구성")
    parser.add_argument("--dry-run",  action="store_true", help="건수 확인만")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE 환경변수 누락")
        sys.exit(1)

    sb = _sb_create(SUPABASE_URL, SUPABASE_KEY)

    # ── 이미 존재하는 event_id 목록 ───────────────────────────────────────────
    if args.rebuild:
        logger.info("REBUILD 모드: snapshot_signals 전체 삭제 후 재구성")
        if not args.dry_run:
            sb.table("snapshot_signals").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        existing_ids: set[str] = set()
    else:
        logger.info("기존 event_id 조회 중...")
        res = sb.table("snapshot_signals").select("event_id").execute()
        existing_ids = {r["event_id"] for r in (res.data or [])}
        logger.info(f"  기존: {len(existing_ids)}개")

    # ── scores_log 전체 로드 ─────────────────────────────────────────────────
    logger.info("scores_log 로드 중...")
    sl_res = sb.table("scores_log").select(
        "id, stock_code, date, disclosure_id, m_score, f_score, volume_z, final_score"
    ).not_.is_("disclosure_id", "null").execute()
    sl_rows = sl_res.data or []
    logger.info(f"  scores_log: {len(sl_rows)}행")

    # 신규 행만 필터
    new_rows = [r for r in sl_rows if r["disclosure_id"] not in existing_ids]
    logger.info(f"  신규 처리 대상: {len(new_rows)}행")

    if args.dry_run:
        logger.info("[DRY-RUN] DB 저장 생략")
        buy = sum(1 for r in new_rows if is_buy_signal(r.get("m_score"), r.get("volume_z")))
        logger.info(f"  예상 BUY signal: {buy}개 ({buy/max(len(new_rows),1)*100:.1f}%)")
        return

    if not new_rows:
        logger.info("[DONE] 신규 행 없음")
        return

    # ── disclosure_insights 에서 event_type, e_score 조인 ────────────────────
    disclosure_ids = list({r["disclosure_id"] for r in new_rows})
    logger.info(f"  disclosure_insights 조회 ({len(disclosure_ids)}개)...")

    di_map: dict[str, dict] = {}
    for i in range(0, len(disclosure_ids), 200):
        chunk = disclosure_ids[i:i+200]
        res = sb.table("disclosure_insights").select(
            "id, event_type, sentiment_score"
        ).in_("id", chunk).execute()
        for r in (res.data or []):
            di_map[r["id"]] = r
        time.sleep(0.05)

    # ── snapshot_signals 삽입 ─────────────────────────────────────────────────
    insert_rows = []
    buy_count = 0

    for sl in new_rows:
        di = di_map.get(sl["disclosure_id"], {})
        m = sl.get("m_score")
        vz = sl.get("volume_z")
        signal = is_buy_signal(m, vz)
        if signal:
            buy_count += 1

        e_score_raw = di.get("sentiment_score")
        e_score = float(e_score_raw) if e_score_raw is not None else None

        insert_rows.append({
            "event_id":    sl["disclosure_id"],
            "stock_code":  sl["stock_code"],
            "signal_date": sl["date"],
            "event_type":  di.get("event_type"),
            "m_score":     m,
            "f_score":     sl.get("f_score"),
            "volume_z":    vz,
            "e_score":     e_score,
            "final_score": sl.get("final_score"),
            "is_signal":   signal,
            "signal_rule": SIGNAL_RULE,
        })

    logger.info(f"  BUY signal: {buy_count}/{len(insert_rows)} ({buy_count/max(len(insert_rows),1)*100:.1f}%)")

    success = failure = 0
    for i in range(0, len(insert_rows), BATCH_SIZE):
        batch = insert_rows[i:i+BATCH_SIZE]
        try:
            sb.table("snapshot_signals").insert(batch).execute()
            success += len(batch)
            logger.info(f"  [{i+len(batch)}/{len(insert_rows)}] 저장")
        except Exception as e:
            failure += len(batch)
            logger.error(f"  배치 실패: {e}")
        time.sleep(0.05)

    logger.info(f"\n[DONE] snapshot_signals 저장: {success}건 / 실패: {failure}건")


if __name__ == "__main__":
    main()
