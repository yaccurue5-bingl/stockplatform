"""
backend/routers/v1/disclosures.py
===================================
GET /v1/disclosures

기업 공시 + AI 분석 결과 목록.
disclosure_insights 테이블 데이터를 반환합니다.

플랜 접근:
    developer : 최근 3일, is_visible=true 항목만, 기본 AI 요약 + 스코어
    pro       : 최근 30일, 모든 항목, 상세 분석 포함

캐시:
    TTL 300 초 (5 min)  —  키: plan + 쿼리 파라미터 전체 해시
"""

import json
import logging
from datetime import date, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from backend.routers.v1.auth import require_plan, PLAN_HISTORY_DAYS
from backend.core.cache import make_cache_key, cache_get, cache_set, TTL_DISCLOSURES
from backend.core.db import get_supabase

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
    sentiment_score:         Optional[float] = None
    short_term_impact_score: Optional[int]   = None
    event_type:      Optional[str] = None
    ai_summary:      Optional[str] = None
    # 스코어 (developer+): BaseScore · FinalScore · 시그널 태그
    base_score:      Optional[float] = None
    final_score:     Optional[float] = None
    signal_tag:      Optional[str]   = None
    # AI 추출 핵심 수치 (developer+): {"Revenue": "1.2T KRW", ...}
    key_numbers:     Optional[dict]  = None
    # pro 전용: 상세 분석

    @field_validator("key_numbers", mode="before")
    @classmethod
    def parse_key_numbers(cls, v: Any) -> Optional[dict]:
        """DB에서 JSON string으로 올 경우 dict로 변환"""
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else None
            except (json.JSONDecodeError, ValueError):
                return None
        return None
    headline:        Optional[str]   = None
    financial_impact: Optional[str]  = None
    base_score_raw:  Optional[float] = None
    risk_factors:    Optional[str]   = None


class DisclosuresResponse(BaseModel):
    data:      list[DisclosureItem]
    total:     int
    date_from: Optional[str] = None
    date_to:   Optional[str] = None


# ── 컬럼 정의 ─────────────────────────────────────────────────────────────────

# developer: 기본 컬럼 + 스코어 + key_numbers
_DEV_COLUMNS = (
    "id, rcept_no, corp_name, stock_code, report_nm, rcept_dt, "
    "sentiment_score, short_term_impact_score, event_type, ai_summary, "
    "base_score, final_score, signal_tag, key_numbers"
)
# pro: 상세 분석 추가
_PRO_COLUMNS = _DEV_COLUMNS + (
    ", headline, financial_impact, base_score_raw, risk_factors"
)


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get(
    "/disclosures",
    response_model=DisclosuresResponse,
    summary="공시 목록 조회",
    description=(
        "기업 공시와 AI 분석 요약을 반환합니다.\n\n"
        "**developer**: 최근 3일, 게시 공시만, 기본 AI 요약 + 스코어\n"
        "**pro**: 최근 30일, 전체 항목, 상세 분석 포함"
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
    history_days = PLAN_HISTORY_DAYS.get(plan, 3)
    is_pro = (plan == "pro")

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

    # ── 파라미터 검증 ──────────────────────────────────────────────────────────
    if sentiment and sentiment.upper() not in ("POSITIVE", "NEGATIVE", "NEUTRAL"):
        raise HTTPException(
            status_code=400,
            detail="sentiment는 POSITIVE, NEGATIVE, NEUTRAL 중 하나여야 합니다. (sentiment_score 기준: ≥0.3 POSITIVE, ≤-0.3 NEGATIVE)",
        )

    # rcept_dt 는 YYYYMMDD TEXT
    dt_from_str = dt_from.strftime("%Y%m%d")
    dt_to_str   = dt_to.strftime("%Y%m%d")

    _SORT_WHITELIST = {"rcept_dt", "final_score", "base_score"}
    sort_col = sort_by if sort_by in _SORT_WHITELIST else "rcept_dt"

    # ── 캐시 조회 ──────────────────────────────────────────────────────────────
    cache_key = make_cache_key(
        "v1:disclosures",
        plan=plan,
        dt_from=dt_from_str,
        dt_to=dt_to_str,
        stock_code=stock_code or "",
        sentiment=(sentiment or "").upper(),
        event_type=event_type or "",
        sort_by=sort_col,
        limit=limit,
    )
    cached = await cache_get(cache_key)
    if cached:
        return DisclosuresResponse(**cached)

    # ── Supabase 쿼리 ──────────────────────────────────────────────────────────
    try:
        sb = get_supabase()
        columns = _PRO_COLUMNS if is_pro else _DEV_COLUMNS

        query = (
            sb.table("disclosure_insights")
            .select(columns)
            .gte("rcept_dt", dt_from_str)
            .lte("rcept_dt", dt_to_str)
            .eq("analysis_status", "completed")
            .order(sort_col, desc=True, nullsfirst=False)
        )

        # developer 플랜: is_visible=true 항목만
        if not is_pro:
            query = query.eq("is_visible", True)

        if stock_code:
            query = query.eq("stock_code", stock_code)
        if sentiment:
            s = sentiment.upper()
            if s == "POSITIVE":
                query = query.gte("sentiment_score", 0.3)
            elif s == "NEGATIVE":
                query = query.lte("sentiment_score", -0.3)
            else:  # NEUTRAL
                query = query.gt("sentiment_score", -0.3).lt("sentiment_score", 0.3)
        if event_type:
            query = query.eq("event_type", event_type)

        resp = query.limit(limit).execute()
        rows = resp.data or []
    except Exception as e:
        logger.error(f"[disclosures] DB 조회 오류: {e}")
        raise HTTPException(status_code=500, detail="데이터 조회 중 오류가 발생했습니다.")

    items = [DisclosureItem(**row) for row in rows]
    result = DisclosuresResponse(
        data=items,
        total=len(items),
        date_from=dt_from.isoformat(),
        date_to=dt_to.isoformat(),
    )

    # ── 캐시 저장 ──────────────────────────────────────────────────────────────
    await cache_set(cache_key, result.model_dump(), TTL_DISCLOSURES)

    return result
