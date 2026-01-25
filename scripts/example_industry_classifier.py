#!/usr/bin/env python3
"""
Industry Classifier 사용 예제
==============================

k-marketinsight 서비스에 적용할 수 있는 다양한 사용 예제
"""

import os
import logging
from pathlib import Path

# .env 파일 로드
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("경고: python-dotenv가 설치되지 않았습니다. 환경변수를 직접 설정하세요.")

# industry_classifier 모듈 임포트
from scripts.industry_classifier import (
    classify_stock_industry,
    batch_classify_stocks,
    IndustryClassifier,
)


def example1_single_stock():
    """
    예제 1: 단일 종목 분류
    """
    print("\n" + "=" * 80)
    print("예제 1: 단일 종목 분류")
    print("=" * 80)

    stock_code = "005930"  # 삼성전자

    result = classify_stock_industry(stock_code)

    if result and result['success']:
        print(f"\n✓ 분류 성공!")
        print(f"  종목코드:    {result['stock_code']}")
        print(f"  기업명:      {result['corp_name']}")
        print(f"  KSIC 코드:   {result['ksic_code']}")
        print(f"  KSIC 명:     {result['ksic_name']}")
        print(f"  중분류:      {result['middle_class']}")
        print(f"  상위 업종:   {result['top_industry']}")
    else:
        print(f"✗ 분류 실패: {result['error'] if result else 'Unknown error'}")


def example2_batch_classify():
    """
    예제 2: 일괄 분류 (여러 종목)
    """
    print("\n" + "=" * 80)
    print("예제 2: 일괄 분류")
    print("=" * 80)

    # 대표 종목들
    stock_codes = [
        "005930",  # 삼성전자
        "000660",  # SK하이닉스
        "035420",  # NAVER
        "005380",  # 현대차
        "051910",  # LG화학
        "006400",  # 삼성SDI
        "035720",  # 카카오
        "000270",  # 기아
        "068270",  # 셀트리온
    ]

    results = batch_classify_stocks(
        stock_codes,
        save_path="scripts/data/batch_classification_results.json"
    )

    print(f"\n총 {len(results)}개 종목 분류 완료\n")
    print(f"{'종목코드':<8} {'기업명':<20} {'상위 업종':<25} {'성공'}")
    print("-" * 80)

    for r in results:
        status = "✓" if r['success'] else "✗"
        corp_name = r['corp_name'] or "N/A"
        top_industry = r['top_industry'] or "N/A"
        print(f"{r['stock_code']:<8} {corp_name:<20} {top_industry:<25} {status}")


def example3_classifier_reuse():
    """
    예제 3: Classifier 인스턴스 재사용 (효율적)
    """
    print("\n" + "=" * 80)
    print("예제 3: Classifier 인스턴스 재사용 (권장)")
    print("=" * 80)
    print("많은 종목을 분류할 때는 IndustryClassifier 인스턴스를 재사용하세요.")
    print("이렇게 하면 corp_code 매핑을 한 번만 로드합니다.\n")

    # Classifier 인스턴스 생성 (한 번만)
    classifier = IndustryClassifier()

    stock_codes = ["005930", "000660", "035420"]

    for stock_code in stock_codes:
        result = classifier.classify(stock_code)
        if result and result['success']:
            print(
                f"  {result['stock_code']} | "
                f"{result['corp_name']:<15} | "
                f"{result['top_industry']}"
            )


def example4_group_by_industry():
    """
    예제 4: 업종별 종목 그룹화
    """
    print("\n" + "=" * 80)
    print("예제 4: 업종별 종목 그룹화")
    print("=" * 80)

    stock_codes = [
        "005930", "000660",  # 반도체
        "035420", "035720",  # IT
        "005380", "000270",  # 자동차
        "068270", "207940",  # 바이오
    ]

    results = batch_classify_stocks(stock_codes)

    # 업종별로 그룹화
    industry_groups = {}
    for r in results:
        if r['success']:
            industry = r['top_industry']
            if industry not in industry_groups:
                industry_groups[industry] = []
            industry_groups[industry].append(r)

    # 출력
    print()
    for industry, stocks in sorted(industry_groups.items()):
        print(f"📊 {industry}")
        for stock in stocks:
            print(f"    - {stock['corp_name']} ({stock['stock_code']})")
        print()


def example5_export_for_database():
    """
    예제 5: 데이터베이스 저장용 데이터 생성
    """
    print("\n" + "=" * 80)
    print("예제 5: 데이터베이스 저장용 데이터 생성")
    print("=" * 80)

    stock_codes = ["005930", "000660", "035420"]

    classifier = IndustryClassifier()

    # k-marketinsight DB에 저장할 형태로 변환
    db_records = []

    for stock_code in stock_codes:
        result = classifier.classify(stock_code)

        if result and result['success']:
            # DB 레코드 형태
            db_record = {
                'stock_code': result['stock_code'],
                'corp_name': result['corp_name'],
                'ksic_code': result['ksic_code'],
                'ksic_name': result['ksic_name'],
                'industry_category': result['top_industry'],
                'updated_at': 'NOW()',
            }
            db_records.append(db_record)

    # SQL INSERT 문 생성 예시
    print("\n/* SQL INSERT 예시 */")
    print("INSERT INTO companies (stock_code, corp_name, ksic_code, ksic_name, industry_category)")
    print("VALUES")

    for i, record in enumerate(db_records):
        comma = "," if i < len(db_records) - 1 else ";"
        print(
            f"  ('{record['stock_code']}', '{record['corp_name']}', "
            f"'{record['ksic_code']}', '{record['ksic_name']}', "
            f"'{record['industry_category']}'){comma}"
        )


def example6_fastapi_integration():
    """
    예제 6: FastAPI 통합 예시 (코드 스니펫)
    """
    print("\n" + "=" * 80)
    print("예제 6: FastAPI 통합 예시")
    print("=" * 80)

    print("""
FastAPI에서 사용하는 방법:

```python
from fastapi import FastAPI, HTTPException
from industry_classifier import IndustryClassifier

app = FastAPI()

# 앱 시작 시 Classifier 인스턴스 생성
classifier = IndustryClassifier()

@app.get("/api/stocks/{stock_code}/industry")
async def get_stock_industry(stock_code: str):
    \"\"\"종목 업종 조회 API\"\"\"
    result = classifier.classify(stock_code)

    if not result or not result['success']:
        raise HTTPException(status_code=404, detail="Stock not found")

    return {
        "stock_code": result['stock_code'],
        "corp_name": result['corp_name'],
        "industry": result['top_industry'],
        "ksic_code": result['ksic_code'],
        "ksic_name": result['ksic_name']
    }

@app.post("/api/stocks/batch-classify")
async def batch_classify(stock_codes: list[str]):
    \"\"\"일괄 분류 API\"\"\"
    results = classifier.batch_classify(stock_codes)
    return {"results": results}
```
    """)


def main():
    """
    모든 예제 실행
    """
    # 로깅 설정
    logging.basicConfig(
        level=logging.WARNING,  # 예제에서는 경고 이상만 표시
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    print("=" * 80)
    print("Industry Classifier 사용 예제")
    print("=" * 80)
    print()
    print("DART API 키가 필요합니다.")
    print("환경변수 DART_API_KEY를 설정하거나 .env 파일을 생성하세요.")
    print()

    # DART API 키 확인
    if not os.getenv("DART_API_KEY"):
        print("⚠️  경고: DART_API_KEY가 설정되지 않았습니다.")
        print("   일부 예제가 정상 작동하지 않을 수 있습니다.")
        print()
        print("   DART API 키 발급: https://opendart.fss.or.kr/")
        print()

    try:
        # 예제 실행
        example1_single_stock()
        example2_batch_classify()
        example3_classifier_reuse()
        example4_group_by_industry()
        example5_export_for_database()
        example6_fastapi_integration()

        print("\n" + "=" * 80)
        print("✓ 모든 예제 실행 완료!")
        print("=" * 80)

    except Exception as e:
        print(f"\n✗ 오류 발생: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
