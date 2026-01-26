#!/usr/bin/env python3
"""
KSIC 코드 데이터 임포트 스크립트
================================

KSIC (한국표준산업분류) 코드 데이터를 데이터베이스에 임포트합니다.

기능:
1. KSIC 엑셀 파일에서 데이터 로드 (선택)
2. industry_classifier의 rule_table.py와 통합
3. 데이터베이스의 ksic_codes 테이블에 삽입/업데이트
4. 중복 데이터 처리 및 데이터 정합성 확인

사용법:
    python scripts/import_ksic_data.py

환경변수:
    SUPABASE_URL: Supabase 프로젝트 URL
    SUPABASE_SERVICE_KEY: Supabase 서비스 키 (관리자 권한)
"""

import os
import sys
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

# 프로젝트 루트를 Python 경로에 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 환경변수 로드 (.env.local에서)
try:
    from utils.env_loader import load_env
    load_env()  # .env.local 파일에서 로드
except ImportError:
    print("Warning: 환경변수 로더를 불러올 수 없습니다.")
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        print("Warning: python-dotenv not installed")

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package not installed")
    print("Install: pip install supabase")
    sys.exit(1)

import pandas as pd

# Industry classifier 모듈 임포트
from scripts.industry_classifier.rule_table import KSIC_TOP_INDUSTRY_RULES
from scripts.industry_classifier.ksic_mapper import KSICMapper
from scripts.industry_classifier.config import KSIC_EXCEL_PATH

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class KSICDataImporter:
    """KSIC 데이터 임포트 클래스"""

    def __init__(self):
        """초기화"""
        from utils.env_loader import get_supabase_config, validate_supabase_config

        # 환경변수 검증
        validate_supabase_config()

        # Supabase 클라이언트 초기화
        supabase_url, supabase_key = get_supabase_config()

        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.ksic_mapper = KSICMapper()
        logger.info("KSIC 데이터 임포터 초기화 완료")

    def load_ksic_from_excel(self) -> pd.DataFrame:
        """
        KSIC 엑셀 파일에서 데이터 로드

        Returns:
            KSIC 데이터프레임
        """
        logger.info("KSIC 엑셀 파일 로드 시도...")

        df = self.ksic_mapper.load_ksic_data()

        if df.empty:
            logger.warning("KSIC 엑셀 파일을 로드할 수 없습니다. 기본 데이터를 사용합니다.")
            return pd.DataFrame()

        logger.info(f"KSIC 엑셀 데이터 로드 완료: {len(df)}개 항목")
        return df

    def prepare_ksic_records(self, excel_df: pd.DataFrame = None) -> List[Dict]:
        """
        데이터베이스 삽입용 KSIC 레코드 준비

        Args:
            excel_df: KSIC 엑셀 데이터프레임 (선택)

        Returns:
            데이터베이스 삽입용 레코드 리스트
        """
        logger.info("KSIC 레코드 준비 중...")
        records = []

        # 1. rule_table 기반 중분류 데이터 (기본)
        for ksic_code, top_industry in KSIC_TOP_INDUSTRY_RULES.items():
            record = {
                'ksic_code': ksic_code,
                'ksic_name': f'KSIC {ksic_code} 중분류',  # 기본값
                'division_code': None,
                'division_name': None,
                'major_code': ksic_code[:2] if len(ksic_code) >= 2 else ksic_code,
                'major_name': None,
                'minor_code': None,
                'minor_name': None,
                'sub_code': None,
                'sub_name': None,
                'detail_code': None,
                'detail_name': None,
                'top_industry': top_industry,
                'description': f'{top_industry} 관련 산업',
                'updated_at': datetime.utcnow().isoformat()
            }
            records.append(record)

        # 2. 엑셀 데이터가 있으면 보강
        if excel_df is not None and not excel_df.empty:
            logger.info("엑셀 데이터로 레코드 보강 중...")

            # KSIC 매핑 빌드
            self.ksic_mapper.build_ksic_map()

            for _, row in excel_df.iterrows():
                ksic_code = str(row.get('ksic_code', '')).strip()
                ksic_name = str(row.get('ksic_name', '')).strip()

                if not ksic_code or ksic_code == 'nan':
                    continue

                # 숫자만 추출
                numeric_code = ''.join(filter(str.isdigit, ksic_code))

                if not numeric_code:
                    continue

                # 중분류 추출
                major_code = numeric_code[:2] if len(numeric_code) >= 2 else ''

                # 상위 업종 매핑
                top_industry = KSIC_TOP_INDUSTRY_RULES.get(major_code, '기타')

                # 계층 구조 파싱
                division_code = numeric_code[0] if len(numeric_code) >= 1 else None
                minor_code = numeric_code[:3] if len(numeric_code) >= 3 else None
                sub_code = numeric_code[:4] if len(numeric_code) >= 4 else None
                detail_code = numeric_code if len(numeric_code) == 5 else None

                record = {
                    'ksic_code': numeric_code,
                    'ksic_name': ksic_name or f'KSIC {numeric_code}',
                    'division_code': division_code,
                    'division_name': None,  # 엑셀에서 추출 가능하면 추가
                    'major_code': major_code,
                    'major_name': None,
                    'minor_code': minor_code,
                    'minor_name': None,
                    'sub_code': sub_code,
                    'sub_name': None,
                    'detail_code': detail_code,
                    'detail_name': None,
                    'top_industry': top_industry,
                    'description': ksic_name,
                    'updated_at': datetime.utcnow().isoformat()
                }
                records.append(record)

        logger.info(f"총 {len(records)}개 레코드 준비 완료")
        return records

    def import_to_database(self, records: List[Dict]) -> int:
        """
        데이터베이스에 KSIC 데이터 임포트

        Args:
            records: KSIC 레코드 리스트

        Returns:
            삽입된 레코드 수
        """
        logger.info("데이터베이스에 KSIC 데이터 임포트 시작...")

        inserted_count = 0
        updated_count = 0
        error_count = 0

        # 배치 처리 (100개씩)
        batch_size = 100
        total_batches = (len(records) + batch_size - 1) // batch_size

        for batch_idx in range(total_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(records))
            batch_records = records[start_idx:end_idx]

            logger.info(f"배치 {batch_idx + 1}/{total_batches} 처리 중... ({start_idx+1}-{end_idx}/{len(records)})")

            try:
                # Upsert (INSERT ... ON CONFLICT DO UPDATE)
                response = self.supabase.table('ksic_codes').upsert(
                    batch_records,
                    on_conflict='ksic_code'
                ).execute()

                if response.data:
                    batch_count = len(response.data)
                    inserted_count += batch_count
                    logger.info(f"  ✓ {batch_count}개 레코드 처리 완료")
                else:
                    logger.warning(f"  ! 배치 {batch_idx + 1} 응답 없음")

            except Exception as e:
                logger.error(f"  ✗ 배치 {batch_idx + 1} 처리 중 오류: {e}")
                error_count += len(batch_records)

        logger.info(f"임포트 완료: 삽입/업데이트 {inserted_count}개, 오류 {error_count}개")
        return inserted_count

    def verify_import(self) -> Dict:
        """
        임포트 결과 검증

        Returns:
            검증 통계 딕셔너리
        """
        logger.info("임포트 결과 검증 중...")

        try:
            # 전체 레코드 수
            total_response = self.supabase.table('ksic_codes').select('ksic_code', count='exact').execute()
            total_count = total_response.count if hasattr(total_response, 'count') else len(total_response.data or [])

            # 상위 업종별 분포
            industry_response = self.supabase.table('ksic_codes').select('top_industry', count='exact').execute()
            industry_data = industry_response.data or []

            industry_stats = {}
            for item in industry_data:
                top_industry = item.get('top_industry', '미분류')
                industry_stats[top_industry] = industry_stats.get(top_industry, 0) + 1

            # 중분류별 분포
            major_response = self.supabase.table('ksic_codes').select('major_code', count='exact').execute()
            major_count = len(set(item.get('major_code') for item in (major_response.data or []) if item.get('major_code')))

            stats = {
                'total_records': total_count,
                'total_major_codes': major_count,
                'industry_distribution': industry_stats,
                'success': True
            }

            logger.info(f"검증 완료:")
            logger.info(f"  - 총 레코드 수: {total_count}")
            logger.info(f"  - 중분류 코드 수: {major_count}")
            logger.info(f"  - 상위 업종 수: {len(industry_stats)}")

            return stats

        except Exception as e:
            logger.error(f"검증 중 오류: {e}")
            return {
                'total_records': 0,
                'success': False,
                'error': str(e)
            }

    def run(self):
        """전체 임포트 프로세스 실행"""
        logger.info("=" * 60)
        logger.info("KSIC 데이터 임포트 시작")
        logger.info("=" * 60)

        try:
            # 1. 엑셀 데이터 로드 (선택)
            excel_df = self.load_ksic_from_excel()

            # 2. 레코드 준비
            records = self.prepare_ksic_records(excel_df if not excel_df.empty else None)

            if not records:
                logger.error("임포트할 레코드가 없습니다.")
                return False

            # 3. 데이터베이스에 임포트
            inserted_count = self.import_to_database(records)

            # 4. 검증
            stats = self.verify_import()

            # 5. 결과 요약
            logger.info("=" * 60)
            logger.info("임포트 완료!")
            logger.info("=" * 60)
            logger.info(f"✓ 총 처리 레코드: {inserted_count}")
            logger.info(f"✓ DB 총 레코드: {stats.get('total_records', 0)}")
            logger.info(f"✓ 중분류 코드 수: {stats.get('total_major_codes', 0)}")
            logger.info("=" * 60)

            return True

        except Exception as e:
            logger.error(f"임포트 중 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """메인 함수"""
    print("\n" + "=" * 60)
    print("KSIC 데이터 임포트 스크립트")
    print("=" * 60)
    print()

    # 환경변수 확인
    if not os.getenv("SUPABASE_URL"):
        print("✗ 오류: SUPABASE_URL 환경변수가 설정되지 않았습니다.")
        print("  .env 파일을 확인하세요.")
        sys.exit(1)

    if not os.getenv("SUPABASE_SERVICE_KEY") and not os.getenv("SUPABASE_ANON_KEY"):
        print("✗ 오류: SUPABASE_SERVICE_KEY 또는 SUPABASE_ANON_KEY 환경변수가 필요합니다.")
        print("  .env 파일을 확인하세요.")
        sys.exit(1)

    # KSIC 엑셀 파일 확인
    if KSIC_EXCEL_PATH.exists():
        print(f"✓ KSIC 엑셀 파일 발견: {KSIC_EXCEL_PATH}")
    else:
        print(f"! KSIC 엑셀 파일 없음: {KSIC_EXCEL_PATH}")
        print("  기본 중분류 데이터만 사용합니다.")

    print()

    # 임포트 실행
    try:
        importer = KSICDataImporter()
        success = importer.run()

        if success:
            print("\n✓ KSIC 데이터 임포트 성공!")
            sys.exit(0)
        else:
            print("\n✗ KSIC 데이터 임포트 실패")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n⚠️  사용자에 의해 중단되었습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
