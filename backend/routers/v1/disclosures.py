"""
backend/routers/v1/disclosures.py
===================================
GET /v1/disclosures

기업 공시 + AI 분석 결과 목록.
disclosure_insights 테이블 데이터를 반환합니다.

플랜 접근:
    PRO      : 최근 7일, is_visible=true 항목만, AI 요약 포함
    ENTERPRISE: 전체 이력, 모든 항목, 상세 분석 포함
"""

import logging
import os
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.routers.v1.auth import require_plan, PLAN_HISTORY_DAYS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1", tags=["v1 - Disclosures"])


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class DisclosureItem(BaseModel):
    id:              str
    rcept_no:        str
    corp_name:       str
    stock_code:      Optional[str] = None
    report_nm:       str
    rcept_dt:        str
    sentiment:       Optional[str] = None
    sentiment_score: Optional[float] = None
    importance:      Optional[str] = None
    event_type:      Optional[str] = None
    ai_summary:      Optional[str] = None
    # 스코어 (PRO+): BaseScore · FinalScore · 시그널 태그
    base_score:      Optional[float] = None
    final_score:     Optional[float] = None
    signal_tag:      Optional[str]   = None
    # ENTERPRISE 전용: 상세 분석
    headline:               Optional[str]   = None
    financial_impact:       Optional[str]   = None
    short_term_impact_score: Optional[int]  = None
    base_score_raw:         Optional[float] = None
    analysis:               Optional[str]   = None
    risk_factors:           Optional[str]   = None


class DisclosuresResponse(BaseModel):
    data:      list[DisclosureItem]
    total:     int
    date_from: Optional[str] = None
    date_to:   Optional[str] = None


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    from supabase import create_client
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return create_client(url, key)


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

# PRO: 기본 컬럼 + 스코어
_PRO_COLUMNS = (
    "id, rcept_no, corp_name, stock_code, report_nm, rcept_dt, "
    "sentiment, sentiment_score, importance, event_type, ai_summary, "
    "base_score, final_score, signal_tag"
)
# ENTERPRISE: 상세 분석 추가
_ENT_COLUMNS = _PRO_COLUMNS + (
    ", headline, financial_impact, short_term_impact_score, "
    "base_score_raw, analysis, risk_factors"
)


@router.get(
    "/disclosures",
    response_model=DisclosuresResponse,
    summary="공시 목록 조회",
    description=(
        "기업 공시와 AI 분석 요약을 반환합니다.\n\n"
        "**PRO**: 최근 7일, 게시 공시만, 기본 AI 요약 포함\n"
        "**ENTERPRISE**: 전체 이력, 상세 분석 포함"
    ),
)
async def get_disclosures(
    date_from:  Optional[str] = Query(None, description="조회 시작일 (YYYY-MM-DD)"),
    date_to:    Optional[str] = Query(None, description="조회 종료일 (YYYY-MM-DD). 기본값: 오늘"),
    stock_code: Optional[str] = Query(None, description="종목코드 필터 (예: 005930)"),
    sentiment:  Optional[str] = Query(None, description="감성 필터: POSITIVE / NEGATIVE / NEUTRAL"),
    event_type: Optional[str] = Query(None, description="이벤트 유형 필터"),
    sort_by:    Optional[str] = Query(None, description="정렬 기준: rcept_dt (기본) / final_score / base_score"),
    limit:      int            = Query(50, ge=1, le=200, description="최대 반환 건수"),
    user: dict = Depends(require_plan(["developer", "pro"])),
):
    plan = user["plan"]
    history_days = PLAN_HISTORY_DAYS.get(plan, 7)
    is_enterprise = (plan == "pro")

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

    # 감성 유효성 검사
    if sentiment and sentiment.upper() not in ("POSITIVE", "NEGATIVE", "NEUTRAL"):
        raise HTTPException(status_code=400, detail="sentiment는 POSITIVE, NEGATIVE, NEUTRAL 중 하나여야 합니다.")

    # rcept_dt는 YYYYMMDD TEXT → gte/lte 비교 시 ISO 형식 변환 필요
    dt_from_str = dt_from.strftime("%Y%m%d")
    dt_to_str   = dt_to.strftime("%Y%m%d")

    try:
        sb = _get_supabase()
        columns = _ENT_COLUMNS if is_enterprise else _PRO_COLUMNS

        # 정렬 기준 결정
        _SORT_WHITELIST = {"rcept_dt", "final_score", "base_score"}
        sort_col = sort_by if sort_by in _SORT_WHITELIST else "rcept_dt"

        query = (
            sb.table("disclosure_insights")
            .select(columns)
            .gte("rcept_dt", dt_from_str)
            .lte("rcept_dt", dt_to_str)
            .eq("analysis_status", "completed")
            .order(sort_col, desc=True, nulls_first=False)
        )

        # PRO: is_visible=true 항목만
        if not is_enterprise:
            query = query.eq("is_visible", True)

        if stock_code:
            query = query.eq("stock_code", stock_code)
        if sentiment:
            query = query.eq("sentiment", sentiment.upper())
        if event_type:
            query = query.eq("event_type", event_type)

        resp = query.limit(limit).execute()
        rows = resp.data or []
    except Exception as e:
        logger.error(f"[disclosures] DB 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="데이터 조회 중 오류가 발생했습니다.")

    items = [DisclosureItem(**row) for row in rows]
    return DisclosuresResponse(
        data=items,
        total=len(items),
        date_from=dt_from.isoformat(),
        date_to=dt_to.isoformat(),
    )
