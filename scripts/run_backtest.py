"""
scripts/run_backtest.py
=======================
Signal Score 조건별 히스토리컬 시뮬레이션 엔진.

[목적]
  과거 공시 데이터 기반으로 특정 Signal Score 조건 충족 시
  이후 가격 변동 패턴을 집계 — 투자 추천이 아닌 데이터 인사이트 제공.

조건 정의:
  score_gte_80_5d   — score ≥ 80, 5-day observation window
  score_gte_70_5d   — score ≥ 70, 5-day observation window
  score_gte_60_5d   — score ≥ 60, 5-day observation window
  score_gte_70_20d  — score ≥ 70, 20-day observation window
  dilution_only_5d  — DILUTION event, score ≥ 70, 5-day

알고리즘:
  1. scores_log(future_return_5d/20d) + disclosure_insights(event_type) JOIN
  2. event_stats에서 signal_score 조회
  3. 조건에 맞는 이벤트 필터링
  4. 날짜순 정렬 → equity curve 생성
  5. total_return / win_rate / avg_return / MDD / Sharpe 계산
  6. backtest_results 테이블 upsert

[주의]
  - 수익률은 공시일 close → +5/20영업일 close (close-to-close)
  - 이 데이터는 정보 제공 목적이며 투자 조언이 아닙니다.
  - 과거 패턴이 미래 결과를 보장하지 않습니다.

사용법:
  python scripts/run_backtest.py              # 전체 조건 실행
  python scripts/run_backtest.py --dry-run    # DB 저장 없이 결과 출력
"""

import os
import sys
import math
import argparse
import logging
from datetime import datetime
from pathlib import Path
from collections import defaultdict

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_backtest")

# ── 조건 정의 ─────────────────────────────────────────────────────────────────

STRATEGIES = [
    {
        "id":        "score_gte_80_5d",
        "label":     "Condition: Score ≥ 80 · 5-day Observation (Historical Simulation)",
        "threshold": 80,
        "event":     None,
        "hold":      5,
    },
    {
        "id":        "score_gte_70_5d",
        "label":     "Condition: Score ≥ 70 · 5-day Observation (Historical Simulation)",
        "threshold": 70,
        "event":     None,
        "hold":      5,
    },
    {
        "id":        "score_gte_60_5d",
        "label":     "Condition: Score ≥ 60 · 5-day Observation (Historical Simulation)",
        "threshold": 60,
        "event":     None,
        "hold":      5,
    },
    {
        "id":        "score_gte_70_20d",
        "label":     "Condition: Score ≥ 70 · 20-day Observation (Historical Simulation)",
        "threshold": 70,
        "event":     None,
        "hold":      20,
    },
    {
        "id":        "dilution_only_5d",
        "label":     "Condition: DILUTION Event · Score ≥ 70 · 5-day Observation (Historical Simulation)",
        "threshold": 70,
        "event":     "DILUTION",
        "hold":      5,
    },
]


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    if _supabase_create_client is None:
        logger.error("supabase 패키지 미설치")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("Supabase 환경변수 누락")
        sys.exit(1)
    return _supabase_create_client(url, key)


# ── 데이터 로드 ───────────────────────────────────────────────────────────────

def load_all_trades(sb) -> list[dict]:
    """
    scores_log 전체 로드 (future_return 있는 것).
    disclosure_insights에서 event_type 조인.
    event_stats에서 signal_score 조인.
    반환: [{date, stock_code, event_type, signal_score, return_5d, return_20d}, ...]
    """
    logger.info("  [1/3] scores_log 로드...")
    resp = (
        sb.table("scores_log")
        .select("disclosure_id, stock_code, date, future_return_5d, future_return_20d")
        .not_.is_("future_return_5d", "null")
        .limit(50000)
        .execute()
    )
    raw_logs = resp.data or []
    if not raw_logs:
        logger.info("  scores_log 데이터 없음")
        return []
    logger.info(f"  -> {len(raw_logs)}건")

    # disclosure_id → event_type 매핑
    logger.info("  [2/3] disclosure_insights 조인...")
    disc_ids = list({r["disclosure_id"] for r in raw_logs if r.get("disclosure_id")})
    id_to_event: dict[str, str] = {}
    chunk = 500
    for i in range(0, len(disc_ids), chunk):
        batch = disc_ids[i:i + chunk]
        dr = (
            sb.table("disclosure_insights")
            .select("id, event_type")
            .in_("id", batch)
            .not_.is_("event_type", "null")
            .execute()
        )
        for r in (dr.data or []):
            id_to_event[r["id"]] = r["event_type"]

    # event_type → signal_score 매핑
    logger.info("  [3/3] event_stats 조인...")
    es_resp = (
        sb.table("event_stats")
        .select("event_type, signal_score, signal_grade")
        .not_.is_("signal_score", "null")
        .execute()
    )
    ev_to_score: dict[str, int] = {}
    for r in (es_resp.data or []):
        ev_to_score[r["event_type"]] = r["signal_score"]

    # 병합
    trades = []
    for row in raw_logs:
        disc_id = row.get("disclosure_id")
        ev = id_to_event.get(disc_id)
        if not ev:
            continue
        score = ev_to_score.get(ev)
        if score is None:
            continue
        trades.append({
            "date":        row["date"],
            "stock_code":  row["stock_code"],
            "event_type":  ev,
            "signal_score": score,
            "return_5d":   row["future_return_5d"],
            "return_20d":  row.get("future_return_20d"),
        })

    trades.sort(key=lambda x: x["date"])
    logger.info(f"  -> 전략 가능 trades: {len(trades)}건")
    return trades


# ── 백테스트 엔진 ─────────────────────────────────────────────────────────────

def run_strategy(trades: list[dict], strategy: dict) -> dict | None:
    """
    단일 조건 히스토리컬 시뮬레이션.

    수익률 계산:
      - hold=5 : future_return_5d 사용 (공시일 close → +5영업일 close)
      - hold=20: future_return_20d 사용 (없으면 5d fallback)

    equity curve: 조건 충족 이벤트 날짜순, 복리 누적
    [참고] 실제 시장에서는 슬리피지·유동성 등 추가 변수 존재
    """
    threshold = strategy["threshold"]
    ev_filter = strategy["event"]
    hold      = strategy["hold"]

    # 조건 충족 이벤트 필터 (Signal Condition Met)
    filtered = [
        t for t in trades
        if t["signal_score"] >= threshold
        and (ev_filter is None or t["event_type"] == ev_filter)
    ]

    if not filtered:
        logger.warning(f"  [{strategy['id']}] 조건 충족 이벤트 없음 — 스킵")
        return None

    # 수익률 선택
    returns = []
    trade_rows = []
    for t in filtered:
        r = t["return_5d"] if hold == 5 else (t.get("return_20d") or t["return_5d"])
        if r is None:
            continue
        returns.append(r / 100.0)   # % → 소수
        trade_rows.append({"date": t["date"], "stock": t["stock_code"], "return_pct": round(r, 2)})

    if not returns:
        return None

    n = len(returns)

    # ── 기본 지표 ──
    win_count = sum(1 for r in returns if r > 0)
    win_rate  = win_count / n
    avg_ret   = sum(returns) / n
    std_ret   = math.sqrt(sum((r - avg_ret) ** 2 for r in returns) / max(n - 1, 1))
    sharpe    = (avg_ret / std_ret * math.sqrt(252 / hold)) if std_ret > 0 else 0.0

    # ── Equity Curve (날짜별 균등가중 포트폴리오 기준) ──
    # 동일 날짜에 여러 신호를 개별 복리로 연산하면 기하급수적 낙폭이 발생 → 날짜별 평균으로 보정
    daily_r: dict[str, list[float]] = defaultdict(list)
    for t, r in zip(trade_rows, returns):
        daily_r[t["date"]].append(r)
    sorted_days = sorted(daily_r.keys())
    period_rets = [sum(daily_r[d]) / len(daily_r[d]) for d in sorted_days]

    equity = 1.0
    curve  = []
    peak   = 1.0
    mdd    = 0.0
    for d, r in zip(sorted_days, period_rets):
        equity *= (1 + r)
        if equity > peak:
            peak = equity
        dd = (equity - peak) / peak
        if dd < mdd:
            mdd = dd
        curve.append({
            "date":       d,
            "equity":     round(equity, 4),
            "return_pct": round(r * 100, 2),
        })

    total_return = equity - 1.0

    return {
        "strategy_id":           strategy["id"],
        "strategy_label":        strategy["label"],
        "score_threshold":       threshold,
        "event_filter":          ev_filter,
        "hold_days":             hold,
        "total_return":          round(total_return, 4),
        "win_rate":              round(win_rate, 4),
        "avg_return_per_trade":  round(avg_ret, 4),
        "max_drawdown":          round(mdd, 4),
        "num_trades":            n,
        "sharpe_ratio":          round(sharpe, 3),
        "equity_curve":          curve,
        "computed_at":           datetime.now().isoformat(),
    }


# ── 결과 출력 ─────────────────────────────────────────────────────────────────

def print_result(r: dict) -> None:
    logger.info(f"\n  Condition    : {r['strategy_label']}")
    logger.info(f"  Events       : {r['num_trades']}")
    logger.info(f"  Cumul Return : {r['total_return']*100:+.1f}%  (historical, close-to-close)")
    logger.info(f"  Positive Rate: {r['win_rate']*100:.1f}%")
    logger.info(f"  Avg / Event  : {r['avg_return_per_trade']*100:+.2f}%")
    logger.info(f"  Max Drawdown : {r['max_drawdown']*100:.1f}%")
    logger.info(f"  Sharpe       : {r['sharpe_ratio']:.2f}")


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Signal Score 백테스트 엔진")
    parser.add_argument("--dry-run", action="store_true",
                        help="DB 저장 없이 결과만 출력")
    args = parser.parse_args()

    logger.info("=" * 55)
    logger.info("  run_backtest : Signal Score 히스토리컬 시뮬레이션")
    logger.info(f"  dry_run={args.dry_run}")
    logger.info("  [참고] 정보 제공 목적 / 투자 조언 아님")
    logger.info("=" * 55)

    sb = _get_supabase()

    # 전체 trade 데이터 로드 (1회만)
    all_trades = load_all_trades(sb)
    if not all_trades:
        logger.info("백테스트 데이터 없음. 종료.")
        sys.exit(0)

    # 전략별 실행
    results = []
    for strategy in STRATEGIES:
        logger.info(f"\n  [{strategy['id']}] 실행 중...")
        result = run_strategy(all_trades, strategy)
        if result:
            print_result(result)
            results.append(result)

    if not results:
        logger.info("결과 없음. 종료.")
        sys.exit(0)

    if args.dry_run:
        logger.info("\n  [DRY] backtest_results 저장 생략")
        sys.exit(0)

    # DB upsert
    logger.info("\n  backtest_results upsert 중...")
    for r in results:
        try:
            sb.table("backtest_results").upsert(
                r, on_conflict="strategy_id"
            ).execute()
            logger.info(f"  [OK] {r['strategy_id']} 저장")
        except Exception as e:
            logger.error(f"  [ERR] {r['strategy_id']} 저장 실패: {e}")

    logger.info("\n" + "=" * 55)
    logger.info("  run_backtest 완료")
    logger.info("=" * 55)


if __name__ == "__main__":
    main()
