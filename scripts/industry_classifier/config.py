"""
Configuration for Industry Classifier
======================================

DART API 키, 파일 경로 등 설정 관리
"""

import os
from pathlib import Path

# 프로젝트 루트 디렉토리
PROJECT_ROOT = Path(__file__).parent.parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
DATA_DIR = SCRIPTS_DIR / "data"

# DART 관련 설정
DART_API_KEY = os.getenv("DART_API_KEY", "")  # 환경변수에서 읽기
DART_API_BASE_URL = "https://opendart.fss.or.kr/api"

# DART 기업코드 관련
DART_CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
DART_CORP_CODE_ZIP_PATH = DATA_DIR / "dart" / "corpCode.zip"
DART_CORP_CODE_XML_PATH = DATA_DIR / "dart" / "CORPCODE.xml"

# KSIC 데이터 관련
KSIC_DATA_DIR = DATA_DIR / "ksic"
KSIC_EXCEL_PATH = KSIC_DATA_DIR / "ksic_industry.xlsx"

# 캐시 설정
CACHE_DIR = DATA_DIR / "cache"
CORP_CODE_CACHE_HOURS = 24  # 기업코드 매핑 캐시 유지 시간

# API 호출 제한
DART_API_RATE_LIMIT = 1.0  # 초당 최대 요청 수
DART_API_TIMEOUT = 30  # API 타임아웃 (초)

# 로깅 설정
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


def validate_config():
    """
    설정 유효성 검증
    """
    if not DART_API_KEY:
        raise ValueError(
            "DART_API_KEY가 설정되지 않았습니다. "
            "환경변수 DART_API_KEY를 설정하거나 .env 파일을 생성하세요.\n"
            "DART API 키 발급: https://opendart.fss.or.kr/"
        )

    # 필요한 디렉토리 생성
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "dart").mkdir(parents=True, exist_ok=True)
    KSIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    return True


def get_dart_api_key():
    """
    DART API 키 반환 (환경변수 우선)
    """
    api_key = os.getenv("DART_API_KEY", DART_API_KEY)
    if not api_key:
        raise ValueError("DART_API_KEY가 설정되지 않았습니다.")
    return api_key


if __name__ == "__main__":
    # 설정 확인용
    print(f"PROJECT_ROOT: {PROJECT_ROOT}")
    print(f"DATA_DIR: {DATA_DIR}")
    print(f"DART_API_KEY: {'설정됨' if DART_API_KEY else '미설정'}")
    print(f"KSIC_EXCEL_PATH: {KSIC_EXCEL_PATH}")
