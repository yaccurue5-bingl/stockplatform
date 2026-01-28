"""
DART DB Client
==============

DB에 저장된 corp_code 데이터를 활용하는 DART 클라이언트
XML 파일 대신 dart_corp_codes 테이블에서 데이터를 조회합니다.

기존 dart_api.py의 DARTClient와 호환되는 인터페이스를 제공하면서
DB를 사용하여 성능을 개선합니다.

사용법:
    from scripts.industry_classifier.dart_db_client import DARTDBClient

    client = DARTDBClient()
    corp_info = client.get_corp_code("005930")
    industry_info = client.get_company_industry("005930")
"""

import logging
import time
from typing import Optional, Dict
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.env_loader import load_env, get_supabase_config
from .config import (
    DART_API_BASE_URL,
    DART_API_RATE_LIMIT,
    DART_API_TIMEOUT,
    get_dart_api_key,
)

# 환경변수 로드
load_env()

logger = logging.getLogger(__name__)


class DARTDBClient:
    """
    DB 기반 DART API 클라이언트

    dart_corp_codes 테이블에서 corp_code를 조회하고,
    필요한 경우 DART API를 호출합니다.
    """

    def __init__(self, api_key: str = None):
        """
        Args:
            api_key: DART API 키 (없으면 환경변수에서 읽음)
        """
        self.api_key = api_key or get_dart_api_key()
        self.base_url = DART_API_BASE_URL
        self.last_request_time = 0

        # Supabase 클라이언트 초기화
        try:
            from supabase import create_client, Client

            url, key = get_supabase_config(use_service_role=True)
            self.supabase: Client = create_client(url, key)
            logger.info("DART DB Client 초기화 완료")
        except Exception as e:
            logger.error(f"Supabase 연결 실패: {e}")
            raise

    def _rate_limit(self):
        """
        API 호출 속도 제한 (Rate Limiting)
        """
        elapsed = time.time() - self.last_request_time
        if elapsed < (1.0 / DART_API_RATE_LIMIT):
            sleep_time = (1.0 / DART_API_RATE_LIMIT) - elapsed
            time.sleep(sleep_time)
        self.last_request_time = time.time()

    def get_corp_code(self, stock_code: str) -> Optional[Dict]:
        """
        종목코드로 기업코드 조회 (DB에서)

        Args:
            stock_code: 종목코드 (예: "005930" 또는 "A005930")

        Returns:
            기업 정보 딕셔너리 또는 None
            {
                'corp_code': '00126380',
                'corp_name': '삼성전자',
                'stock_code': '005930',
                'modify_date': '20231201'
            }

        Examples:
            >>> client = DARTDBClient()
            >>> client.get_corp_code("005930")
            {'corp_code': '00126380', 'corp_name': '삼성전자', ...}
        """
        # 'A' 접두사 제거 (예: 'A035720' -> '035720')
        if stock_code.startswith('A'):
            stock_code = stock_code[1:]

        # 6자리로 패딩 (정확히 6자리 숫자로 변환)
        stock_code_padded = stock_code.zfill(6)

        try:
            result = self.supabase.table("dart_corp_codes").select("*").eq(
                "stock_code", stock_code_padded
            ).execute()

            if result.data:
                return result.data[0]
            else:
                logger.warning(f"종목코드를 찾을 수 없음: {stock_code_padded}")
                return None

        except Exception as e:
            logger.error(f"DB 조회 실패: {e}")
            return None

    def get_company_info(self, corp_code: str) -> Optional[Dict]:
        """
        DART 기업개황 API 호출

        Args:
            corp_code: 기업코드 (예: "00126380")

        Returns:
            {
                "status": "000",
                "message": "정상",
                "corp_code": "00126380",
                "corp_name": "삼성전자",
                "induty_code": "264",
                "induty_name": "반도체 및 기타 전자부품 제조업",
                ...
            }

        API 문서:
            https://opendart.fss.or.kr/api/company.json
        """
        import requests

        logger.info(f"기업개황 조회: {corp_code}")

        self._rate_limit()

        url = f"{self.base_url}/company.json"
        params = {
            "crtfc_key": self.api_key,
            "corp_code": corp_code,
        }

        try:
            response = requests.get(url, params=params, timeout=DART_API_TIMEOUT)
            response.raise_for_status()

            data = response.json()

            # 에러 체크
            status = data.get("status")
            if status != "000":
                message = data.get("message", "Unknown error")
                logger.warning(f"DART API 에러: {status} - {message}")
                return None

            return data

        except requests.exceptions.RequestException as e:
            logger.error(f"API 호출 실패: {e}")
            return None

    def get_company_industry(self, stock_code: str) -> Optional[Dict]:
        """
        종목코드로 기업 업종 정보 조회 (통합 함수)

        Args:
            stock_code: 종목코드 (예: "005930" 또는 "A005930")

        Returns:
            {
                "stock_code": "005930",
                "corp_code": "00126380",
                "corp_name": "삼성전자",
                "induty_code": "264",
                "induty_name": "반도체 및 기타 전자부품 제조업"
            }
        """
        # 'A' 접두사 제거 (예: 'A035720' -> '035720')
        original_stock_code = stock_code
        if stock_code.startswith('A'):
            stock_code = stock_code[1:]

        # 1. stock_code → corp_code 매핑 (DB에서)
        corp_info = self.get_corp_code(stock_code)
        if not corp_info:
            logger.warning(f"종목코드를 찾을 수 없음: {original_stock_code}")
            return None

        corp_code = corp_info['corp_code']
        corp_name = corp_info['corp_name']

        # 2. DART 기업개황 API 호출
        company_info = self.get_company_info(corp_code)
        if not company_info:
            logger.warning(f"기업개황 조회 실패: {corp_code}")
            return None

        # 3. 필요한 정보 추출 (6자리 숫자 형식으로 반환)
        return {
            'stock_code': stock_code.zfill(6),
            'corp_code': corp_code,
            'corp_name': corp_name,
            'induty_code': company_info.get('induty_code', ''),
            'induty_name': company_info.get('induty_name', ''),
        }

    def search_by_name(self, corp_name_pattern: str, limit: int = 10) -> list:
        """
        기업명으로 검색 (DB에서)

        Args:
            corp_name_pattern: 기업명 검색어 (부분 일치)
            limit: 최대 결과 수

        Returns:
            기업 정보 리스트

        Examples:
            >>> client = DARTDBClient()
            >>> client.search_by_name("삼성")
            [{'corp_code': '00126380', 'corp_name': '삼성전자', ...}, ...]
        """
        try:
            result = self.supabase.table("dart_corp_codes").select("*").ilike(
                "corp_name", f"%{corp_name_pattern}%"
            ).limit(limit).execute()

            return result.data

        except Exception as e:
            logger.error(f"기업명 검색 실패: {e}")
            return []


if __name__ == "__main__":
    # 테스트
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    client = DARTDBClient()

    # 삼성전자 조회
    print("\n" + "=" * 60)
    print("1. 삼성전자 (005930) 조회")
    print("=" * 60)
    samsung_info = client.get_company_industry("005930")
    if samsung_info:
        for key, value in samsung_info.items():
            print(f"  {key:15s}: {value}")

    # SK하이닉스 조회
    print("\n" + "=" * 60)
    print("2. SK하이닉스 (000660) 조회")
    print("=" * 60)
    hynix_info = client.get_company_industry("000660")
    if hynix_info:
        for key, value in hynix_info.items():
            print(f"  {key:15s}: {value}")

    # 기업명 검색
    print("\n" + "=" * 60)
    print("3. '삼성' 검색")
    print("=" * 60)
    results = client.search_by_name("삼성", limit=5)
    for i, company in enumerate(results, 1):
        print(f"  {i}. {company['corp_name']} ({company['stock_code']})")
