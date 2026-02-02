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

    print(f"{'종목코드':<10} {'종목명':<15} {'DB sector':<20} {'DART KSIC':<12} {'rule_table 결과':<20}")
    print("-" * 90)

    # DART API로 KSIC 코드 조회
    import requests
    DART_API_KEY = os.getenv("DART_API_KEY")

    for stock_code, expected_name in test_stocks:
        # 1. companies 테이블에서 현재 sector 조회
        company = supabase.table("companies").select(
            "corp_name, sector, corp_code"
        ).eq("stock_code", stock_code).execute()

        if not company.data:
            print(f"{stock_code:<10} {expected_name:<15} (종목 없음)")
            continue

        corp_name = company.data[0].get("corp_name", "")
        db_sector = company.data[0].get("sector") or "없음"
        corp_code = company.data[0].get("corp_code", "")

        # 2. DART API로 KSIC 코드 조회
        ksic_code = ""
        if corp_code and DART_API_KEY:
            try:
                url = "https://opendart.fss.or.kr/api/company.json"
                params = {"crtfc_key": DART_API_KEY, "corp_code": corp_code}
                resp = requests.get(url, params=params, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == "000":
                        ksic_code = data.get("induty_code", "")
            except Exception as e:
                pass

        # 3. rule_table.py로 매핑
        rule_sector = get_top_industry(ksic_code) if ksic_code else "미조회"

        # 결과 출력
        match_icon = "✅" if db_sector == rule_sector else "❌"
        print(f"{stock_code:<10} {corp_name:<15} {db_sector:<20} {ksic_code or '없음':<12} {rule_sector:<20} {match_icon}")

    print()
    print("=" * 100)
    print("분석:")
    print("- DB sector: 현재 companies 테이블에 저장된 값")
    print("- DART KSIC: DART API에서 조회한 induty_code")
    print("- rule_table 결과: Python rule_table.py 기반 매핑 (5자리→4자리→2자리 순서)")
    print("- ✅: DB와 rule_table 결과 일치")
    print("- ❌: DB와 rule_table 결과 불일치 (수정 필요)")
    print("=" * 100)

if __name__ == "__main__":
    main()
