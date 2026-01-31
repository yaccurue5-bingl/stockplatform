"""
환경변수 로더 유틸리티
===================

.env.local 파일에서 환경변수를 로드하고,
Next.js와 호환되는 NEXT_PUBLIC_ 접두사를 처리합니다.

사용법:
    from utils.env_loader import load_env, get_supabase_config

    # 환경변수 로드
    load_env()

    # Supabase 설정 가져오기
    url, key = get_supabase_config()
"""

import os
from pathlib import Path
from typing import Tuple, Optional


def load_env(env_file: str = ".env.local") -> None:
    """
    .env.local 파일에서 환경변수를 로드합니다.

    Args:
        env_file: 환경변수 파일명 (기본값: .env.local)
    """
    try:
        from dotenv import load_dotenv

        # 프로젝트 루트 찾기
        current_file = Path(__file__).resolve()
        project_root = current_file.parent.parent

        # .env.local 파일 경로 (여러 위치 시도)
        possible_paths = [
            project_root / env_file,  # 프로젝트 루트
            Path("C:/stockplatform") / env_file,  # Windows 절대 경로
            Path("/home/user/stockplatform") / env_file,  # Linux 절대 경로
        ]

        loaded = False
        for env_path in possible_paths:
            if env_path.exists():
                load_dotenv(dotenv_path=env_path, override=True)
                print(f"✅ 환경변수 로드 완료: {env_path}")
                loaded = True
                break

        if not loaded:
            print(f"⚠️  {env_file} 파일을 찾을 수 없습니다. 다음 경로를 확인했습니다:")
            for p in possible_paths:
                print(f"   - {p}")
            # 기본 .env 파일도 시도
            default_env = project_root / ".env"
            if default_env.exists():
                load_dotenv(dotenv_path=default_env, override=True)
                print(f"✅ 환경변수 로드 완료: {default_env}")
            else:
                print("⚠️  환경변수 파일이 없습니다.")

    except ImportError:
        print("경고: python-dotenv가 설치되지 않았습니다.")


def get_supabase_config(use_service_role: bool = True) -> Tuple[Optional[str], Optional[str]]:
    """
    Supabase 설정을 가져옵니다.

    Args:
        use_service_role: True이면 SERVICE_ROLE_KEY를 우선 사용 (서버 사이드용),
                         False이면 ANON_KEY를 우선 사용 (클라이언트용)

    Returns:
        (supabase_url, supabase_key) 튜플
    """
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")

    if use_service_role:
        # 서버 사이드: SERVICE_ROLE_KEY 우선 사용
        supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
            os.getenv("SUPABASE_SERVICE_KEY") or
            os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or
            os.getenv("SUPABASE_ANON_KEY")
        )
    else:
        # 클라이언트 사이드: ANON_KEY 우선 사용
        supabase_key = (
            os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or
            os.getenv("SUPABASE_ANON_KEY") or
            os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
            os.getenv("SUPABASE_SERVICE_KEY")
        )

    return supabase_url, supabase_key


def validate_supabase_config() -> None:
    """
    Supabase 설정이 유효한지 검증합니다.

    Raises:
        ValueError: 필수 환경변수가 없는 경우
    """
    supabase_url, supabase_key = get_supabase_config()

    if not supabase_url or not supabase_key:
        raise ValueError(
            "Supabase 환경변수가 설정되지 않았습니다.\n"
            ".env.local 파일에 다음 환경변수를 설정하세요:\n"
            "  - NEXT_PUBLIC_SUPABASE_URL\n"
            "  - NEXT_PUBLIC_SUPABASE_ANON_KEY\n"
            "\n"
            "또는:\n"
            "  - SUPABASE_URL\n"
            "  - SUPABASE_SERVICE_KEY (또는 SUPABASE_ANON_KEY)"
        )


def get_dart_api_key() -> Optional[str]:
    """
    DART API 키를 가져옵니다.

    Returns:
        DART API 키 또는 None
    """
    return os.getenv("DART_API_KEY")


def validate_dart_api_key() -> None:
    """
    DART API 키가 설정되어 있는지 검증합니다.

    Raises:
        ValueError: DART API 키가 없는 경우
    """
    api_key = get_dart_api_key()

    if not api_key:
        raise ValueError(
            "DART_API_KEY 환경변수가 설정되지 않았습니다.\n"
            ".env.local 파일에 DART_API_KEY를 설정하세요.\n"
            "API 키는 https://opendart.fss.or.kr/ 에서 발급받을 수 있습니다."
        )
