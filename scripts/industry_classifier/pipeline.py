"""
Industry Classification Pipeline
=================================

종목코드 → 업종 분류 전체 파이프라인

처리 흐름:
1. stock_code → corp_code 매핑 (DART)
2. DART 기업개황 API 호출
3. KSIC 코드 추출
4. KSIC 중분류 기준 상위 업종 매핑
5. 최종 결과 반환
"""

import logging
from typing import Optional, List
import json
from pathlib import Path

from .dart_api import DARTClient
from .ksic_mapper import KSICMapper
from .rule_table import get_top_industry

logger = logging.getLogger(__name__)


class IndustryClassifier:
    """
    업종 분류 파이프라인
    """

    def __init__(self, dart_api_key: str = None):
        """
        Args:
            dart_api_key: DART API 키 (없으면 환경변수에서 읽음)
        """
        self.dart_client = DARTClient(api_key=dart_api_key)
        self.ksic_mapper = KSICMapper()
        logger.info("Industry Classifier 초기화 완료")

    def classify(self, stock_code: str) -> Optional[dict]:
        """
        종목코드로 업종 분류

        Args:
            stock_code: 종목코드 (예: "005930")

        Returns:
            {
                "stock_code": "005930",
                "corp_code": "00126380",
                "corp_name": "삼성전자",
                "ksic_code": "26110",
                "ksic_name": "반도체 제조업",
                "middle_class": "26",
                "top_industry": "반도체와 반도체장비",
                "success": true,
                "error": null
            }

        Examples:
            >>> classifier = IndustryClassifier()
            >>> result = classifier.classify("005930")
            >>> print(result['top_industry'])
            '반도체와 반도체장비'
        """
        logger.info(f"업종 분류 시작: {stock_code}")

        try:
            # 1. stock_code → corp_code 매핑 및 DART API 호출
            company_industry = self.dart_client.get_company_industry(stock_code)

            if not company_industry:
                logger.warning(f"DART 데이터 조회 실패: {stock_code}")
                return {
                    "stock_code": stock_code,
                    "corp_code": None,
                    "corp_name": None,
                    "ksic_code": None,
                    "ksic_name": None,
                    "middle_class": None,
                    "top_industry": "미분류",
                    "success": False,
                    "error": "DART 데이터 조회 실패"
                }

            # 2. KSIC 코드 추출
            ksic_code = company_industry.get('induty_code', '')
            dart_ksic_name = company_industry.get('induty_name', '')

            # 3. KSIC 매핑 및 상위 업종 분류
            ksic_classification = self.ksic_mapper.classify_industry(ksic_code)

            # 4. 결과 조합
            result = {
                "stock_code": stock_code,
                "corp_code": company_industry['corp_code'],
                "corp_name": company_industry['corp_name'],
                "ksic_code": ksic_code,
                "ksic_name": ksic_classification.get('ksic_name') or dart_ksic_name,
                "middle_class": ksic_classification.get('middle_class', ''),
                "top_industry": ksic_classification.get('top_industry', '미분류'),
                "success": True,
                "error": None
            }

            logger.info(
                f"업종 분류 완료: {stock_code} → "
                f"{result['corp_name']} ({result['top_industry']})"
            )

            return result

        except Exception as e:
            logger.error(f"업종 분류 중 오류 발생: {stock_code} - {e}")
            return {
                "stock_code": stock_code,
                "corp_code": None,
                "corp_name": None,
                "ksic_code": None,
                "ksic_name": None,
                "middle_class": None,
                "top_industry": "오류",
                "success": False,
                "error": str(e)
            }

    def batch_classify(
        self,
        stock_codes: List[str],
        save_path: str = None
    ) -> List[dict]:
        """
        여러 종목 일괄 분류

        Args:
            stock_codes: 종목코드 리스트
            save_path: 결과 저장 경로 (JSON)

        Returns:
            분류 결과 리스트

        Examples:
            >>> classifier = IndustryClassifier()
            >>> results = classifier.batch_classify(["005930", "000660"])
            >>> for r in results:
            ...     print(f"{r['corp_name']}: {r['top_industry']}")
        """
        logger.info(f"일괄 분류 시작: {len(stock_codes)}개 종목")

        results = []
        success_count = 0
        fail_count = 0

        for i, stock_code in enumerate(stock_codes, 1):
            logger.info(f"진행률: {i}/{len(stock_codes)}")

            result = self.classify(stock_code)
            results.append(result)

            if result['success']:
                success_count += 1
            else:
                fail_count += 1

        logger.info(
            f"일괄 분류 완료: 성공 {success_count}개, 실패 {fail_count}개"
        )

        # 결과 저장
        if save_path:
            self._save_results(results, save_path)

        return results

    def _save_results(self, results: List[dict], save_path: str):
        """
        결과를 JSON 파일로 저장

        Args:
            results: 분류 결과 리스트
            save_path: 저장 경로
        """
        save_path = Path(save_path)
        save_path.parent.mkdir(parents=True, exist_ok=True)

        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        logger.info(f"결과 저장 완료: {save_path}")


# 편의 함수들

def classify_stock_industry(
    stock_code: str,
    dart_api_key: str = None
) -> Optional[dict]:
    """
    종목코드로 업종 분류 (간편 함수)

    Args:
        stock_code: 종목코드
        dart_api_key: DART API 키 (선택)

    Returns:
        분류 결과 딕셔너리

    Examples:
        >>> result = classify_stock_industry("005930")
        >>> print(result['top_industry'])
        '반도체와 반도체장비'
    """
    classifier = IndustryClassifier(dart_api_key=dart_api_key)
    return classifier.classify(stock_code)


def batch_classify_stocks(
    stock_codes: List[str],
    dart_api_key: str = None,
    save_path: str = None
) -> List[dict]:
    """
    여러 종목 일괄 분류 (간편 함수)

    Args:
        stock_codes: 종목코드 리스트
        dart_api_key: DART API 키 (선택)
        save_path: 결과 저장 경로 (선택)

    Returns:
        분류 결과 리스트

    Examples:
        >>> results = batch_classify_stocks(
        ...     ["005930", "000660"],
        ...     save_path="industry_results.json"
        ... )
    """
    classifier = IndustryClassifier(dart_api_key=dart_api_key)
    return classifier.batch_classify(stock_codes, save_path=save_path)


if __name__ == "__main__":
    # 테스트
    import os
    from dotenv import load_dotenv

    load_dotenv()

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # 단일 종목 분류
    print("\n" + "=" * 60)
    print("단일 종목 분류 테스트")
    print("=" * 60)

    result = classify_stock_industry("005930")
    if result:
        print(f"\n[{result['stock_code']}] {result['corp_name']}")
        print(f"  KSIC 코드: {result['ksic_code']}")
        print(f"  KSIC 명: {result['ksic_name']}")
        print(f"  중분류: {result['middle_class']}")
        print(f"  상위 업종: {result['top_industry']}")
        print(f"  성공: {result['success']}")

    # 일괄 분류
    print("\n" + "=" * 60)
    print("일괄 분류 테스트")
    print("=" * 60)

    test_stocks = [
        "005930",  # 삼성전자
        "000660",  # SK하이닉스
        "035420",  # NAVER
        "005380",  # 현대차
    ]

    results = batch_classify_stocks(
        test_stocks,
        save_path="scripts/data/test_classification_results.json"
    )

    print(f"\n총 {len(results)}개 종목 분류 완료")
    print()
    for r in results:
        if r['success']:
            print(
                f"  {r['stock_code']:6s} | {r['corp_name']:15s} | "
                f"{r['top_industry']}"
            )
        else:
            print(
                f"  {r['stock_code']:6s} | 실패: {r['error']}"
            )
