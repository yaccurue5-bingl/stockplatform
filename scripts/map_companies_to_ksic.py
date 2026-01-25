#!/usr/bin/env python3
"""
기업-KSIC 자동 매핑 스크립트
===========================

companies 테이블의 기업들에 KSIC 코드를 자동으로 매핑합니다.

처리 흐름:
1. companies 테이블에서 기업 목록 조회
2. industry_classifier를 사용하여 DART API에서 KSIC 코드 가져오기
3. companies 테이블 업데이트 (ksic_code, industry_category 등)
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

# Industry classifier 임포트
from scripts.industry_classifier import IndustryClassifier

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

        # Supabase 클라이언트 초기화
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL과 SUPABASE_SERVICE_KEY 환경변수가 필요합니다."
            )

        self.supabase: Client = create_client(supabase_url, supabase_key)

        # Industry classifier 초기화
        dart_api_key = os.getenv("DART_API_KEY")
        if not dart_api_key:
            raise ValueError(
                "DART_API_KEY 환경변수가 필요합니다.\n"
                "발급: https://opendart.fss.or.kr/"
            )

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
            unmapped_only: True면 KSIC가 없는 기업만 조회

        Returns:
            기업 정보 딕셔너리 리스트
        """
        logger.info("기업 목록 조회 중...")

        try:
            # 쿼리 빌드
            query = self.supabase.table('companies').select('code, name_kr, market, ksic_code')

            # 조건 추가
            if stock_codes:
                query = query.in_('code', stock_codes)

            if unmapped_only:
                query = query.is_('ksic_code', 'null')

            # 실행
            response = query.execute()
            companies = response.data or []

            logger.info(f"조회 완료: {len(companies)}개 기업")
            return companies

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
            update_data = {
                'ksic_code': classification.get('ksic_code'),
                'ksic_name': classification.get('ksic_name'),
                'industry_category': classification.get('top_industry'),
                'corp_code': classification.get('corp_code'),
                'ksic_updated_at': datetime.utcnow().isoformat(),
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
                logger.debug(f"  ✓ DB 업데이트 완료: {stock_code}")
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
        delay: float = 1.0
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
            company_name = company.get('name_kr', 'N/A')
            existing_ksic = company.get('ksic_code')

            # 진행률 표시
            if i % 10 == 0 or i == 1:
                logger.info(f"진행률: {i}/{total} ({i/total*100:.1f}%)")

            # 이미 매핑된 경우 (unmapped_only=False인 경우에만 해당)
            if existing_ksic:
                logger.debug(f"건너뜀: {stock_code} (이미 매핑됨: {existing_ksic})")
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
            self.process_batch(companies, batch_size)

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
    required_vars = ['SUPABASE_URL', 'DART_API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print(f"✗ 오류: 다음 환경변수가 설정되지 않았습니다: {', '.join(missing_vars)}")
        print("  .env 파일을 확인하세요.")
        sys.exit(1)

    if not os.getenv("SUPABASE_SERVICE_KEY") and not os.getenv("SUPABASE_ANON_KEY"):
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
