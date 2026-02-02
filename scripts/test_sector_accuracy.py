#!/usr/bin/env python3
"""
Sector 매핑 정확도 테스트
========================

세 가지 소스의 sector 매핑을 비교:
1. 현재 companies.sector (DB에 저장된 값)
2. ksic_codes 테이블 (DB에 저장된 KSIC 매핑)
3. rule_table.py (Python 코드 매핑)

사용법:
    python scripts/test_sector_accuracy.py
"""

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from utils.env_loader import load_env
load_env()

from supabase import create_client
from scripts.industry_classifier.rule_table import get_top_industry

def get_supabase_client():
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)

def main():
    supabase = get_supabase_client()

    # 테스트할 종목들 (다양한 업종)
    test_stocks = [
        ("003550", "LG"),           # 지주회사
        ("034730", "SK"),           # 지주회사
        ("005930", "삼성전자"),      # 반도체
        ("000660", "SK하이닉스"),    # 반도체
        ("035720", "카카오"),        # IT
        ("035420", "NAVER"),        # IT
        ("005380", "현대차"),        # 자동차
        ("105560", "KB금융"),        # 금융
        ("207940", "삼성바이오로직스"), # 바이오
        ("001040", "CJ"),           # 지주회사
        ("068270", "셀트리온"),      # 바이오
        ("051910", "LG화학"),        # 화학
        ("006400", "삼성SDI"),       # 2차전지
        ("079430", "현대리바트"),     # 가구
        ("001680", "대상"),          # 식품
    ]

    print("=" * 100)
    print("Sector 매핑 정확도 비교 테스트")
    print("=" * 100)
    print()

    print(f"{'종목코드':<10} {'종목명':<15} {'DB sector':<20} {'ksic_codes':<20} {'rule_table':<20} {'KSIC코드':<10}")
    print("-" * 100)

    for stock_code, expected_name in test_stocks:
        # 1. companies 테이블에서 현재 sector 조회
        company = supabase.table("companies").select(
            "corp_name, sector, ksic_code"
        ).eq("stock_code", stock_code).execute()

        if not company.data:
            print(f"{stock_code:<10} {expected_name:<15} (종목 없음)")
            continue

        corp_name = company.data[0].get("corp_name", "")
        db_sector = company.data[0].get("sector", "없음")
        ksic_code = company.data[0].get("ksic_code", "")

        # 2. ksic_codes 테이블에서 매핑 조회
        ksic_sector = "없음"
        if ksic_code:
            ksic_result = supabase.table("ksic_codes").select(
                "top_industry"
            ).eq("ksic_code", ksic_code[:2]).execute()  # 중분류로 조회

            if ksic_result.data:
                ksic_sector = ksic_result.data[0].get("top_industry", "없음")

        # 3. rule_table.py로 매핑
        rule_sector = get_top_industry(ksic_code) if ksic_code else "없음"

        # 결과 출력
        print(f"{stock_code:<10} {corp_name:<15} {db_sector:<20} {ksic_sector:<20} {rule_sector:<20} {ksic_code or '없음':<10}")

    print()
    print("=" * 100)
    print("분석:")
    print("- DB sector: 현재 companies 테이블에 저장된 값")
    print("- ksic_codes: DB의 ksic_codes 테이블 기반 매핑")
    print("- rule_table: Python rule_table.py 기반 매핑 (5자리→4자리→2자리 순서)")
    print("=" * 100)

if __name__ == "__main__":
    main()
