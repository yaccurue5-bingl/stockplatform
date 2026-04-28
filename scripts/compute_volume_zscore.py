"""
compute_volume_zscore.py
========================
price_history.volume_z 계산 + scores_log.volume_z 백필

【volume_z 계산 방식】
  volume_z = (volume_t - mean(volume, 20d)) / std(volume, 20d)

  - 20거래일 rolling window (ROWS BETWEEN 19 PRECEDING AND CURRENT ROW)
  - 최소 10일치 이상 있어야 계산 (그 미만 = NULL)
  - volume = 0 or NULL 인 행 제외

【실행 순서】
  1. price_history.volume_z  — SQL 윈도우 함수로 일괄 계산 (빠름)
  2. scores_log.volume_z     — 이벤트 날짜 기준 price_history 에서 조인

【사용법】
  python scripts/compute_volume_zscore.py           # 전체 계산
  python scripts/compute_volume_zscore.py --dry-run # 샘플 출력만, DB 저장 안함
  python scripts/compute_volume_zscore.py --scores-only  # scores_log 백필만
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


# ── SQL: price_history.volume_z 계산 ─────────────────────────────────────────
SQL_COMPUTE_VOLUME_Z = """
WITH windowed AS (
  SELECT
    stock_code,
    date,
    volume,
    AVG(volume::double precision) OVER w              AS mean_20d,
    STDDEV_POP(volume::double precision) OVER w       AS std_20d,
    COUNT(volume) OVER w                              AS cnt_20d
  FROM price_history
  WHERE volume IS NOT NULL AND volume > 0
  WINDOW w AS (
    PARTITION BY stock_code
    ORDER BY date
    ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
  )
),
vz AS (
  SELECT
    stock_code,
    date,
    CASE
      WHEN cnt_20d >= 10 AND std_20d > 0
      THEN ROUND(CAST((volume - mean_20d) / std_20d AS numeric), 4)::double precision
      ELSE NULL
    END AS volume_z
  FROM windowed
)
UPDATE price_history ph
SET volume_z = vz.volume_z
FROM vz
WHERE ph.stock_code = vz.stock_code
  AND ph.date = vz.date;
"""

# ── SQL: scores_log.volume_z 백필 ────────────────────────────────────────────
SQL_BACKFILL_SCORES_LOG = """
UPDATE scores_log sl
SET volume_z = ph.volume_z
FROM price_history ph
WHERE sl.stock_code = ph.stock_code
  AND sl.date = ph.date
  AND ph.volume_z IS NOT NULL
  AND sl.volume_z IS NULL;
"""

# ── SQL: 분포 확인 ─────────────────────────────────────────────────────────────
SQL_DISTRIBUTION = """
SELECT
  COUNT(*)                                                        AS total_rows,
  COUNT(volume_z)                                                 AS with_vz,
  ROUND(AVG(volume_z)::numeric, 3)                               AS avg_vz,
  ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY volume_z)::numeric, 3) AS p10,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY volume_z)::numeric, 3) AS p50,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY volume_z)::numeric, 3) AS p90,
  ROUND(MAX(volume_z)::numeric, 3)                               AS max_vz,
  COUNT(*) FILTER (WHERE volume_z >= 1.0)                        AS cnt_vz_gte1,
  COUNT(*) FILTER (WHERE volume_z >= 2.0)                        AS cnt_vz_gte2
FROM price_history
WHERE volume_z IS NOT NULL;
"""

SQL_SCORES_DISTRIBUTION = """
SELECT
  COUNT(*)               AS total_scores,
  COUNT(volume_z)        AS with_vz,
  ROUND(AVG(volume_z)::numeric, 3) AS avg_vz,
  COUNT(*) FILTER (WHERE volume_z >= 1.0) AS cnt_signal_candidate
FROM scores_log;
"""


def run_sql(sb, sql: str, description: str) -> dict:
    """Supabase rpc 또는 postgrest raw SQL 실행."""
    logger.info(f"  {description}...")
    try:
        # Supabase Python SDK는 raw SQL을 직접 지원하지 않으므로
        # execute_sql을 위한 RPC 또는 postgrest 사용
        # → 대신 psycopg2 직접 연결 방식 사용
        import urllib.parse
        parsed = urllib.parse.urlparse(SUPABASE_URL)
        host = parsed.hostname
        # Supabase project ref 추출
        project_ref = host.split('.')[0] if host else None

        # Supabase의 직접 DB 연결 (Transaction pooler)
        db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
        if not db_url:
            # Direct connection URL 구성
            db_password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ.get("DB_PASSWORD")
            if db_password and project_ref:
                db_url = f"postgresql://postgres.{project_ref}:{db_password}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"

        if db_url:
            import psycopg2
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(sql)
            if cur.description:
                cols = [d[0] for d in cur.description]
                rows = cur.fetchall()
                cur.close()
                conn.close()
                return {"rows": [dict(zip(cols, r)) for r in rows]}
            cur.close()
            conn.close()
            return {"rows": []}
        else:
            logger.warning("  DATABASE_URL / DB_PASSWORD 없음 — Supabase REST API 방식으로 대체")
            return {"error": "no_db_url"}
    except Exception as e:
        logger.error(f"  SQL 실행 오류: {e}")
        return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run",     action="store_true")
    parser.add_argument("--scores-only", action="store_true", help="scores_log 백필만")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE 환경변수 누락")
        sys.exit(1)

    sb = _sb_create(SUPABASE_URL, SUPABASE_KEY)

    # DB URL 확인
    db_url = (os.environ.get("DATABASE_URL")
              or os.environ.get("SUPABASE_DB_URL")
              or os.environ.get("DIRECT_URL"))

    db_password = os.environ.get("SUPABASE_DB_PASSWORD") or os.environ.get("DB_PASSWORD")
    if not db_url and db_password:
        import urllib.parse
        parsed = urllib.parse.urlparse(SUPABASE_URL)
        project_ref = parsed.hostname.split('.')[0]
        db_url = f"postgresql://postgres.{project_ref}:{db_password}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"

    if not db_url:
        logger.error(
            "DATABASE_URL 또는 SUPABASE_DB_PASSWORD 환경변수 필요.\n"
            "  .env.local 에 추가:\n"
            "    SUPABASE_DB_PASSWORD=<Supabase Dashboard → Settings → Database → Password>"
        )
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        logger.error("psycopg2 미설치. pip install psycopg2-binary")
        sys.exit(1)

    if args.dry_run:
        logger.info("[DRY-RUN] 실제 실행 시 아래 SQL 2개가 순서대로 실행됩니다.")
        logger.info("\n--- Step 1: price_history.volume_z ---")
        logger.info(SQL_COMPUTE_VOLUME_Z[:300] + "...")
        logger.info("\n--- Step 2: scores_log.volume_z 백필 ---")
        logger.info(SQL_BACKFILL_SCORES_LOG)
        return

    def exec_sql(sql, desc):
        logger.info(f"\n{desc}")
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        t0 = time.time()
        cur.execute(sql)
        elapsed = time.time() - t0
        rows_affected = cur.rowcount
        cur.close()
        conn.close()
        logger.info(f"  완료: {rows_affected}행 처리 ({elapsed:.1f}s)")
        return rows_affected

    def fetch_sql(sql, desc):
        logger.info(f"\n{desc}")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(sql)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        cur.close()
        conn.close()
        return rows

    # ── Step 1: price_history.volume_z ────────────────────────────────────────
    if not args.scores_only:
        affected = exec_sql(SQL_COMPUTE_VOLUME_Z, "Step 1: price_history.volume_z 계산 중 (윈도우 함수)...")
        logger.info(f"  price_history {affected}행 volume_z 업데이트")

        dist = fetch_sql(SQL_DISTRIBUTION, "Step 1-b: 분포 확인...")
        if dist:
            d = dist[0]
            logger.info(f"\n  price_history volume_z 분포")
            logger.info(f"    전체: {d['total_rows']:,}행  계산됨: {d['with_vz']:,}행")
            logger.info(f"    P10={d['p10']}  P50={d['p50']}  P90={d['p90']}  Max={d['max_vz']}")
            logger.info(f"    vz >= 1.0: {d['cnt_vz_gte1']:,}행")
            logger.info(f"    vz >= 2.0: {d['cnt_vz_gte2']:,}행")

    # ── Step 2: scores_log.volume_z 백필 ─────────────────────────────────────
    affected2 = exec_sql(SQL_BACKFILL_SCORES_LOG, "Step 2: scores_log.volume_z 백필 중...")
    logger.info(f"  scores_log {affected2}행 volume_z 업데이트")

    dist2 = fetch_sql(SQL_SCORES_DISTRIBUTION, "Step 2-b: scores_log 분포 확인...")
    if dist2:
        d = dist2[0]
        logger.info(f"\n  scores_log volume_z 결과")
        logger.info(f"    전체: {d['total_scores']:,}  volume_z 있음: {d['with_vz']:,}")
        logger.info(f"    avg_vz: {d['avg_vz']}")
        logger.info(f"    volume_z >= 1.0 (signal 후보): {d['cnt_signal_candidate']:,}건")

    logger.info("\n[DONE] volume_z 계산 완료")
    logger.info("다음: python scripts/populate_snapshot_signals.py")


if __name__ == "__main__":
    main()
