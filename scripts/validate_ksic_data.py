#!/usr/bin/env python3
"""
KSIC 데이터 검증 스크립트
=========================

데이터베이스의 KSIC 데이터 무결성을 검증합니다.

검증 항목:
1. KSIC 코드 형식 검증 (숫자, 길이)
2. 필수 필드 누락 검사
3. 중분류 코드 매핑 일관성
4. 상위 업종 분류 일관성
5. 기업-KSIC 매핑 상태
6. 통계 및 분포 분석

사용법:
    python scripts/validate_ksic_data.py
    python scripts/validate_ksic_data.py --verbose
    python scripts/validate_ksic_data.py --fix

환경변수:
    SUPABASE_URL: Supabase 프로젝트 URL
    SUPABASE_SERVICE_KEY: Supabase 서비스 키
"""

import os
import sys
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime
from collections import defaultdict

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

from scripts.industry_classifier.rule_table import KSIC_TOP_INDUSTRY_RULES

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class KSICValidator:
    """KSIC 데이터 검증 클래스"""

    def __init__(self, verbose: bool = False):
        """
        초기화

        Args:
            verbose: 상세 로깅 활성화
        """
        if verbose:
            logger.setLevel(logging.DEBUG)

        # Supabase 클라이언트 초기화
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL과 SUPABASE_SERVICE_KEY 환경변수가 필요합니다."
            )

        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.errors = []
        self.warnings = []
        self.stats = {}

        logger.info("KSIC 데이터 검증기 초기화 완료")

    def validate_ksic_code_format(self, ksic_code: str) -> Tuple[bool, str]:
        """
        KSIC 코드 형식 검증

        Args:
            ksic_code: KSIC 코드

        Returns:
            (유효성, 오류 메시지)
        """
        if not ksic_code:
            return False, "KSIC 코드가 비어있음"

        # 숫자만 포함 확인
        if not ksic_code.isdigit():
            return False, f"KSIC 코드에 숫자 이외의 문자 포함: {ksic_code}"

        # 길이 확인 (1-5자리)
        if len(ksic_code) < 1 or len(ksic_code) > 5:
            return False, f"KSIC 코드 길이 오류 (1-5자리 필요): {ksic_code}"

        return True, ""

    def validate_ksic_codes_table(self) -> Dict:
        """
        ksic_codes 테이블 검증

        Returns:
            검증 결과 딕셔너리
        """
        logger.info("ksic_codes 테이블 검증 중...")

        try:
            # 전체 데이터 조회
            response = self.supabase.table('ksic_codes').select('*').execute()
            ksic_records = response.data or []

            if not ksic_records:
                self.errors.append("ksic_codes 테이블이 비어있습니다")
                return {'success': False, 'total': 0}

            total_records = len(ksic_records)
            valid_count = 0
            invalid_count = 0

            # 각 레코드 검증
            for record in ksic_records:
                ksic_code = record.get('ksic_code')
                ksic_name = record.get('ksic_name')
                top_industry = record.get('top_industry')

                # 1. 코드 형식 검증
                is_valid, error_msg = self.validate_ksic_code_format(ksic_code)
                if not is_valid:
                    self.errors.append(f"코드 형식 오류: {error_msg}")
                    invalid_count += 1
                    continue

                # 2. 필수 필드 검증
                if not ksic_name:
                    self.warnings.append(f"KSIC 코드 {ksic_code}: ksic_name 누락")

                if not top_industry:
                    self.warnings.append(f"KSIC 코드 {ksic_code}: top_industry 누락")

                # 3. 중분류 일관성 검증
                if len(ksic_code) >= 2:
                    major_code = ksic_code[:2]
                    db_major_code = record.get('major_code')

                    if db_major_code and db_major_code != major_code:
                        self.warnings.append(
                            f"KSIC 코드 {ksic_code}: major_code 불일치 "
                            f"(DB: {db_major_code}, 예상: {major_code})"
                        )

                valid_count += 1

            # 통계
            result = {
                'success': True,
                'total': total_records,
                'valid': valid_count,
                'invalid': invalid_count,
                'errors': len([e for e in self.errors if 'ksic_codes' in e.lower()]),
                'warnings': len([w for w in self.warnings if 'ksic_codes' in w.lower() or 'KSIC 코드' in w])
            }

            logger.info(f"ksic_codes 테이블 검증 완료: {valid_count}/{total_records} 유효")
            return result

        except Exception as e:
            logger.error(f"ksic_codes 테이블 검증 중 오류: {e}")
            self.errors.append(f"ksic_codes 테이블 검증 실패: {e}")
            return {'success': False, 'error': str(e)}

    def validate_rule_table_consistency(self) -> Dict:
        """
        rule_table.py와 DB 데이터 일관성 검증

        Returns:
            검증 결과 딕셔너리
        """
        logger.info("rule_table 일관성 검증 중...")

        try:
            # DB에서 중분류별 상위 업종 조회
            response = self.supabase.table('ksic_codes').select('ksic_code, top_industry').execute()
            db_records = response.data or []

            db_mapping = {}
            for record in db_records:
                ksic_code = record.get('ksic_code', '')
                top_industry = record.get('top_industry')

                if len(ksic_code) >= 2:
                    major_code = ksic_code[:2]
                    if major_code not in db_mapping:
                        db_mapping[major_code] = top_industry

            # rule_table과 비교
            missing_in_db = []
            inconsistent = []

            for major_code, expected_industry in KSIC_TOP_INDUSTRY_RULES.items():
                if major_code not in db_mapping:
                    missing_in_db.append(major_code)
                    self.warnings.append(
                        f"rule_table의 중분류 {major_code}가 DB에 없음"
                    )
                elif db_mapping[major_code] != expected_industry:
                    inconsistent.append({
                        'major_code': major_code,
                        'db': db_mapping[major_code],
                        'rule_table': expected_industry
                    })
                    self.warnings.append(
                        f"중분류 {major_code} 상위 업종 불일치: "
                        f"DB='{db_mapping[major_code]}', rule_table='{expected_industry}'"
                    )

            result = {
                'success': True,
                'total_rule_table': len(KSIC_TOP_INDUSTRY_RULES),
                'total_db': len(db_mapping),
                'missing_in_db': len(missing_in_db),
                'inconsistent': len(inconsistent),
                'inconsistent_details': inconsistent
            }

            logger.info(
                f"rule_table 일관성 검증 완료: "
                f"누락 {len(missing_in_db)}개, 불일치 {len(inconsistent)}개"
            )
            return result

        except Exception as e:
            logger.error(f"rule_table 일관성 검증 중 오류: {e}")
            self.errors.append(f"rule_table 일관성 검증 실패: {e}")
            return {'success': False, 'error': str(e)}

    def validate_companies_ksic_mapping(self) -> Dict:
        """
        companies 테이블의 KSIC 매핑 상태 검증

        Returns:
            검증 결과 딕셔너리
        """
        logger.info("companies 테이블 KSIC 매핑 검증 중...")

        try:
            # 전체 기업 수 조회
            total_response = self.supabase.table('companies').select('code', count='exact').execute()
            total_companies = total_response.count if hasattr(total_response, 'count') else len(total_response.data or [])

            # KSIC 코드가 있는 기업 수
            mapped_response = self.supabase.table('companies')\
                .select('code, ksic_code, industry_category', count='exact')\
                .not_.is_('ksic_code', 'null')\
                .execute()
            mapped_companies = mapped_response.count if hasattr(mapped_response, 'count') else len(mapped_response.data or [])

            # KSIC 코드가 없는 기업 수
            unmapped_count = total_companies - mapped_companies

            # 매핑 비율
            mapping_rate = (mapped_companies / total_companies * 100) if total_companies > 0 else 0

            # industry_category 분포
            if mapped_response.data:
                industry_dist = defaultdict(int)
                for company in mapped_response.data:
                    category = company.get('industry_category') or '미분류'
                    industry_dist[category] += 1

                industry_distribution = dict(industry_dist)
            else:
                industry_distribution = {}

            result = {
                'success': True,
                'total_companies': total_companies,
                'mapped_companies': mapped_companies,
                'unmapped_companies': unmapped_count,
                'mapping_rate': round(mapping_rate, 2),
                'industry_distribution': industry_distribution
            }

            if unmapped_count > 0:
                self.warnings.append(
                    f"{unmapped_count}개 기업의 KSIC 코드가 매핑되지 않음 "
                    f"(매핑률: {mapping_rate:.1f}%)"
                )

            logger.info(
                f"companies 테이블 검증 완료: "
                f"{mapped_companies}/{total_companies} 매핑됨 ({mapping_rate:.1f}%)"
            )
            return result

        except Exception as e:
            logger.error(f"companies 테이블 검증 중 오류: {e}")
            self.errors.append(f"companies 테이블 검증 실패: {e}")
            return {'success': False, 'error': str(e)}

    def generate_statistics(self) -> Dict:
        """
        KSIC 데이터 통계 생성

        Returns:
            통계 딕셔너리
        """
        logger.info("통계 생성 중...")

        try:
            # 업종별 분포
            industry_response = self.supabase.table('ksic_codes')\
                .select('top_industry', count='exact')\
                .execute()

            industry_stats = defaultdict(int)
            for record in (industry_response.data or []):
                industry = record.get('top_industry', '미분류')
                industry_stats[industry] += 1

            # 상위 5개 업종
            top_industries = sorted(
                industry_stats.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]

            return {
                'total_industries': len(industry_stats),
                'industry_distribution': dict(industry_stats),
                'top_5_industries': top_industries
            }

        except Exception as e:
            logger.error(f"통계 생성 중 오류: {e}")
            return {}

    def print_report(self):
        """검증 결과 리포트 출력"""
        print("\n" + "=" * 70)
        print("KSIC 데이터 검증 리포트")
        print("=" * 70)
        print(f"검증 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        # 오류
        if self.errors:
            print(f"❌ 오류 ({len(self.errors)}개):")
            for i, error in enumerate(self.errors[:10], 1):
                print(f"  {i}. {error}")
            if len(self.errors) > 10:
                print(f"  ... 외 {len(self.errors) - 10}개")
            print()
        else:
            print("✅ 오류 없음")
            print()

        # 경고
        if self.warnings:
            print(f"⚠️  경고 ({len(self.warnings)}개):")
            for i, warning in enumerate(self.warnings[:10], 1):
                print(f"  {i}. {warning}")
            if len(self.warnings) > 10:
                print(f"  ... 외 {len(self.warnings) - 10}개")
            print()
        else:
            print("✅ 경고 없음")
            print()

        # 통계
        if self.stats:
            print("📊 통계:")
            for key, value in self.stats.items():
                if isinstance(value, dict):
                    print(f"  {key}:")
                    for sub_key, sub_value in value.items():
                        print(f"    - {sub_key}: {sub_value}")
                else:
                    print(f"  {key}: {value}")
            print()

        print("=" * 70)

        # 결과 요약
        if not self.errors:
            print("✅ 검증 성공! 데이터 무결성 확인됨")
        else:
            print(f"❌ 검증 실패: {len(self.errors)}개 오류 발견")

        if self.warnings:
            print(f"⚠️  {len(self.warnings)}개 경고 확인 필요")

        print("=" * 70)

    def run(self) -> bool:
        """전체 검증 프로세스 실행"""
        logger.info("KSIC 데이터 검증 시작")

        try:
            # 1. ksic_codes 테이블 검증
            ksic_result = self.validate_ksic_codes_table()
            self.stats['ksic_codes'] = ksic_result

            # 2. rule_table 일관성 검증
            rule_result = self.validate_rule_table_consistency()
            self.stats['rule_table_consistency'] = rule_result

            # 3. companies 테이블 매핑 검증
            companies_result = self.validate_companies_ksic_mapping()
            self.stats['companies_mapping'] = companies_result

            # 4. 통계 생성
            statistics = self.generate_statistics()
            self.stats['statistics'] = statistics

            # 5. 리포트 출력
            self.print_report()

            # 6. 결과 반환
            return len(self.errors) == 0

        except Exception as e:
            logger.error(f"검증 중 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description='KSIC 데이터 무결성 검증')
    parser.add_argument('-v', '--verbose', action='store_true', help='상세 로깅')
    parser.add_argument('--fix', action='store_true', help='발견된 문제 자동 수정 (미구현)')

    args = parser.parse_args()

    # 환경변수 확인
    if not os.getenv("SUPABASE_URL"):
        print("✗ 오류: SUPABASE_URL 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    # 검증 실행
    try:
        validator = KSICValidator(verbose=args.verbose)
        success = validator.run()

        if args.fix:
            print("\n⚠️  --fix 옵션은 아직 구현되지 않았습니다.")

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
