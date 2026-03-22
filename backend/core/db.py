"""
backend/core/db.py
==================
Supabase 클라이언트 싱글톤.

각 라우터에서 매 요청마다 create_client() 를 호출하는 대신
모듈 레벨에서 1회만 초기화하여 커넥션 오버헤드를 없앱니다.

사용법:
    from backend.core.db import get_supabase

    sb = get_supabase()
    resp = sb.table("disclosure_insights").select("*").execute()
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_client: Optional[object] = None


def get_supabase():
    """
    Supabase 클라이언트를 반환합니다.

    - 첫 호출 시 create_client() 로 초기화
    - 이후 동일 인스턴스 재사용 (프로세스 당 1개)
    - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 시 RuntimeError
    """
    global _client
    if _client is not None:
        return _client

    from supabase import create_client
    from backend.core.config import get_supabase_url, get_supabase_service_key

    url = get_supabase_url()
    key = get_supabase_service_key()

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다."
        )

    _client = create_client(url, key)
    logger.info("[db] Supabase 클라이언트 초기화 완료")
    return _client
