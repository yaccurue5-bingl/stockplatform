"""
backend/routers/v1/market_radar.py
====================================
GET /v1/market-radar

일별 시장 전체 신호 (Bullish/Bearish/Neutral) 및 요약.
market_radar 테이블 데이터를 반환합니다.

플랜 접근:
    PRO, ENTERPRISE: 최근 7일 / 전체 이력
"""

import logging
from datetime import date, timedelta
from typing import Optional

import os
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from backend.routers.v1.auth import require_plan, PLAN_HISTORY_DAYS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1", tags=["v1 - Market Radar"])


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class MarketRadarItem(BaseModel):
    date:               str
    market_signal:      Optional[str] = None
    top_sector:         Optional[str] = None
    top_sector_en:      Optional[str] = None
    foreign_flow:       Optional[str] = None
    kospi_change:       Optional[float] = None
    kosdaq_change:      Optional[float] = None
    total_disclosures:  int = 0
    summary:            Optional[str] = None


class MarketRadarResponse(BaseModel):
    data:  list[MarketRadarItem]
    total: int
    date_from: Optional[str] = None
    date_to:   Optional[str] = None


# ── Supabase 조회 ─────────────────────────────────────────────────────────────

def _get_supabase():
    from supabase import create_client
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return create_client(url, key)


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get(
    "/market-radar",
    response_model=MarketRadarResponse,
    summary="시장 레이더 조회",
    description=(
        "일별 시장 전체 신호(Bullish/Bearish/Neutral)와 KOSPI/KOSDAQ 등락률, "
        "주목 섹터, 요약 텍스트를 반환합니다.\n\n"
        "**플랜**: PRO (최근 7일), ENTERPRISE (전체 이력)"
    ),
)
async def get_market_radar(
    date_from: Optional[str] = Query(None, description="조회 시작일 (YYYY-MM-DD)"),
    date_to:   Optional[str] = Query(None, description="조회 종료일 (YYYY-MM-DD). 기본값: 오늘"),
    limit:     int            = Query(30, ge=1, le=90, description="최대 반환 건수"),
    user: dict = Depends(require_plan(["PRO", "ENTERPRISE"])),
):
    plan = user["plan"]
    history_days = PLAN_HISTORY_DAYS.get(plan, 7)

    # 날짜 범위 계산
    today = date.today()
    if date_to:
        try:
            dt_to = date.fromisoformat(date_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="date_to 형식 오류: YYYY-MM-DD")
    else:
        dt_to = today

    if date_from:
        try:
            dt_from = date.fromisoformat(date_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="date_from 형식 오류: YYYY-MM-DD")
    else:
        # 플랜별 최대 이력 제한
        if history_days > 0:
            dt_from = today - timedelta(days=history_days)
        else:
            dt_from = date(2020, 1, 1)  # ENTERPRISE: 전체

    # PRO 플랜은 7일 이상 조회 불가
    if history_days > 0 and (today - dt_from).days > history_days:
        dt_from = today - timedelta(days=history_days)
        logger.info(f"[market-radar] PRO 플랜 이력 제한: date_from → {dt_from}")

    try:
        sb = _get_supabase()
        resp = (
            sb.table("market_radar")
            .select("date, market_signal, top_sector, top_sector_en, foreign_flow, "
                    "kospi_change, kosdaq_change, total_disclosures, summary")
            .gte("date", dt_from.isoformat())
            .lte("date", dt_to.isoformat())
            .order("date", desc=True)
            .limit(limit)
            .execute()
        )
        rows = resp.data or []
    except Exception as e:
        logger.error(f"[market-radar] DB 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="데이터 조회 중 오류가 발생했습니다.")

    items = [MarketRadarItem(**row) for row in rows]
    return MarketRadarResponse(
        data=items,
        total=len(items),
        date_from=dt_from.isoformat(),
        date_to=dt_to.isoformat(),
    )
