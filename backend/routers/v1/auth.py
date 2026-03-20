"""
backend/routers/v1/auth.py
===========================
B2B API 인증 / 플랜 확인 공통 의존성.

사용법:
    from backend.routers.v1.auth import require_plan

    @router.get("/v1/market-radar")
    async def endpoint(user=Depends(require_plan(["developer", "pro"]))):
        ...

플랜 계층:
    free      → /v1/ 접근 불가 (랜딩 UI 노출만)
    developer → disclosures 제한 접근, 최근 3일
    pro       → 모든 엔드포인트, 최근 30일

인증 방식:
    X-API-Key: <api_key>  헤더
    또는  ?api_key=<api_key>  쿼리 파라미터 (레거시 호환)
"""

import os
import logging
from functools import lru_cache
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader, APIKeyQuery

logger = logging.getLogger(__name__)

# ── API 키 추출기 ─────────────────────────────────────────────────────────────

_header_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)
_query_scheme  = APIKeyQuery(name="api_key",    auto_error=False)

# ── 플랜 계층 정의 ────────────────────────────────────────────────────────────

PLAN_RANK = {
    "free":       0,
    "developer":  1,
    "pro":        2,
}

# 플랜별 이력 조회 가능 일수 (-1 = 무제한)
PLAN_HISTORY_DAYS = {
    "free":       0,
    "developer":  3,
    "pro":        30,
}


def _get_supabase():
    """Supabase 클라이언트 (service role). 요청별로 재사용."""
    from supabase import create_client
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="서버 설정 오류: Supabase 환경변수 누락",
        )
    return create_client(url, key)


async def _resolve_api_key(
    header_key: str | None,
    query_key:  str | None,
) -> dict:
    """
    API 키로 users 레코드 조회.
    반환: {"id": ..., "email": ..., "plan": "PRO", ...}
    """
    api_key = header_key or query_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API 키가 필요합니다. X-API-Key 헤더 또는 api_key 쿼리 파라미터를 제공하세요.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    try:
        sb = _get_supabase()
        resp = (
            sb.table("users")
            .select("id, email, plan")
            .eq("api_key", api_key)
            .single()
            .execute()
        )
        user = resp.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[auth] API 키 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="인증 서비스 일시 오류",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 API 키입니다.",
        )

    return user


def require_plan(min_plans: list[str]):
    """
    최소 플랜 요구 의존성 팩토리.

    사용:
        Depends(require_plan(["developer", "pro"]))
    """
    async def _dependency(
        header_key: str | None = Security(_header_scheme),
        query_key:  str | None = Security(_query_scheme),
    ) -> dict:
        user = await _resolve_api_key(header_key, query_key)
        # DB 값은 소문자 (free / developer / pro)
        plan = (user.get("plan") or "free").lower()

        if plan not in min_plans:
            min_rank  = min(PLAN_RANK.get(p, 99) for p in min_plans)
            user_rank = PLAN_RANK.get(plan, 0)
            if user_rank < min_rank:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        f"이 엔드포인트는 {'/'.join(min_plans)} 플랜 이상에서 사용 가능합니다. "
                        f"현재 플랜: {plan}"
                    ),
                )

        return {**user, "plan": plan}

    return _dependency
