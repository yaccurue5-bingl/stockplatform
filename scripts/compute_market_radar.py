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
    from supabase import create_client
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


# ── 시장 신호 계산 ────────────────────────────────────────────────────────────

def compute_market_signal(sector_signals: list[dict]) -> str:
    """섹터 신호 투표 → 시장 전체 신호"""
    if not sector_signals:
        return "Neutral"

    # disclosure_count 가중 투표
    bullish_weight = sum(
        s["disclosure_count"] for s in sector_signals if s["signal"] == "Bullish"
    )
    bearish_weight = sum(
        s["disclosure_count"] for s in sector_signals if s["signal"] == "Bearish"
    )
    total_weight = sum(s["disclosure_count"] for s in sector_signals)

    if total_weight == 0:
        return "Neutral"

    if bullish_weight / total_weight >= BULLISH_MAJORITY:
        return "Bullish"
    elif bearish_weight / total_weight >= BEARISH_MAJORITY:
        return "Bearish"
    return "Neutral"


def get_top_sector(sector_signals: list[dict]) -> tuple[str | None, str | None]:
    """Bullish 섹터 중 confidence 최고 → (sector, sector_en)"""
    bullish = [s for s in sector_signals if s["signal"] == "Bullish"]
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
        print("[WARN] sector_signals 데이터가 없습니다.")
        print("  먼저 compute_sector_signals.py 를 실행하세요:")
        print(f"  python scripts/compute_sector_signals.py --date {date_str}")
        sys.exit(1)

    # 2. market_indices 조회
    print("  market_indices 조회 중...")
    indices = fetch_market_indices(supabase)
    kospi_change  = indices.get("KOSPI",  0.0)
    kosdaq_change = indices.get("KOSDAQ", 0.0)
    print(f"  KOSPI {kospi_change:+.2f}% / KOSDAQ {kosdaq_change:+.2f}%")

    # 3. 시장 신호 계산
    market_signal = compute_market_signal(sector_signals)
    top_sector, top_sector_en = get_top_sector(sector_signals)

    bullish_cnt = sum(1 for s in sector_signals if s["signal"] == "Bullish")
    bearish_cnt = sum(1 for s in sector_signals if s["signal"] == "Bearish")
    neutral_cnt = sum(1 for s in sector_signals if s["signal"] == "Neutral")
    total_disclosures = sum(s["disclosure_count"] for s in sector_signals)

    # 4. 요약 생성
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
    )

    row = {
        "date":              date_str,
        "market_signal":     market_signal,
        "top_sector":        top_sector,
        "top_sector_en":     top_sector_en,
        "foreign_flow":      "N/A",      # 추후 외국인 순매수 API 연동 시 업데이트
        "kospi_change":      round(kospi_change, 2),
        "kosdaq_change":     round(kosdaq_change, 2),
        "total_disclosures": total_disclosures,
        "summary":           summary,
    }

    # 5. 결과 출력
    print()
    print(f"  시장 신호:        {market_signal}")
    print(f"  주목 섹터:        {top_sector or 'N/A'} ({top_sector_en or 'N/A'})")
    print(f"  섹터 분포:        Bullish {bullish_cnt} / Bearish {bearish_cnt} / Neutral {neutral_cnt}")
    print(f"  총 공시:          {total_disclosures}건")
    print(f"  요약:")
    print(f"    {summary}")

    # 6. 저장
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
