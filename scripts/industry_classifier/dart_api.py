"""
DART API Client
===============

금융감독원 DART Open API와 통신하는 클라이언트

주요 기능:
1. corpCode.zip 다운로드 및 파싱 (stock_code → corp_code 매핑)
2. 기업개황 API 호출 (induty_code, induty_name 추출)
"""

import logging
import time
import zipfile
from pathlib import Path
from typing import Optional
import xml.etree.ElementTree as ET

import requests

from .config import (
    DART_API_KEY,
    DART_API_BASE_URL,
    DART_CORP_CODE_URL,
    DART_CORP_CODE_ZIP_PATH,
    DART_CORP_CODE_XML_PATH,
    DART_API_RATE_LIMIT,
    DART_API_TIMEOUT,
    get_dart_api_key,
)

logger = logging.getLogger(__name__)


class DARTClient:
    """
    DART API 클라이언트
    """

    def __init__(self, api_key: str = None):
        """
        Args:
            api_key: DART API 키 (없으면 환경변수에서 읽음)
        """
        self.api_key = api_key or get_dart_api_key()
        self.base_url = DART_API_BASE_URL
        self.last_request_time = 0
        self.corp_code_map = {}  # {stock_code: {corp_code, corp_name}}
        logger.info("DART Client 초기화 완료")

    def _rate_limit(self):
        """
        API 호출 속도 제한 (Rate Limiting)
        """
        elapsed = time.time() - self.last_request_time
        if elapsed < (1.0 / DART_API_RATE_LIMIT):
            sleep_time = (1.0 / DART_API_RATE_LIMIT) - elapsed
            time.sleep(sleep_time)
        self.last_request_time = time.time()

    def download_corp_code(self, force_refresh: bool = False) -> Path:
        """
        DART에서 제공하는 corpCode.zip 다운로드

        Args:
            force_refresh: True면 기존 파일 무시하고 새로 다운로드

        Returns:
            다운로드된 XML 파일 경로
        """
        # 이미 파일이 있고 force_refresh가 False면 기존 파일 사용
        if DART_CORP_CODE_XML_PATH.exists() and not force_refresh:
            logger.info(f"기존 파일 사용: {DART_CORP_CODE_XML_PATH}")
            return DART_CORP_CODE_XML_PATH

        logger.info("corpCode.zip 다운로드 시작...")

        # ZIP 파일 다운로드
        self._rate_limit()
        params = {"crtfc_key": self.api_key}
        response = requests.get(
            DART_CORP_CODE_URL,
            params=params,
            timeout=DART_API_TIMEOUT,
            proxies={"http": None, "https": None}
        )
        response.raise_for_status()

        # ZIP 파일 저장
        DART_CORP_CODE_ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(DART_CORP_CODE_ZIP_PATH, 'wb') as f:
            f.write(response.content)

        logger.info(f"ZIP 파일 저장: {DART_CORP_CODE_ZIP_PATH}")

        # ZIP 파일 압축 해제
        with zipfile.ZipFile(DART_CORP_CODE_ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall(DART_CORP_CODE_ZIP_PATH.parent)

        logger.info(f"XML 파일 추출 완료: {DART_CORP_CODE_XML_PATH}")
        return DART_CORP_CODE_XML_PATH

    def load_corp_code_map(self, force_refresh: bool = False) -> dict:
        """
        stock_code → corp_code 매핑 딕셔너리 생성

        Args:
            force_refresh: True면 corpCode.zip을 새로 다운로드

        Returns:
            {
                "005930": {
                    "corp_code": "00126380",
                    "corp_name": "삼성전자",
                    "stock_code": "005930",
                    "modify_date": "20231201"
                },
                ...
            }
        """
        # 이미 로드되어 있으면 재사용
        if self.corp_code_map and not force_refresh:
            return self.corp_code_map

        # corpCode.xml 파일 다운로드/로드
        xml_path = self.download_corp_code(force_refresh)

        logger.info("XML 파싱 시작...")
        tree = ET.parse(xml_path)
        root = tree.getroot()

        corp_code_map = {}

        for company in root.findall('list'):
            corp_code = company.findtext('corp_code', '').strip()
            corp_name = company.findtext('corp_name', '').strip()
            stock_code = company.findtext('stock_code', '').strip()
            modify_date = company.findtext('modify_date', '').strip()

            # stock_code가 있는 것만 매핑 (상장사만)
            if stock_code:
                corp_code_map[stock_code] = {
                    'corp_code': corp_code,
                    'corp_name': corp_name,
                    'stock_code': stock_code,
                    'modify_date': modify_date,
                }

        self.corp_code_map = corp_code_map
        logger.info(f"총 {len(corp_code_map)}개 상장사 매핑 완료")

        return corp_code_map

    def get_corp_code(self, stock_code: str) -> Optional[dict]:
        """
        종목코드로 기업코드 조회

        Args:
            stock_code: 종목코드 (예: "005930" 또는 "A005930")

        Returns:
            기업 정보 딕셔너리 또는 None

        Examples:
            >>> client = DARTClient()
            >>> client.get_corp_code("005930")
            {'corp_code': '00126380', 'corp_name': '삼성전자', ...}
        """
        if not self.corp_code_map:
            self.load_corp_code_map()

        # 'A' 접두사 제거 (예: 'A035720' -> '035720')
        if stock_code.startswith('A'):
            stock_code = stock_code[1:]

        # 6자리로 패딩 (정확히 6자리 숫자로 변환)
        stock_code_padded = stock_code.zfill(6)

        return self.corp_code_map.get(stock_code_padded)

    def get_company_info(self, corp_code: str) -> Optional[dict]:
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
        logger.info(f"기업개황 조회: {corp_code}")

        self._rate_limit()

        url = f"{self.base_url}/company.json"
        params = {
            "crtfc_key": self.api_key,
            "corp_code": corp_code,
        }

        try:
            response = requests.get(url, params=params, timeout=DART_API_TIMEOUT, proxies={"http": None, "https": None})
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

    def get_company_industry(self, stock_code: str) -> Optional[dict]:
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

        # 1. stock_code → corp_code 매핑
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


if __name__ == "__main__":
    # 테스트
    import os
    from dotenv import load_dotenv

    load_dotenv()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    client = DARTClient()

    # corpCode.xml 로드
    print("\n" + "=" * 60)
    print("1. corpCode 매핑 로드")
    print("=" * 60)
    corp_map = client.load_corp_code_map()
    print(f"총 {len(corp_map)}개 상장사 매핑 완료")

    # 삼성전자 조회
    print("\n" + "=" * 60)
    print("2. 삼성전자 (005930) 조회")
    print("=" * 60)
    samsung_info = client.get_company_industry("005930")
    if samsung_info:
        for key, value in samsung_info.items():
            print(f"  {key:15s}: {value}")

    # SK하이닉스 조회
    print("\n" + "=" * 60)
    print("3. SK하이닉스 (000660) 조회")
    print("=" * 60)
    hynix_info = client.get_company_industry("000660")
    if hynix_info:
        for key, value in hynix_info.items():
            print(f"  {key:15s}: {value}")
