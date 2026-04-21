"""
scripts/compute_market_radar.py
================================
sector_signals + market_indices를 집계하여 market_radar 테이블을 갱신.

로직:
  - 지정일(기본: 전 영업일)의 sector_signals 집계
  - market_signal: Bullish 섹터 수 vs Bearish 섹터 수로 결정
  - top_sector: Bullish 중 confidence 가장 높은 섹터
  - kospi_change / kosdaq_change: market_indices 현재값 (실시간 최신값)
  - foreign_flow: 외국인 순매수 여부 (현재 미구현, 'N/A' 기본값)
  - total_disclosures: sector_signals.disclosure_count 합계
  - summary: 자동 생성 텍스트

선행 작업:
  compute_sector_signals.py 먼저 실행 필요

사용법:
  python scripts/compute_market_radar.py             # 전 영업일
  python scripts/compute_market_radar.py --date 20260313
  python scripts/compute_market_radar.py --dry-run
"""

import os
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# ── supabase를 sys.path 수정 전에 먼저 import ─────────────────────────────────
# stockplatform/supabase/ 폴더와의 충돌 방지
try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

# ── 설정 ──────────────────────────────────────────────────────────────────────

BULLISH_MAJORITY = 0.50   # Bullish 섹터 비율이 이 이상이면 시장 Bullish
BEARISH_MAJORITY = 0.50   # Bearish 섹터 비율이 이 이상이면 시장 Bearish


def get_prev_business_day(ref: datetime = None) -> str:
    d = ref or datetime.now()
    d -= timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


# ── Supabase 연결 ─────────────────────────────────────────────────────────────

def get_supabase():
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지가 설치되지 않았습니다. pip install supabase 를 실행하세요.")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
        sys.exit(1)
    return create_client(url, key)


# ── 데이터 조회 ───────────────────────────────────────────────────────────────

def fetch_sector_signals(supabase, date_str: str) -> list[dict]:
    """해당 날짜 sector_signals 조회"""
    resp = (
        supabase.table("sector_signals")
        .select("*")
        .eq("date", date_str)
        .execute()
    )
    return resp.data or []


def fetch_market_indices(supabase) -> dict[str, float]:
    """market_indices 최신값 (KOSPI, KOSDAQ change_rate)"""
    resp = supabase.table("market_indices").select("symbol, change_rate").execute()
    result = {}
    for row in (resp.data or []):
        symbol = row.get("symbol", "")
        try:
            result[symbol] = float(row.get("change_rate") or 0)
        except (ValueError, TypeError):
            result[symbol] = 0.0
    return result


def fetch_foreign_flow(supabase, date_str: str) -> str:
    """
    daily_indicators 에서 외국인 순매수 KOSPI 조회 → 포맷 문자열 반환.
    date_str: YYYYMMDD 형식 → daily_indicators.date 는 YYYY-MM-DD
    반환 예시: "+8,300억원" / "-2,231억원" / "N/A"
    """
    iso_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
    try:
        resp = (
            supabase.table("daily_indicators")
            .select("foreign_net_buy_kospi, foreign_net_buy_kosdaq")
            .eq("date", iso_date)
            .limit(1)
            .execute()
        )
        data = resp.data
        if not data:
            print(f"  [WARN] daily_indicators 에 {iso_date} 데이터 없음 → N/A")
            return "N/A"

        kospi  = data[0].get("foreign_net_buy_kospi")
        kosdaq = data[0].get("foreign_net_buy_kosdaq")

        if kospi is None and kosdaq is None:
            return "N/A"

        # KOSPI 단독 우선, 없으면 KOSDAQ 사용, 둘 다 있으면 합산
        total: float
        if kospi is not None and kosdaq is not None:
            total = float(kospi) + float(kosdaq)
        elif kospi is not None:
            total = float(kospi)
        else:
            total = float(kosdaq)  # type: ignore[arg-type]

        sign = "+" if total >= 0 else ""
        if abs(total) >= 10_000:
            val = total / 10_000
            return f"{sign}{val:.1f}조원"
        else:
            return f"{sign}{int(round(total)):,}억원"

    except Exception as e:
        print(f"  [WARN] foreign_flow 조회 실패: {e}")
        return "N/A"


# ── 시장 신호 계산 ────────────────────────────────────────────────────────────

# sector_signals.signal 값 → Bullish/Bearish 매핑
# compute_sector_signals.py 기준:
#   HIGH_CONVICTION(≥70), CONSTRUCTIVE(≥55) → Bullish
#   NEUTRAL(≥40)                             → Neutral
#   NEGATIVE(≥25), HIGH_RISK(<25)            → Bearish
BULLISH_SIGNALS = {"HIGH_CONVICTION", "CONSTRUCTIVE"}
BEARISH_SIGNALS = {"NEGATIVE", "HIGH_RISK"}


def _quality_weight(s: dict) -> float:
    """
    Quality-weighted 투표 가중치: disclosure_count × score
    공시 건수가 많아도 score가 낮으면 영향력 감소.
    score 미존재 시 중립값 50 fallback.
    """
    count = float(s.get("disclosure_count") or 0)
    score = float(s.get("score") or 50.0)
    return count * score


def compute_market_signal(sector_signals: list[dict]) -> str:
    """섹터 신호 투표 → 시장 전체 신호 (disclosure_count × score 가중)"""
    if not sector_signals:
        return "Neutral"

    bullish_weight = sum(_quality_weight(s) for s in sector_signals if s["signal"] in BULLISH_SIGNALS)
    bearish_weight = sum(_quality_weight(s) for s in sector_signals if s["signal"] in BEARISH_SIGNALS)
    total_weight   = sum(_quality_weight(s) for s in sector_signals)

    if total_weight == 0:
        return "Neutral"

    if bullish_weight / total_weight >= BULLISH_MAJORITY:
        return "Bullish"
    elif bearish_weight / total_weight >= BEARISH_MAJORITY:
        return "Bearish"
    return "Neutral"


def get_top_sector(sector_signals: list[dict]) -> tuple[str | None, str | None]:
    """Bullish 섹터 중 confidence 최고 → (sector, sector_en)"""
    bullish = [s for s in sector_signals if s["signal"] in BULLISH_SIGNALS]
    if not bullish:
        # Bullish 없으면 disclosure_count 가장 많은 섹터
        if not sector_signals:
            return None, None
        top = max(sector_signals, key=lambda x: x["disclosure_count"])
    else:
        top = max(bullish, key=lambda x: x["confidence"])
    return top.get("sector"), top.get("sector_en")


def generate_summary(
    market_signal: str,
    top_sector: str | None,
    total_disclosures: int,
    bullish_cnt: int,
    bearish_cnt: int,
    neutral_cnt: int,
    kospi_change: float,
    kosdaq_change: float,
    date_str: str,
    foreign_flow: str = "N/A",
) -> str:
    """한국어 요약 텍스트 자동 생성"""
    date_fmt = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
    signal_ko = {"Bullish": "강세", "Bearish": "약세", "Neutral": "중립"}.get(market_signal, "중립")

    kospi_str = f"KOSPI {'▲' if kospi_change >= 0 else '▼'}{abs(kospi_change):.2f}%"
    kosdaq_str = f"KOSDAQ {'▲' if kosdaq_change >= 0 else '▼'}{abs(kosdaq_change):.2f}%"

    parts = [
        f"{date_fmt} 시장은 {signal_ko} 흐름을 보였습니다.",
        f"{kospi_str}, {kosdaq_str}.",
    ]

    if foreign_flow and foreign_flow != "N/A":
        parts.append(f"외국인 순매수: {foreign_flow}.")

    if top_sector:
        parts.append(f"주목 섹터: {top_sector}.")

    parts.append(
        f"총 {total_disclosures}건 공시 중 강세 {bullish_cnt}개 섹터, "
        f"약세 {bearish_cnt}개 섹터, 중립 {neutral_cnt}개 섹터."
    )

    return " ".join(parts)


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def save_to_db(supabase, row: dict) -> bool:
    try:
        supabase.table("market_radar").upsert(
            row,
            on_conflict="date"
        ).execute()
        return True
    except Exception as e:
        print(f"  [ERROR] 저장 실패: {e}")
        return False


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="시장 레이더 집계 (sector_signals → market_radar)")
    parser.add_argument("--date",    help="기준일 (YYYYMMDD). 미지정 시 전 영업일")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 출력만")
    args = parser.parse_args()

    date_str = args.date or get_prev_business_day()

    print("=" * 60)
    print("시장 레이더 집계")
    print(f"  기준일: {date_str}")
    print(f"  모드:   {'DRY-RUN' if args.dry_run else '실제 저장'}")
    print("=" * 60)

    supabase = get_supabase()

    # 1. sector_signals 조회
    print(f"  sector_signals 조회 중 (date={date_str})...")
    sector_signals = fetch_sector_signals(supabase, date_str)
    print(f"  {len(sector_signals)}개 섹터 신호 로드")

    if not sector_signals:
        print("[WARN] sector_signals 데이터가 없습니다 — 주말·공휴일 또는 compute_sector_signals 미실행.")
        print("  먼저 compute_sector_signals.py 를 실행하세요:")
        print(f"  python scripts/compute_sector_signals.py --date {date_str}")
        print("[INFO] market_radar 집계를 건너뜁니다. (정상 종료)")
        sys.exit(0)

    # 2. market_indices 조회
    print("  market_indices 조회 중...")
    indices = fetch_market_indices(supabase)
    kospi_change  = indices.get("KOSPI",  0.0)
    kosdaq_change = indices.get("KOSDAQ", 0.0)
    print(f"  KOSPI {kospi_change:+.2f}% / KOSDAQ {kosdaq_change:+.2f}%")

    # 3. 외국인 순매수 조회 (재정경제부 daily_indicators)
    print("  외국인 순매수 조회 중...")
    foreign_flow = fetch_foreign_flow(supabase, date_str)
    print(f"  외국인 순매수:    {foreign_flow}")

    # 4. 시장 신호 계산
    market_signal = compute_market_signal(sector_signals)
    top_sector, top_sector_en = get_top_sector(sector_signals)

    bullish_cnt = sum(1 for s in sector_signals if s["signal"] in BULLISH_SIGNALS)
    bearish_cnt = sum(1 for s in sector_signals if s["signal"] in BEARISH_SIGNALS)
    neutral_cnt = sum(1 for s in sector_signals if s["signal"] == "NEUTRAL")
    total_disclosures = sum(s["disclosure_count"] for s in sector_signals)

    # 5. 요약 생성
    summary = generate_summary(
        market_signal=market_signal,
        top_sector=top_sector,
        total_disclosures=total_disclosures,
        bullish_cnt=bullish_cnt,
        bearish_cnt=bearish_cnt,
        neutral_cnt=neutral_cnt,
        kospi_change=kospi_change,
        kosdaq_change=kosdaq_change,
        date_str=date_str,
        foreign_flow=foreign_flow,
    )

    row = {
        "date":              date_str,
        "market_signal":     market_signal,
        "top_sector":        top_sector,
        "top_sector_en":     top_sector_en,
        "foreign_flow":      foreign_flow,
        "kospi_change":      round(kospi_change, 2),
        "kosdaq_change":     round(kosdaq_change, 2),
        "total_disclosures": total_disclosures,
        "summary":           summary,
    }

    # 6. 결과 출력
    print()
    print(f"  시장 신호:        {market_signal}")
    print(f"  주목 섹터:        {top_sector or 'N/A'} ({top_sector_en or 'N/A'})")
    print(f"  외국인 순매수:    {foreign_flow}")
    print(f"  섹터 분포:        Bullish {bullish_cnt} / Bearish {bearish_cnt} / Neutral {neutral_cnt}")
    print(f"  총 공시:          {total_disclosures}건")
    print(f"  요약:")
    print(f"    {summary}")

    # 7. 저장
    if args.dry_run:
        print("\n[DRY-RUN] DB 저장 생략.")
        sys.exit(0)

    print(f"\n  Supabase 저장 중...")
    ok = save_to_db(supabase, row)

    print("=" * 60)
    if ok:
        print(f"완료: market_radar ({date_str}) 저장 성공")
    else:
        print(f"[ERROR] market_radar ({date_str}) 저장 실패")
    print("=" * 60)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
