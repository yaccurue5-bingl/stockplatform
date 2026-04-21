"""
scripts/compute_alpha_score.py
================================
통합 알파 스코어 (FINAL_ALPHA_SCORE) 계산.

공식 (모든 컴포넌트 0~100 통일):
  alpha_score =
      base_score   × 0.50   ← 종목 퀄리티
    + sector_score × 0.20   ← 섹터 강도
    + market_score × 0.10   ← 시장 방향성
    + regime_score × 0.20   ← 거시 환경 (RISK_ON)

컴포넌트 매핑:
  market_score  = Bullish→75 / Neutral→50 / Bearish→25   (없으면 50)
  regime_score  = min(100, max(0, risk_on_ratio × 100))
    risk_on_ratio: 공시일 직전 3영업일 foreign_net_buy_kospi 합계 > 0 → 1.0, 아니면 0.0

이론 범위: 2.5 (최소) ~ 97.5 (최대)
  최소: 0×0.5 + 0×0.2 + 25×0.1 + 0×0.2   = 2.5
  최대: 100×0.5 + 100×0.2 + 75×0.1 + 100×0.2 = 97.5

기준 해석:
  ≥ 80 : Strong   (강한 긍정)
  ≥ 65 : Positive (긍정)
  ≥ 50 : Neutral  (중립)
  ≥ 35 : Weak     (약한 부정)
  <  35 : Avoid   (회피)

원래 설계 대비 수정 사항:
  ① MarketSignalWeight 1.0/0.8/0.5/0.2 → 75/50/25 (0~100 스케일 통일)
     HIGH_CONVICTION은 sector_signals 레벨 — market_radar에 없으므로 제거
  ② RegimeWeight 1.2/0.8(배수) → risk_on_ratio×100 (0~100 스케일 통일)
     기존 배수 적용 시 실제 기여: 1.2×0.2 = 0.24 (사실상 무의미)

데이터 소스:
  - disclosure_insights.base_score        : 개별 공시 BaseScore
  - sector_signals.score                  : 섹터 점수 (최근일 기준)
  - market_radar.market_signal            : 시장 신호 (최근일 기준)
  - daily_indicators.foreign_net_buy_kospi: 외국인 순매수 (레짐 판정)

실행 순서 (EOD 파이프라인):
  compute_base_score → compute_sector_signals → compute_market_radar → compute_alpha_score

사용법:
  python scripts/compute_alpha_score.py            # 미계산 공시 처리
  python scripts/compute_alpha_score.py --recompute # 전체 재계산
  python scripts/compute_alpha_score.py --dry-run  # DB 저장 없이 출력만
"""

import os
import sys
import argparse
import logging
from datetime import datetime, date, timedelta
from pathlib import Path
from collections import defaultdict

try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("compute_alpha_score")

# ── 상수 ──────────────────────────────────────────────────────────────────────

WEIGHTS = {
    "base":    0.50,
    "sector":  0.20,
    "market":  0.10,
    "regime":  0.20,
}

MARKET_SCORE_MAP = {
    "Bullish": 75.0,
    "Neutral": 50.0,
    "Bearish": 25.0,
}
MARKET_SCORE_FALLBACK = 50.0

# RISK_ON 판정: 공시일 직전 N 영업일 합계
RISK_ON_LOOKBACK = 3

BATCH_SIZE = 100


# ── 수식 ──────────────────────────────────────────────────────────────────────

def compute_alpha(
    base_score: float,
    sector_score: float,
    market_signal: str,
    regime_score: float,
) -> float:
    """
    FINAL_ALPHA_SCORE 계산.
    regime_score: 0~100 (RISK_ON=100, RISK_OFF=0)
    """
    market_score = MARKET_SCORE_MAP.get(market_signal, MARKET_SCORE_FALLBACK)
    alpha = (
        base_score   * WEIGHTS["base"]
        + sector_score * WEIGHTS["sector"]
        + market_score * WEIGHTS["market"]
        + regime_score * WEIGHTS["regime"]
    )
    return round(max(0.0, min(100.0, alpha)), 4)


def alpha_label(score: float) -> str:
    if score >= 80: return "Strong"
    if score >= 65: return "Positive"
    if score >= 50: return "Neutral"
    if score >= 35: return "Weak"
    return "Avoid"


# ── Supabase ──────────────────────────────────────────────────────────────────

def get_supabase():
    if _supabase_create_client is None:
        logger.error("supabase 패키지 미설치: pip install supabase")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("Supabase 환경변수 누락")
        sys.exit(1)
    return _supabase_create_client(url, key)


# ── 데이터 조회 ───────────────────────────────────────────────────────────────

def fetch_disclosures(sb, recompute: bool) -> list[dict]:
    """base_score 있고 alpha_score 없는(또는 recompute=True) 공시 조회."""
    query = (
        sb.table("disclosure_insights")
        .select("id, stock_code, rcept_dt, base_score")
        .eq("analysis_status", "completed")
        .not_.is_("base_score", "null")
    )
    if not recompute:
        query = query.is_("alpha_score", "null")

    resp = query.order("rcept_dt", desc=True).limit(3000).execute()
    return resp.data or []


def fetch_sector_map(sb, stock_codes: list[str]) -> dict[str, str]:
    """stock_code → sector_en"""
    if not stock_codes:
        return {}
    sector_map: dict[str, str] = {}
    for i in range(0, len(stock_codes), 500):
        chunk = stock_codes[i:i+500]
        resp = (
            sb.table("companies")
            .select("stock_code, sector_en")
            .in_("stock_code", chunk)
            .not_.is_("sector_en", "null")
            .execute()
        )
        for row in resp.data or []:
            if row.get("stock_code") and row.get("sector_en"):
                sector_map[row["stock_code"]] = row["sector_en"]
    return sector_map


def fetch_latest_sector_scores(sb) -> dict[str, float]:
    """
    sector_signals 최근일 기준 sector_en → score 매핑.
    동일 sector_en이 여러 날짜 있으면 최신 날짜 우선.
    """
    resp = (
        sb.table("sector_signals")
        .select("sector_en, score, date")
        .order("date", desc=True)
        .limit(500)
        .execute()
    )
    sector_scores: dict[str, float] = {}
    for row in resp.data or []:
        se = row.get("sector_en")
        sc = row.get("score")
        if se and sc is not None and se not in sector_scores:
            sector_scores[se] = float(sc)
    logger.info(f"  sector_scores: {len(sector_scores)}개 섹터 로드")
    return sector_scores


def fetch_latest_market_signal(sb) -> str:
    """market_radar 최신 market_signal 조회."""
    resp = (
        sb.table("market_radar")
        .select("market_signal, date")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    data = resp.data or []
    if not data:
        logger.warning("  market_radar 데이터 없음 → Neutral fallback")
        return "Neutral"
    signal = data[0].get("market_signal") or "Neutral"
    logger.info(f"  market_signal: {signal} (date={data[0].get('date')})")
    return signal


def fetch_foreign_net_buy(sb, since_iso: str, until_iso: str) -> dict[str, float | None]:
    """daily_indicators → {date: foreign_net_buy_kospi}"""
    resp = (
        sb.table("daily_indicators")
        .select("date, foreign_net_buy_kospi")
        .gte("date", since_iso)
        .lte("date", until_iso)
        .execute()
    )
    result: dict[str, float | None] = {}
    for row in resp.data or []:
        d = row.get("date")
        val = row.get("foreign_net_buy_kospi")
        if d:
            try:
                result[d] = float(val) if val is not None else None
            except (ValueError, TypeError):
                result[d] = None
    return result


# ── RISK_ON 판정 ──────────────────────────────────────────────────────────────

def _prev_business_days(ref: date, n: int) -> list[date]:
    result: list[date] = []
    cur = ref - timedelta(days=1)
    while len(result) < n:
        if cur.weekday() < 5:
            result.append(cur)
        cur -= timedelta(days=1)
    return result


def build_regime_map(
    foreign_net_buy: dict[str, float | None],
    rcept_dates: set[str],
) -> dict[str, float]:
    """
    각 공시일별 regime_score (0 or 100) 반환.
    직전 RISK_ON_LOOKBACK 영업일 합계 > 0 → 100, 아니면 0.
    """
    regime: dict[str, float] = {}
    for ds in rcept_dates:
        try:
            ref = datetime.strptime(ds, "%Y%m%d").date()
        except ValueError:
            try:
                ref = date.fromisoformat(ds)
            except ValueError:
                regime[ds] = 0.0
                continue
        lookback = _prev_business_days(ref, RISK_ON_LOOKBACK)
        total = 0.0
        for bd in lookback:
            val = foreign_net_buy.get(bd.isoformat())
            if val is not None:
                total += val
        regime[ds] = 100.0 if total > 0 else 0.0
    return regime


# ── 저장 ──────────────────────────────────────────────────────────────────────

def save_alpha_scores(sb, updates: list[dict], dry_run: bool) -> tuple[int, int]:
    if dry_run:
        logger.info(f"  [DRY-RUN] {len(updates)}건 (저장 안함)")
        for r in updates[:8]:
            logger.info(
                f"    {r['id'][:8]}.. bs={r['_base']:.1f} sec={r['_sec']:.1f} "
                f"mkt={r['_mkt']:.0f} reg={r['_reg']:.0f} "
                f"→ alpha={r['alpha_score']:.1f} [{r['_label']}]"
            )
        return len(updates), 0

    success = failure = 0
    for row in updates:
        row_id = row["id"]
        payload = {"alpha_score": row["alpha_score"]}
        try:
            sb.table("disclosure_insights").update(payload).eq("id", row_id).execute()
            success += 1
        except Exception as e:
            failure += 1
            logger.error(f"  [ERROR] id={row_id[:8]}.. 저장 실패: {e}")
    return success, failure


def save_scores_log(sb, log_rows: list[dict], dry_run: bool) -> tuple[int, int]:
    """scores_log.alpha_score 업데이트 (disclosure_id 기준)."""
    if dry_run or not log_rows:
        return len(log_rows), 0

    success = failure = 0
    for i in range(0, len(log_rows), BATCH_SIZE):
        batch = log_rows[i:i+BATCH_SIZE]
        for row in batch:
            try:
                (
                    sb.table("scores_log")
                    .update({"alpha_score": row["alpha_score"]})
                    .eq("disclosure_id", row["disclosure_id"])
                    .execute()
                )
                success += 1
            except Exception as e:
                failure += 1
                logger.error(f"  [ERROR] disclosure_id={row['disclosure_id'][:8]}.. 저장 실패: {e}")
    return success, failure


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="통합 알파 스코어 계산")
    parser.add_argument("--dry-run",    action="store_true", help="DB 저장 없이 출력만")
    parser.add_argument("--recompute",  action="store_true", help="이미 계산된 항목도 재계산")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("  FINAL_ALPHA_SCORE 계산")
    logger.info(f"  모드: {'DRY-RUN' if args.dry_run else '실제 저장'}"
                + (" + 재계산" if args.recompute else ""))
    logger.info("=" * 60)

    sb = get_supabase()

    # 1. 공시 조회
    logger.info("\n  [1/5] 미계산 공시 조회...")
    rows = fetch_disclosures(sb, args.recompute)
    if not rows:
        logger.info("  계산할 공시 없음. 종료.")
        sys.exit(0)
    logger.info(f"  → {len(rows)}건")

    # 2. 섹터 매핑 + 섹터 점수
    logger.info("\n  [2/5] 섹터 데이터 조회...")
    stock_codes = list({r["stock_code"] for r in rows if r.get("stock_code")})
    sector_map    = fetch_sector_map(sb, stock_codes)
    sector_scores = fetch_latest_sector_scores(sb)

    # 3. 시장 신호
    logger.info("\n  [3/5] 시장 신호 조회...")
    market_signal = fetch_latest_market_signal(sb)

    # 4. RISK_ON 레짐
    logger.info("\n  [4/5] RISK_ON 레짐 계산...")
    rcept_dates = {str(r["rcept_dt"]) for r in rows if r.get("rcept_dt")}
    # 날짜 범위 (공시일 기준 ±7일 여유)
    dates_parsed: list[date] = []
    for ds in rcept_dates:
        try:
            dates_parsed.append(datetime.strptime(ds, "%Y%m%d").date())
        except ValueError:
            try:
                dates_parsed.append(date.fromisoformat(ds))
            except ValueError:
                pass
    if dates_parsed:
        min_date = (min(dates_parsed) - timedelta(days=10)).isoformat()
        max_date = max(dates_parsed).isoformat()
    else:
        today = date.today()
        min_date = (today - timedelta(days=40)).isoformat()
        max_date = today.isoformat()

    foreign_net_buy = fetch_foreign_net_buy(sb, min_date, max_date)
    regime_map = build_regime_map(foreign_net_buy, rcept_dates)
    risk_on_cnt = sum(1 for v in regime_map.values() if v == 100.0)
    logger.info(f"  RISK_ON 날짜: {risk_on_cnt}/{len(regime_map)}일")

    # 5. 알파 스코어 계산
    logger.info("\n  [5/5] alpha_score 계산 중...")
    updates:  list[dict] = []
    log_rows: list[dict] = []

    sector_miss = market_miss = regime_miss = 0

    for row in rows:
        base = float(row.get("base_score") or 0.0)
        sc   = row.get("stock_code") or ""
        rdt  = str(row.get("rcept_dt") or "")

        # 섹터 점수
        sector_en = sector_map.get(sc)
        sec_score = sector_scores.get(sector_en, 50.0) if sector_en else 50.0
        if not sector_en or sector_en not in sector_scores:
            sector_miss += 1

        # 시장 점수
        mkt_score = MARKET_SCORE_MAP.get(market_signal, MARKET_SCORE_FALLBACK)

        # 레짐 점수
        reg_score = regime_map.get(rdt, 50.0)   # 데이터 없으면 중립 50
        if rdt not in regime_map:
            regime_miss += 1

        alpha = compute_alpha(base, sec_score, market_signal, reg_score)
        label = alpha_label(alpha)

        updates.append({
            "id":          row["id"],
            "alpha_score": alpha,
            "_base":       base,
            "_sec":        sec_score,
            "_mkt":        mkt_score,
            "_reg":        reg_score,
            "_label":      label,
        })
        log_rows.append({
            "disclosure_id": row["id"],
            "alpha_score":   alpha,
        })

    # 통계
    alphas = [r["alpha_score"] for r in updates]
    label_dist = defaultdict(int)
    for r in updates:
        label_dist[r["_label"]] += 1

    logger.info(f"  alpha_score: min={min(alphas):.1f}  max={max(alphas):.1f}  avg={sum(alphas)/len(alphas):.1f}")
    logger.info(f"  분포: " + " / ".join(f"{k}={v}" for k, v in sorted(label_dist.items())))
    if sector_miss:
        logger.warning(f"  섹터 매핑 없음 (중립 50 적용): {sector_miss}건")
    if regime_miss:
        logger.warning(f"  레짐 데이터 없음 (중립 50 적용): {regime_miss}건")

    # 저장
    ins_ok, ins_fail = save_alpha_scores(sb, updates, args.dry_run)
    log_ok, log_fail = save_scores_log(sb, log_rows, args.dry_run)

    logger.info("=" * 60)
    logger.info(f"완료: disclosure_insights {ins_ok}건 / scores_log {log_ok}건")
    if ins_fail + log_fail:
        logger.error(f"실패: {ins_fail + log_fail}건")
    logger.info("=" * 60)

    sys.exit(0 if (ins_fail + log_fail) == 0 else 1)


if __name__ == "__main__":
    main()
