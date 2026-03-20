"""
scripts/run_daily_batch.py
===========================
전체 일배치 파이프라인 한 번에 실행.

모드:
  --backtest   기존 DB 데이터로 백테스트 (크롤링 스킵, backfill 분석)
  --prod        정식 일배치 (크롤링 → 분석 → 스코어 계산)
  --dry-run    실제 저장 없이 출력만 (compute 스텝만 적용)

사용법:
  python scripts/run_daily_batch.py --backtest            # DB 백테스트
  python scripts/run_daily_batch.py --backtest --limit 200  # 200건 백필
  python scripts/run_daily_batch.py --prod                # 정식 일배치
  python scripts/run_daily_batch.py --prod --dry-run      # 저장 없이 테스트

백테스트 실행 순서:
  1. auto_analyst.py  --backfill   : sentiment_score 없는 기존 데이터 AI 재분석
  2. fetch_loan_data.py            : 오늘 대차잔고 수집 (선택, --skip-fetch로 생략)
  3. fetch_market_data.py          : 오늘 시세/거래량 수집 (선택)
  4. compute_loan_pressure.py      : LPS 계산
  5. compute_base_score.py --recompute : BaseScore / FinalScore 계산

정식 일배치 실행 순서:
  1. dart_crawler.py               : 오늘 공시 수집
  2. fetch_market_data.py          : 오늘 시세/거래량 수집
  3. fetch_loan_data.py            : 오늘 대차잔고 수집
  4. compute_loan_pressure.py      : LPS 계산
  5. auto_analyst.py               : AI 분석 (pending → completed)
  6. compute_base_score.py         : BaseScore / FinalScore 계산
"""

import sys
import time
import argparse
import subprocess
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ── 로깅 ──────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("batch")

SCRIPTS_DIR = Path(__file__).parent
PYTHON      = sys.executable   # 현재 venv의 python


# ── 스텝 실행 헬퍼 ────────────────────────────────────────────────────────────

def run_step(name: str, script: str, args: list[str] = None, skip: bool = False) -> bool:
    """
    단일 스텝 실행.
    반환: True(성공) / False(실패)
    """
    if skip:
        logger.info(f"  ⏭  [{name}] 스킵")
        return True

    cmd = [PYTHON, str(SCRIPTS_DIR / script)] + (args or [])
    logger.info(f"\n{'='*55}")
    logger.info(f"  ▶  [{name}]  {script} {' '.join(args or [])}")
    logger.info(f"{'='*55}")

    t0 = time.time()
    result = subprocess.run(cmd, cwd=str(SCRIPTS_DIR.parent))
    elapsed = time.time() - t0

    if result.returncode == 0:
        logger.info(f"  ✅ [{name}] 완료 ({elapsed:.1f}s)")
        return True
    else:
        logger.error(f"  ❌ [{name}] 실패 (returncode={result.returncode}, {elapsed:.1f}s)")
        return False


# ── 파이프라인 정의 ───────────────────────────────────────────────────────────

def run_backtest(args):
    """
    백테스트 모드:
    기존 DB 데이터에 AI 분석 + LPS + 스코어 적용.
    크롤링은 스킵 (이미 수집된 공시 활용).
    """
    limit     = str(args.limit)
    dry_flag  = ["--dry-run"] if args.dry_run else []
    skip_fetch = args.skip_fetch

    logger.info("\n" + "="*55)
    logger.info("  🔬  BACKTEST 모드 시작")
    logger.info(f"  limit={limit}  dry_run={args.dry_run}  skip_fetch={skip_fetch}")
    logger.info("="*55)

    steps = [
        # Step 1: sentiment_score 없는 기존 completed 항목 AI 재분석
        ("AI 백필",
         "auto_analyst.py",
         ["--backfill", "--limit", limit],
         False),

        # Step 2: 오늘 대차잔고 수집 (LPS 계산에 필요)
        ("대차잔고 수집",
         "fetch_loan_data.py",
         [],
         skip_fetch),

        # Step 3: 오늘 시세/거래량 수집
        ("시세/거래량 수집",
         "fetch_market_data.py",
         [],
         skip_fetch),

        # Step 4: LPS 계산
        ("LPS 계산",
         "compute_loan_pressure.py",
         dry_flag,
         False),

        # Step 5: BaseScore / FinalScore (--recompute: 기존 것도 재계산)
        ("BaseScore 계산",
         "compute_base_score.py",
         ["--recompute"] + dry_flag,
         False),
    ]

    return _execute_steps(steps)


def run_prod(args):
    """
    정식 일배치 모드:
    신규 공시 수집 → AI 분석 → 스코어 계산.
    KST 14:00 이후 실행 권장.
    """
    dry_flag = ["--dry-run"] if args.dry_run else []

    # KST 시간 확인
    KST = timezone(timedelta(hours=9))
    now_kst = datetime.now(KST)
    if now_kst.hour < 14:
        logger.warning(f"  ⚠️  현재 KST {now_kst.strftime('%H:%M')} — 14:00 이전입니다.")
        logger.warning("     data.go.kr 시세/대차 데이터가 아직 없을 수 있습니다.")

    logger.info("\n" + "="*55)
    logger.info("  🚀  PROD 일배치 시작")
    logger.info(f"  KST {now_kst.strftime('%Y-%m-%d %H:%M')}  dry_run={args.dry_run}")
    logger.info("="*55)

    steps = [
        # Step 1: DART 공시 수집
        ("DART 수집",
         "dart_crawler.py",
         [],
         False),

        # Step 2: 시세/거래량 수집 (companies + loan_stats.volume)
        ("시세/거래량 수집",
         "fetch_market_data.py",
         [],
         False),

        # Step 3: 대차잔고 수집 (loan_stats.loan_balance)
        ("대차잔고 수집",
         "fetch_loan_data.py",
         [],
         False),

        # Step 4: LPS 계산
        ("LPS 계산",
         "compute_loan_pressure.py",
         dry_flag,
         False),

        # Step 5: AI 분석 (pending → sentiment_score + completed)
        ("AI 분석",
         "auto_analyst.py",
         [],
         False),

        # Step 6: BaseScore / FinalScore
        ("BaseScore 계산",
         "compute_base_score.py",
         dry_flag,
         False),
    ]

    return _execute_steps(steps)


def _execute_steps(steps: list) -> bool:
    results = []
    t_total = time.time()

    for name, script, extra_args, skip in steps:
        ok = run_step(name, script, extra_args, skip)
        results.append((name, ok, skip))

    # 결과 요약
    elapsed_total = time.time() - t_total
    logger.info("\n" + "="*55)
    logger.info("  📋  배치 결과 요약")
    logger.info("="*55)
    all_ok = True
    for name, ok, skip in results:
        if skip:
            icon = "⏭ "
            status = "스킵"
        elif ok:
            icon = "✅"
            status = "완료"
        else:
            icon = "❌"
            status = "실패"
            all_ok = False
        logger.info(f"  {icon} {name:20s} {status}")

    logger.info(f"\n  총 소요 시간: {elapsed_total:.1f}s")
    if all_ok:
        logger.info("  🎉 전체 배치 완료!")
    else:
        logger.error("  ⚠️  일부 스텝 실패. 위 로그를 확인하세요.")

    return all_ok


# ── 진입점 ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="일배치 파이프라인 통합 실행",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python scripts/run_daily_batch.py --backtest               # 기존 DB 백테스트
  python scripts/run_daily_batch.py --backtest --limit 500   # 500건 백필
  python scripts/run_daily_batch.py --backtest --skip-fetch  # fetch 없이 스코어만
  python scripts/run_daily_batch.py --prod                   # 정식 일배치
  python scripts/run_daily_batch.py --prod --dry-run         # 저장 없이 테스트
        """
    )

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--backtest", action="store_true",
                      help="백테스트 모드: 기존 DB 데이터 AI 분석 + 스코어 계산")
    mode.add_argument("--prod",     action="store_true",
                      help="정식 일배치 모드: 크롤링 → 분석 → 스코어")

    parser.add_argument("--dry-run",    action="store_true",
                        help="compute 스텝 저장 없이 출력만 (fetch는 실행)")
    parser.add_argument("--limit",      type=int, default=200,
                        help="백테스트 백필 최대 처리 건수 (기본 200)")
    parser.add_argument("--skip-fetch", action="store_true",
                        help="백테스트 시 fetch 스텝 생략 (loan/market 이미 있을 때)")

    args = parser.parse_args()

    if args.backtest:
        ok = run_backtest(args)
    else:
        ok = run_prod(args)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
