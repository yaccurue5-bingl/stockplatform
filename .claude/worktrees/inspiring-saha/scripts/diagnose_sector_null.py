#!/usr/bin/env python3
"""
Sector NULL 진단 스크립트
========================

특정 종목의 sector가 null인 이유를 진단합니다.

사용법:
    python scripts/diagnose_sector_null.py 000520  # 삼일제약
    python scripts/diagnose_sector_null.py 005930  # 삼성전자
"""

import sys
import logging
from pathlib import Path

# 프로젝트 루트 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.env_loader import load_env
load_env()

from scripts.industry_classifier.dart_api import DARTClient
from scripts.industry_classifier import IndustryClassifier

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def diagnose_stock(stock_code: str):
    """종목의 sector 매핑 프로세스를 진단"""

    print("=" * 70)
    print(f"🔍 Sector NULL 진단: {stock_code}")
    print("=" * 70)

    # Step 1: DART 클라이언트 초기화
    print("\n[Step 1] DART 클라이언트 초기화")
    try:
        dart_client = DARTClient()
        print("  ✓ DART 클라이언트 초기화 성공")
    except Exception as e:
        print(f"  ✗ 실패: {e}")
        return

    # Step 2: corpCode.xml 로드
    print("\n[Step 2] corpCode.xml 로드")
    try:
        dart_client.load_corp_code_map(force_refresh=False)
        print(f"  ✓ {len(dart_client.corp_code_map)}개 기업 코드 로드 완료")
    except Exception as e:
        print(f"  ✗ 실패: {e}")
        return

    # Step 3: stock_code → corp_code 매핑
    print(f"\n[Step 3] stock_code → corp_code 매핑")
    corp_info = dart_client.get_corp_code(stock_code)

    if not corp_info:
        print(f"  ✗ 실패: 종목코드 {stock_code}를 corpCode.xml에서 찾을 수 없습니다.")
        print("\n❌ 원인: DART corpCode.xml에 해당 종목이 등록되지 않음")
        print("   - 최근 상장된 종목일 수 있습니다")
        print("   - 상장폐지 예정 종목일 수 있습니다")
        print("   - KONEX 등 소규모 시장 종목일 수 있습니다")
        return

    print(f"  ✓ 성공:")
    print(f"    corp_code: {corp_info['corp_code']}")
    print(f"    corp_name: {corp_info['corp_name']}")
    print(f"    stock_code: {corp_info['stock_code']}")
    print(f"    modify_date: {corp_info.get('modify_date', 'N/A')}")

    # Step 4: DART API로 기업개황 조회
    print(f"\n[Step 4] DART API 기업개황 조회")
    print(f"  API URL: https://opendart.fss.or.kr/api/company.json")
    print(f"  corp_code: {corp_info['corp_code']}")

    company_info = dart_client.get_company_info(corp_info['corp_code'])

    if not company_info:
        print(f"  ✗ 실패: DART API 호출 실패")
        print("\n❌ 원인: DART API 호출 실패")
        print("   - 네트워크 오류")
        print("   - API Rate Limit 초과")
        print("   - Proxy 차단")
        print("   - DART API 서버 오류")
        return

    print(f"  ✓ 성공:")
    print(f"    status: {company_info.get('status', 'N/A')}")
    print(f"    corp_name: {company_info.get('corp_name', 'N/A')}")

    # Step 5: KSIC 코드 확인
    print(f"\n[Step 5] KSIC 코드 확인")
    induty_code = company_info.get('induty_code', '')
    induty_name = company_info.get('induty_name', '')

    if not induty_code:
        print(f"  ✗ 실패: induty_code가 비어 있습니다")
        print(f"\n❌ 원인: DART에 업종 정보가 등록되지 않음")
        print(f"   - DART 기업개황에 업종 코드(induty_code)가 없습니다")
        print(f"   - 기업이 아직 업종 정보를 제출하지 않았을 수 있습니다")
        print(f"\n  DART API 전체 응답:")
        for key, value in company_info.items():
            if key not in ['status', 'message']:
                print(f"    {key}: {value}")
        return

    print(f"  ✓ 성공:")
    print(f"    induty_code: {induty_code}")
    print(f"    induty_name: {induty_name}")

    # Step 6: KSIC → Sector 매핑
    print(f"\n[Step 6] KSIC → Sector 매핑")

    from scripts.industry_classifier.rule_table import get_top_industry

    # 중분류 추출 (앞 2자리)
    numeric_code = ''.join(filter(str.isdigit, str(induty_code)))
    if len(numeric_code) >= 2:
        middle_class = numeric_code[:2]
        print(f"  중분류(앞 2자리): {middle_class}")
    else:
        print(f"  ✗ 실패: KSIC 코드가 너무 짧습니다: {induty_code}")
        return

    sector = get_top_industry(induty_code)

    print(f"  ✓ 매핑 결과:")
    print(f"    KSIC 중분류: {middle_class}")
    print(f"    Sector: {sector}")

    # Step 7: 전체 분류 테스트
    print(f"\n[Step 7] IndustryClassifier 통합 테스트")

    classifier = IndustryClassifier()
    result = classifier.classify(stock_code)

    if result and result.get('success'):
        print(f"  ✓ 성공:")
        print(f"    stock_code: {result['stock_code']}")
        print(f"    corp_name: {result['corp_name']}")
        print(f"    ksic_code: {result['ksic_code']}")
        print(f"    middle_class: {result['middle_class']}")
        print(f"    top_industry: {result['top_industry']}")
    else:
        print(f"  ✗ 실패:")
        print(f"    error: {result.get('error') if result else 'Unknown'}")

    # 최종 결과
    print("\n" + "=" * 70)
    print("✅ 진단 완료")
    print("=" * 70)

    if result and result.get('success'):
        print(f"\n✅ {stock_code} ({result['corp_name']})는 정상적으로 매핑 가능합니다!")
        print(f"   Sector: {result['top_industry']}")
        print(f"\n💡 해결 방법:")
        print(f"   python scripts/map_companies_to_ksic.py --stock-codes {stock_code}")
    else:
        print(f"\n❌ {stock_code}는 매핑할 수 없습니다.")
        print(f"   원인: 위의 실패 단계를 확인하세요.")


def main():
    """메인 함수"""
    if len(sys.argv) < 2:
        print("사용법: python scripts/diagnose_sector_null.py <종목코드>")
        print("예제: python scripts/diagnose_sector_null.py 000520")
        sys.exit(1)

    stock_code = sys.argv[1]

    # 'A' 접두사 제거
    if stock_code.startswith('A'):
        stock_code = stock_code[1:]

    # 6자리로 패딩
    stock_code = stock_code.zfill(6)

    try:
        diagnose_stock(stock_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  사용자에 의해 중단되었습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
