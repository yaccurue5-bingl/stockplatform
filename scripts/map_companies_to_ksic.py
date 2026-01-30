#!/usr/bin/env python3
"""
기업-KSIC 자동 매핑 스크립트
===========================

companies 테이블의 기업들에 KSIC 코드를 자동으로 매핑합니다.

처리 흐름:
1. companies 테이블에서 기업 목록 조회
2. industry_classifier를 사용하여 DART API에서 KSIC 코드 가져오기
3. companies 테이블 업데이트 (sector, ksic_name, corp_code 등)
4. 결과 로깅 및 통계 출력

사용법:
    # 전체 기업 매핑
    python scripts/map_companies_to_ksic.py

    # 특정 기업만 매핑
    python scripts/map_companies_to_ksic.py --stock-codes 005930 000660 035420

    # KSIC가 없는 기업만 매핑
    python scripts/map_companies_to_ksic.py --unmapped-only

    # 배치 크기 조절 (API 호출 제한)
    python scripts/map_companies_to_ksic.py --batch-size 50

    # Dry-run (실제 업데이트 없이 테스트)
    python scripts/map_companies_to_ksic.py --dry-run

환경변수:
    SUPABASE_URL: Supabase 프로젝트 URL
    SUPABASE_SERVICE_KEY: Supabase 서비스 키
    DART_API_KEY: DART Open API 키 (필수)
"""

import os
import sys
import logging
import argparse
import time
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
        pass

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package not installed")
    print("Install: pip install supabase")
    sys.exit(1)

# Supabase 접근을 위해 프록시 비활성화
# Claude Code 환경의 프록시가 Supabase 접근을 차단하는 문제 해결
import os
for proxy_var in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'GLOBAL_AGENT_HTTP_PROXY']:
    os.environ.pop(proxy_var, None)

# Industry classifier 임포트
from scripts.industry_classifier import IndustryClassifier

# Sector validator 임포트
from utils.sector_validator import sanitize_sector

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CompanyKSICMapper:
    """기업-KSIC 매핑 클래스"""

    def __init__(self, dry_run: bool = False):
        """
        초기화

        Args:
            dry_run: True면 실제 DB 업데이트 하지 않음
        """
        self.dry_run = dry_run

        from utils.env_loader import (
            get_supabase_config, validate_supabase_config,
            get_dart_api_key, validate_dart_api_key
        )

        # 환경변수 검증
        validate_supabase_config()
        validate_dart_api_key()

        # Supabase 클라이언트 초기화 (서버 사이드이므로 service role key 사용)
        supabase_url, supabase_key = get_supabase_config(use_service_role=True)
        self.supabase: Client = create_client(supabase_url, supabase_key)

        # Industry classifier 초기화
        dart_api_key = get_dart_api_key()
        self.classifier = IndustryClassifier(dart_api_key=dart_api_key)

        # 통계
        self.stats = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'already_mapped': 0
        }

        if dry_run:
            logger.info("⚠️  DRY-RUN 모드: 실제 DB 업데이트 하지 않음")
        else:
            logger.info("기업-KSIC 매핑 도구 초기화 완료")

    def get_companies(
        self,
        stock_codes: List[str] = None,
        unmapped_only: bool = False
    ) -> List[Dict]:
        """
        매핑할 기업 목록 조회

        Args:
            stock_codes: 특정 종목코드 리스트 (None이면 전체)
            unmapped_only: True면 sector가 없거나 잘못된 기업만 조회

        Returns:
            기업 정보 딕셔너리 리스트
        """
        logger.info("기업 목록 조회 중...")

        try:
            # 1. 유효한 sector 목록 가져오기 (sectors 테이블에서)
            valid_sectors = set()
            if unmapped_only:
                try:
                    sectors_response = self.supabase.table('sectors').select('name').execute()
                    valid_sectors = {s['name'] for s in (sectors_response.data or [])}
                    logger.debug(f"유효한 sector {len(valid_sectors)}개 로드됨")
                except Exception as e:
                    logger.warning(f"sectors 테이블 조회 실패 (무시하고 계속): {e}")

            # 2. 기업 목록 조회
            query = self.supabase.table('companies').select('code, corp_name, market, sector')

            # 조건 추가
            if stock_codes:
                query = query.in_('code', stock_codes)

            # KONEX 종목 제외
            query = query.neq('market', 'KONEX')

            # 실행
            response = query.execute()
            all_companies = response.data or []

            # 3. unmapped_only일 때 Python에서 필터링
            if unmapped_only:
                companies = []
                for company in all_companies:
                    sector = company.get('sector')

                    # sector가 없거나 잘못된 값인지 판별
                    # (process_batch의 is_invalid 로직과 동일)
                    is_invalid = (
                        not sector or  # None 또는 빈 문자열
                        sector in ['미분류', '기타', 'null', 'NULL', 'None'] or  # 무효 키워드
                        'http' in sector.lower() or  # URL
                        any(m in sector.upper() for m in ['KOSPI', 'KOSDAQ', 'KONEX', '(']) or  # 시장명/괄호
                        sector.isdigit() or  # 숫자만 (이전 KSIC 코드)
                        (valid_sectors and sector not in valid_sectors)  # sectors 테이블에 없음
                    )

                    if is_invalid:
                        companies.append(company)

                logger.info(f"조회 완료: {len(companies)}개 기업 (전체 {len(all_companies)}개 중 매핑 필요)")
                return companies
            else:
                logger.info(f"조회 완료: {len(all_companies)}개 기업 (KONEX 제외)")
                return all_companies

        except Exception as e:
            logger.error(f"기업 목록 조회 중 오류: {e}")
            return []

    def map_company(self, stock_code: str, company_name: str) -> Optional[Dict]:
        """
        단일 기업의 KSIC 코드 매핑

        Args:
            stock_code: 종목코드
            company_name: 기업명

        Returns:
            매핑 결과 딕셔너리 또는 None
        """
        logger.info(f"매핑 중: {stock_code} ({company_name})")

        try:
            # Industry classifier로 분류
            result = self.classifier.classify(stock_code)

            if not result:
                logger.warning(f"  ✗ {stock_code}: 분류 결과 없음")
                return None

            if not result.get('success'):
                error = result.get('error', 'Unknown error')
                logger.warning(f"  ✗ {stock_code}: {error}")
                return None

            # 성공
            logger.info(
                f"  ✓ {stock_code}: {result.get('ksic_code')} - "
                f"{result.get('top_industry')}"
            )

            return result

        except Exception as e:
            logger.error(f"  ✗ {stock_code}: 매핑 중 오류 - {e}")
            return None

    def update_company_ksic(
        self,
        stock_code: str,
        classification: Dict
    ) -> bool:
        """
        기업의 KSIC 정보 업데이트

        Args:
            stock_code: 종목코드
            classification: industry_classifier 분류 결과

        Returns:
            업데이트 성공 여부
        """
        if self.dry_run:
            logger.debug(f"[DRY-RUN] {stock_code} 업데이트 건너뜀")
            return True

        try:
            # KSIC 코드와 상위 업종 가져오기
            ksic_code = classification.get('ksic_code')
            top_industry = classification.get('top_industry')

            # sector 필드는 상위 업종명(한글)으로 업데이트
            # 예: "반도체와 반도체장비", "바이오·제약" 등
            sector_value = top_industry if top_industry else '미분류'

            # sector 값 유효성 검사 (URL이나 잘못된 값이면 '기타'로 처리)
            if sector_value and ('http' in sector_value.lower() or
                                 any(m in sector_value for m in ['KOSPI', 'KOSDAQ', 'KONEX'])):
                sector_value = '기타'

            update_data = {
                'sector': sector_value,  # 상위 업종명 (한글)
                'updated_at': datetime.utcnow().isoformat()
            }

            # Null 값 제거
            update_data = {k: v for k, v in update_data.items() if v is not None}

            # 업데이트 실행
            response = self.supabase.table('companies')\
                .update(update_data)\
                .eq('code', stock_code)\
                .execute()

            if response.data:
                logger.debug(f"  ✓ DB 업데이트 완료: {stock_code} -> {sector_value}")
                return True
            else:
                logger.warning(f"  ! DB 업데이트 응답 없음: {stock_code}")
                return False

        except Exception as e:
            logger.error(f"  ✗ DB 업데이트 실패: {stock_code} - {e}")
            return False

    def process_batch(
        self,
        companies: List[Dict],
        batch_size: int = 100,
        delay: float = 1.0,
        unmapped_only: bool = False
    ) -> Dict:
        """
        기업 배치 처리

        Args:
            companies: 기업 리스트
            batch_size: 배치 크기
            delay: API 호출 간 대기 시간 (초)

        Returns:
            처리 결과 통계
        """
        total = len(companies)
        logger.info(f"배치 처리 시작: {total}개 기업")

        for i, company in enumerate(companies, 1):
            stock_code = company['code']
            company_name = company.get('corp_name', 'N/A')
            existing_sector = str(company.get('sector', ''))

            # [데이터 유효성 판별 로직]
            # NOTE: get_companies에서 이미 unmapped_only 필터링을 수행했으므로
            # 여기서는 unmapped_only=False일 때만 추가 검사를 수행합니다.
            if not unmapped_only:
                # sector는 한글 상위 업종명이므로 유효성 검사
                # 1. 값이 없거나
                # 2. '미분류', '기타', 'null' 등 유효하지 않은 값이거나
                # 3. URL주소나 시장 정보(KOSPI 등), 괄호가 포함된 경우
                # 4. 숫자로만 구성된 경우 (이전 KSIC 코드 형식)
                is_invalid = (
                    not existing_sector or
                    existing_sector in ['미분류', '기타', 'null', 'NULL', 'None'] or
                    'http' in existing_sector.lower() or
                    any(m in existing_sector.upper() for m in ['KOSPI', 'KOSDAQ', 'KONEX', '(']) or
                    existing_sector.isdigit()
                )

                # 정상적인 sector 값이 이미 있으면 건너뜀
                if not is_invalid:
                    logger.debug(f"건너뜀: {stock_code} (이미 정상 매핑됨: {existing_sector})")
                    self.stats['already_mapped'] += 1
                    self.stats['skipped'] += 1
                    continue

            # 매핑 수행
            self.stats['total'] += 1
            classification = self.map_company(stock_code, company_name)

            if classification and classification.get('success'):
                # DB 업데이트
                if self.update_company_ksic(stock_code, classification):
                    self.stats['success'] += 1
                else:
                    self.stats['failed'] += 1
            else:
                self.stats['failed'] += 1

            # API 호출 제한 준수 (DART는 초당 1회)
            if i < total:  # 마지막이 아니면
                time.sleep(delay)

            # 배치 크기마다 중간 통계 출력
            if i % batch_size == 0:
                self.print_progress()

        return self.stats

    def print_progress(self):
        """진행 상황 출력"""
        logger.info(
            f"현재 통계: 성공 {self.stats['success']}, "
            f"실패 {self.stats['failed']}, "
            f"건너뜀 {self.stats['skipped']}"
        )

    def print_summary(self):
        """최종 결과 요약 출력"""
        print("\n" + "=" * 70)
        print("기업-KSIC 매핑 결과")
        print("=" * 70)
        print(f"처리 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        print(f"총 처리 대상:     {self.stats['total']:6d}개")
        print(f"  ✓ 성공:         {self.stats['success']:6d}개")
        print(f"  ✗ 실패:         {self.stats['failed']:6d}개")
        print(f"  - 건너뜀:       {self.stats['skipped']:6d}개")
        print(f"    (이미 매핑됨: {self.stats['already_mapped']:6d}개)")
        print()

        if self.stats['total'] > 0:
            success_rate = self.stats['success'] / self.stats['total'] * 100
            print(f"성공률: {success_rate:.1f}%")
        else:
            print("처리된 기업 없음")

        if self.dry_run:
            print()
            print("⚠️  DRY-RUN 모드: 실제 DB 업데이트 없음")

        print("=" * 70)

    def run(
        self,
        stock_codes: List[str] = None,
        unmapped_only: bool = False,
        batch_size: int = 100
    ) -> bool:
        """
        전체 매핑 프로세스 실행

        Args:
            stock_codes: 특정 종목코드 리스트
            unmapped_only: KSIC가 없는 기업만 처리
            batch_size: 배치 크기

        Returns:
            성공 여부
        """
        logger.info("기업-KSIC 자동 매핑 시작")

        try:
            # 1. 기업 목록 조회
            companies = self.get_companies(stock_codes, unmapped_only)

            if not companies:
                logger.warning("처리할 기업이 없습니다.")
                return True

            # 2. 배치 처리
            self.process_batch(companies, batch_size,  unmapped_only=unmapped_only)

            # 3. 결과 출력
            self.print_summary()

            # 4. 성공 여부 반환
            return self.stats['failed'] == 0

        except KeyboardInterrupt:
            logger.warning("\n⚠️  사용자에 의해 중단되었습니다.")
            self.print_summary()
            return False

        except Exception as e:
            logger.error(f"매핑 중 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description='기업-KSIC 자동 매핑',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예제:
  # 전체 기업 매핑
  python scripts/map_companies_to_ksic.py

  # 특정 기업만 매핑
  python scripts/map_companies_to_ksic.py --stock-codes 005930 000660

  # KSIC가 없는 기업만 매핑
  python scripts/map_companies_to_ksic.py --unmapped-only

  # Dry-run 모드
  python scripts/map_companies_to_ksic.py --dry-run
        """
    )

    parser.add_argument(
        '--stock-codes',
        nargs='+',
        help='매핑할 종목코드 (공백으로 구분)'
    )
    parser.add_argument(
        '--unmapped-only',
        action='store_true',
        help='KSIC가 없는 기업만 매핑'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='배치 크기 (기본값: 100)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='실제 DB 업데이트 없이 테스트'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='상세 로깅'
    )

    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # 환경변수 확인
    from utils.env_loader import get_supabase_config, get_dart_api_key
    supabase_url, supabase_key = get_supabase_config()
    dart_api_key = get_dart_api_key()

    missing_vars = []
    if not supabase_url or not supabase_key:
        missing_vars.append("NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not dart_api_key:
        missing_vars.append("DART_API_KEY")

    if missing_vars:
        print(f"✗ 오류: 다음 환경변수가 설정되지 않았습니다: {', '.join(missing_vars)}")
        print("  .env.local 파일을 확인하세요.")
        sys.exit(1)

    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY") and not os.getenv("SUPABASE_ANON_KEY"):
        print("✗ 오류: SUPABASE_SERVICE_KEY 또는 SUPABASE_ANON_KEY가 필요합니다.")
        sys.exit(1)

    # 매핑 실행
    try:
        mapper = CompanyKSICMapper(dry_run=args.dry_run)
        success = mapper.run(
            stock_codes=args.stock_codes,
            unmapped_only=args.unmapped_only,
            batch_size=args.batch_size
        )

        sys.exit(0 if success else 1)

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
