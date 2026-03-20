"""
backend/routers/v1/sector_signals.py
======================================
GET /v1/sector-signals

섹터별 공시 감성 집계 신호 (Bullish/Bearish/Neutral).
sector_signals 테이블 데이터를 반환합니다.

플랜 접근:
    PRO, ENTERPRISE
"""

import logging
import os
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.routers.v1.auth import require_plan, PLAN_HISTORY_DAYS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1", tags=["v1 - Sector Signals"])


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class SectorSignalItem(BaseModel):
    date:              str
    sector:            str
    sector_en:         Optional[str] = None
    signal:            Optional[str] = None
    confidence:        Optional[float] = None
    disclosure_count:  int = 0
    positive_count:    int = 0
    negative_count:    int = 0
    neutral_count:     int = 0
    drivers:           Optional[list[str]] = None


class SectorSignalsResponse(BaseModel):
    data:       list[SectorSignalItem]
    total:      int
    date_from:  Optional[str] = None
    date_to:    Optional[str] = None


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    from supabase import create_client
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return create_client(url, key)


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get(
    "/sector-signals",
    response_model=SectorSignalsResponse,
    summary="섹터 신호 조회",
    description=(
        "섹터별 공시 감성 집계(Bullish/Bearish/Neutral)와 confidence, "
        "주요 이벤트 드라이버를 반환합니다.\n\n"
        "**플랜**: PRO (최근 7일), ENTERPRISE (전체 이력)"
    ),
)
async def get_sector_signals(
    date_from: Optional[str] = Query(None, description="조회 시작일 (YYYY-MM-DD)"),
    date_to:   Optional[str] = Query(None, description="조회 종료일 (YYYY-MM-DD). 기본값: 오늘"),
    sector:    Optional[str] = Query(None, description="특정 섹터 필터 (예: 반도체와 반도체장비)"),
    signal:    Optional[str] = Query(None, description="신호 필터: Bullish / Bearish / Neutral"),
    limit:     int            = Query(50, ge=1, le=200, description="최대 반환 건수"),
    user: dict = Depends(require_plan(["developer", "pro"])),
):
    plan = user["plan"]
    history_days = PLAN_HISTORY_DAYS.get(plan, 7)

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
        dt_from = today - timedelta(days=history_days) if history_days > 0 else date(2020, 1, 1)

    if history_days > 0 and (today - dt_from).days > history_days:
        dt_from = today - timedelta(days=history_days)

    # signal 유효성 검사
    if signal and signal not in ("Bullish", "Bearish", "Neutral"):
        raise HTTPException(status_code=400, detail="signal은 Bullish, Bearish, Neutral 중 하나여야 합니다.")

    try:
        sb = _get_supabase()
        query = (
            sb.table("sector_signals")
            .select(
                "date, sector, sector_en, signal, confidence, "
                "disclosure_count, positive_count, negative_count, neutral_count, drivers"
            )
            .gte("date", dt_from.isoformat())
            .lte("date", dt_to.isoformat())
            .order("date", desc=True)
            .order("disclosure_count", desc=True)
        )

        if sector:
            query = query.eq("sector", sector)
        if signal:
            query = query.eq("signal", signal)

        resp = query.limit(limit).execute()
        rows = resp.data or []
    except Exception as e:
        logger.error(f"[sector-signals] DB 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="데이터 조회 중 오류가 발생했습니다.")

    items = [SectorSignalItem(**row) for row in rows]
    return SectorSignalsResponse(
        data=items,
        total=len(items),
        date_from=dt_from.isoformat(),
        date_to=dt_to.isoformat(),
    )
