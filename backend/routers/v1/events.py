"""
backend/routers/v1/events.py
==============================
GET /v1/events

기업 이벤트 통계 (유상증자, 자사주, 배당 등 이벤트별 주가 반응 통계).
event_stats + disclosure_insights 테이블 데이터를 반환합니다.

이전: event_statistics + disclosure_events (구 파이프라인, 더 이상 갱신 안 됨)
현재: event_stats (backfill_prices --stats-only 로 갱신)
      disclosure_insights (dart_crawler + auto_analyst 로 갱신)

플랜 접근:
    developer, pro

캐시:
    TTL 3600 초 (60 min)  —  event_stats 는 backfill_prices --stats-only 후 갱신됨
"""

import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.routers.v1.auth import require_plan, PLAN_HISTORY_DAYS
from backend.core.cache import make_cache_key, cache_get, cache_set, TTL_EVENTS
from backend.core.db import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1", tags=["v1 - Corporate Events"])


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class EventStatItem(BaseModel):
    """
    이벤트 유형별 주가 반응 통계.
    event_stats 테이블 기반 (backfill_prices --stats-only 로 갱신).
    avg_5d_return: 공시 후 5거래일 평균 수익률 (%)
    std_5d:        표준편차
    sample_size:   통계 샘플 수
    """
    event_type:      str
    avg_5d_return:   Optional[float] = None
    avg_20d_return:  Optional[float] = None
    std_5d:          Optional[float] = None
    sample_size:     Optional[int]   = None


class RecentEventItem(BaseModel):
    """
    최근 공시 이벤트 목록.
    disclosure_insights 테이블 기반 (실시간 파이프라인 갱신).
    final_score: AI + LPS 반영 종합 스코어 (0~100)
    signal_tag:  매매 시그널 (BUY / HOLD / SELL 등)
    """
    stock_code:      str
    corp_name:       Optional[str]   = None
    event_type:      str
    disclosure_date: str             # rcept_dt (YYYYMMDD)
    final_score:     Optional[float] = None
    signal_tag:      Optional[str]   = None


class EventsResponse(BaseModel):
    statistics:    list[EventStatItem]
    recent_events: list[RecentEventItem]
    date_from:     Optional[str] = None
    date_to:       Optional[str] = None


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get(
    "/events",
    response_model=EventsResponse,
    summary="기업 이벤트 통계 조회",
    description=(
        "이벤트 유형별 평균 주가 반응(5일/20일 수익률)과 최근 공시 이벤트 목록을 반환합니다.\n\n"
        "**통계**: 공시 후 5거래일 평균 수익률, 표준편차, 샘플 수\n\n"
        "**developer**: 이벤트 통계 + 최근 3일 이벤트\n"
        "**pro**: 이벤트 통계 + 최근 30일 이벤트"
    ),
)
async def get_events(
    date_from:  Optional[str] = Query(None, description="최근 이벤트 시작일 (YYYY-MM-DD)"),
    date_to:    Optional[str] = Query(None, description="최근 이벤트 종료일 (YYYY-MM-DD)"),
    stock_code: Optional[str] = Query(None, description="종목코드 필터"),
    event_type: Optional[str] = Query(None, description="이벤트 유형 필터"),
    limit:      int            = Query(50, ge=1, le=200, description="최근 이벤트 최대 건수"),
    user: dict = Depends(require_plan(["developer", "pro"])),
):
    plan = user["plan"]
    history_days = PLAN_HISTORY_DAYS.get(plan, 3)

    today = date.today()

    # ── 날짜 범위 계산 ─────────────────────────────────────────────────────────
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

    # ── 캐시 조회 ──────────────────────────────────────────────────────────────
    cache_key = make_cache_key(
        "v1:events",
        plan=plan,
        dt_from=dt_from.isoformat(),
        dt_to=dt_to.isoformat(),
        stock_code=stock_code or "",
        event_type=event_type or "",
        limit=limit,
    )
    cached = await cache_get(cache_key)
    if cached:
        return EventsResponse(**cached)

    # ── Supabase 쿼리 (2개) ────────────────────────────────────────────────────
    try:
        sb = get_supabase()

        # ① 이벤트 통계 — event_stats (backfill_prices --stats-only 로 갱신)
        stat_query = (
            sb.table("event_stats")
            .select("event_type, avg_5d_return, avg_20d_return, std_5d, sample_size")
            .order("sample_size", desc=True)
        )
        if event_type:
            stat_query = stat_query.eq("event_type", event_type)

        stat_resp = stat_query.execute()
        statistics = [EventStatItem(**row) for row in (stat_resp.data or [])]

        # ② 최근 이벤트 목록 — disclosure_insights (실시간 파이프라인)
        # rcept_dt 는 YYYYMMDD TEXT → 문자열 대소비교로 날짜 필터
        dt_from_str = dt_from.strftime("%Y%m%d")
        dt_to_str   = dt_to.strftime("%Y%m%d")

        ev_query = (
            sb.table("disclosure_insights")
            .select("stock_code, corp_name, event_type, rcept_dt, final_score, signal_tag")
            .gte("rcept_dt", dt_from_str)
            .lte("rcept_dt", dt_to_str)
            .not_.is_("event_type", "null")
            .eq("is_visible", True)
            .order("rcept_dt", desc=True)
        )
        if stock_code:
            ev_query = ev_query.eq("stock_code", stock_code)
        if event_type:
            ev_query = ev_query.eq("event_type", event_type)

        ev_resp = ev_query.limit(limit).execute()
        recent_events = [
            RecentEventItem(
                stock_code=row["stock_code"],
                corp_name=row.get("corp_name"),
                event_type=row["event_type"],
                disclosure_date=row["rcept_dt"],
                final_score=row.get("final_score"),
                signal_tag=row.get("signal_tag"),
            )
            for row in (ev_resp.data or [])
        ]

    except Exception as e:
        logger.error(f"[events] DB 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="데이터 조회 중 오류가 발생했습니다.")

    result = EventsResponse(
        statistics=statistics,
        recent_events=recent_events,
        date_from=dt_from.isoformat(),
        date_to=dt_to.isoformat(),
    )

    # ── 캐시 저장 ──────────────────────────────────────────────────────────────
    await cache_set(cache_key, result.model_dump(), TTL_EVENTS)

    return result
