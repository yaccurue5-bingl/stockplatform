"""
backend/core/config.py
======================
서버 전역 설정 및 환경변수 관리.
main.py 시작 시 1회만 호출되며, 이후 모든 라우터/서비스에서 재사용합니다.
"""

import os
from pathlib import Path


# ── 프로젝트 루트 (backend/core/config.py 기준 두 단계 위) ──────────────────
PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent


def load_env() -> None:
    """
    .env.local 파일에서 환경변수를 로드합니다.
    기존 utils/env_loader.py를 재사용하되,
    프로젝트 루트를 명시적으로 전달합니다.
    """
    try:
        from utils.env_loader import load_env as _load
        _load()
    except Exception as e:
        print(f"[config] 환경변수 로드 실패: {e}")

    # 환경변수 alias 정규화 (기존 main.py 로직 그대로 유지)
    if os.getenv("SUPABASE_SERVICE_ROLE_KEY") and not os.getenv("SUPABASE_SERVICE_KEY"):
        os.environ["SUPABASE_SERVICE_KEY"] = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    if os.getenv("NEXT_PUBLIC_SUPABASE_URL") and not os.getenv("SUPABASE_URL"):
        os.environ["SUPABASE_URL"] = os.environ["NEXT_PUBLIC_SUPABASE_URL"]


def get_supabase_url() -> str:
    return os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL", "")


def get_supabase_service_key() -> str:
    return (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or ""
    )


def get_dart_api_key() -> str:
    return os.getenv("DART_API_KEY", "")
