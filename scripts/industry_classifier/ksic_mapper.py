"""
KSIC Mapper
===========

한국표준산업분류(KSIC) 데이터 로드 및 매핑

주요 기능:
1. KSIC 엑셀 파일 로드
2. KSIC 코드 → 산업명 매핑
3. KSIC 중분류 추출
"""

import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from .config import KSIC_EXCEL_PATH
from .rule_table import get_top_industry

logger = logging.getLogger(__name__)


class KSICMapper:
    """
    KSIC 데이터 로더 및 매퍼
    """

    def __init__(self, excel_path: Path = None):
        """
        Args:
            excel_path: KSIC 엑셀 파일 경로 (기본값: config에서 읽음)
        """
        self.excel_path = excel_path or KSIC_EXCEL_PATH
        self.ksic_df = None
        self.ksic_map = {}  # {ksic_code: ksic_info}
        logger.info("KSIC Mapper 초기화")

    def load_ksic_data(self, sheet_name: str = 0) -> pd.DataFrame:
        """
        KSIC 엑셀 파일 로드

        Args:
            sheet_name: 시트 이름 또는 인덱스 (기본값: 첫 번째 시트)

        Returns:
            KSIC 데이터프레임

        예상 컬럼:
            - 산업분류코드 (또는 코드, KSIC_CODE 등)
            - 산업분류명 (또는 분류명, KSIC_NAME 등)
            - 중분류코드
            - 중분류명
        """
        if not self.excel_path.exists():
            logger.warning(
                f"KSIC 엑셀 파일이 없습니다: {self.excel_path}\n"
                "통계청에서 KSIC 데이터를 다운로드하여 아래 경로에 저장하세요:\n"
                f"  {self.excel_path}\n"
                "다운로드: https://kssc.kostat.go.kr:8443/ksscNew_web/index.jsp"
            )
            # 빈 데이터프레임 반환
            return pd.DataFrame()

        logger.info(f"KSIC 데이터 로드: {self.excel_path}")

        try:
            # 엑셀 파일 읽기
            df = pd.read_excel(self.excel_path, sheet_name=sheet_name)

            # 컬럼명 정규화 (다양한 형태 대응)
            df.columns = df.columns.str.strip()

            # 필수 컬럼 확인 및 정규화
            column_mapping = {}

            # 코드 컬럼 찾기
            for col in df.columns:
                if any(keyword in col for keyword in ['코드', 'CODE', 'code']):
                    if '분류코드' in col or 'KSIC' in col:
                        column_mapping['ksic_code'] = col
                        break

            # 분류명 컬럼 찾기
            for col in df.columns:
                if any(keyword in col for keyword in ['분류명', 'NAME', 'name', '명']):
                    column_mapping['ksic_name'] = col
                    break

            # 컬럼 재명명
            if column_mapping:
                df = df.rename(columns=column_mapping)

            self.ksic_df = df
            logger.info(f"KSIC 데이터 로드 완료: {len(df)}개 항목")

            return df

        except Exception as e:
            logger.error(f"KSIC 데이터 로드 실패: {e}")
            return pd.DataFrame()

    def build_ksic_map(self) -> dict:
        """
        KSIC 코드 → 정보 매핑 딕셔너리 생성

        Returns:
            {
                "26110": {
                    "ksic_code": "26110",
                    "ksic_name": "반도체 제조업",
                    "middle_class": "26",
                },
                ...
            }
        """
        if self.ksic_df is None or self.ksic_df.empty:
            self.load_ksic_data()

        if self.ksic_df is None or self.ksic_df.empty:
            logger.warning("KSIC 데이터가 없습니다. 빈 매핑 반환")
            return {}

        ksic_map = {}

        for _, row in self.ksic_df.iterrows():
            ksic_code = str(row.get('ksic_code', '')).strip()
            ksic_name = str(row.get('ksic_name', '')).strip()

            if not ksic_code or ksic_code == 'nan':
                continue

            # 숫자만 추출
            numeric_code = ''.join(filter(str.isdigit, ksic_code))

            if len(numeric_code) >= 2:
                middle_class = numeric_code[:2]
            else:
                middle_class = ""

            ksic_map[numeric_code] = {
                'ksic_code': numeric_code,
                'ksic_name': ksic_name,
                'middle_class': middle_class,
            }

        self.ksic_map = ksic_map
        logger.info(f"KSIC 매핑 생성 완료: {len(ksic_map)}개")

        return ksic_map

    def get_ksic_info(self, ksic_code: str) -> Optional[dict]:
        """
        KSIC 코드로 정보 조회

        Args:
            ksic_code: KSIC 코드 (예: "26110", "C26110")

        Returns:
            KSIC 정보 딕셔너리 또는 None
        """
        if not self.ksic_map:
            self.build_ksic_map()

        # 숫자만 추출
        numeric_code = ''.join(filter(str.isdigit, str(ksic_code)))

        return self.ksic_map.get(numeric_code)

    def get_middle_class(self, ksic_code: str) -> str:
        """
        KSIC 코드에서 중분류(앞 2자리) 추출

        Args:
            ksic_code: KSIC 코드 (예: "26110")

        Returns:
            중분류 코드 (예: "26")
        """
        numeric_code = ''.join(filter(str.isdigit, str(ksic_code)))

        if len(numeric_code) >= 2:
            return numeric_code[:2]
        return ""

    def classify_industry(self, ksic_code: str) -> dict:
        """
        KSIC 코드를 기반으로 업종 분류 (통합 함수)

        Args:
            ksic_code: KSIC 코드

        Returns:
            {
                "ksic_code": "26110",
                "ksic_name": "반도체 제조업",
                "middle_class": "26",
                "top_industry": "반도체와 반도체장비"
            }
        """
        # KSIC 정보 조회
        ksic_info = self.get_ksic_info(ksic_code)

        if not ksic_info:
            # KSIC 엑셀 파일이 없어도 중분류 기반으로 매핑 시도
            middle_class = self.get_middle_class(ksic_code)
            top_industry = get_top_industry(ksic_code)

            return {
                'ksic_code': ksic_code,
                'ksic_name': '',
                'middle_class': middle_class,
                'top_industry': top_industry,
            }

        # 상위 업종 매핑
        top_industry = get_top_industry(ksic_code)

        return {
            'ksic_code': ksic_info['ksic_code'],
            'ksic_name': ksic_info['ksic_name'],
            'middle_class': ksic_info['middle_class'],
            'top_industry': top_industry,
        }


if __name__ == "__main__":
    # 테스트
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    mapper = KSICMapper()

    print("\n" + "=" * 60)
    print("KSIC Mapper 테스트")
    print("=" * 60)

    # KSIC 데이터 로드 (파일이 있는 경우)
    print("\n1. KSIC 데이터 로드")
    df = mapper.load_ksic_data()
    if not df.empty:
        print(f"   총 {len(df)}개 항목 로드")
        print(f"   컬럼: {df.columns.tolist()}")
        print(f"   샘플:\n{df.head()}")

    # KSIC 매핑 생성
    print("\n2. KSIC 매핑 생성")
    ksic_map = mapper.build_ksic_map()
    print(f"   총 {len(ksic_map)}개 매핑 생성")

    # 테스트 케이스
    print("\n3. 테스트 케이스")
    test_codes = ["26110", "21", "264", "C2611"]

    for code in test_codes:
        result = mapper.classify_industry(code)
        print(f"\n   [{code}]")
        for key, value in result.items():
            print(f"     {key:15s}: {value}")
