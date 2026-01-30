#!/usr/bin/env python3
"""
Supabase 연결 테스트 및 데이터 조회 (프록시 우회 버전)
"""
import os
import sys

# ⚠️ 중요: 프록시 비활성화를 가장 먼저 수행
# 이것은 supabase 임포트 전에 실행되어야 합니다
proxy_vars = [
    'http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY',
    'GLOBAL_AGENT_HTTP_PROXY', 'GLOBAL_AGENT_HTTPS_PROXY',
    'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'
]

print("🔧 프록시 설정 제거 중...")
for var in proxy_vars:
    if var in os.environ:
        print(f"  제거: {var[:30]}...")
        del os.environ[var]

# urllib3/requests의 프록시도 비활성화
os.environ['NO_PROXY'] = '*'
os.environ['no_proxy'] = '*'
print("✅ 프록시 비활성화 완료\n")

from supabase import create_client, Client
from dotenv import load_dotenv

# .env.local 파일 로드
load_dotenv('.env.local')

def test_supabase_connection():
    """Supabase 연결 테스트 및 데이터 조회"""

    # 환경변수에서 Supabase 설정 가져오기
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # 서버용 키 사용

    if not supabase_url or not supabase_key:
        print("❌ Supabase 설정을 찾을 수 없습니다.")
        return

    print(f"✅ Supabase URL: {supabase_url}")
    print(f"✅ Service Role Key: {supabase_key[:20]}...")
    print("\n" + "="*60)

    # Supabase 클라이언트 생성
    supabase: Client = create_client(supabase_url, supabase_key)
    print("✅ Supabase 클라이언트 생성 완료\n")

    # 1. sectors 테이블 조회
    print("="*60)
    print("📊 1. Sectors 테이블 조회 (처음 10개)")
    print("="*60)
    try:
        response = supabase.table('sectors').select('*').limit(10).execute()
        print(f"✅ 조회 성공! {len(response.data)}개의 업종 데이터:")
        for sector in response.data:
            print(f"  - {sector['name']}: {sector['description']}")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

    # 2. companies 테이블 조회
    print("\n" + "="*60)
    print("🏢 2. Companies 테이블 조회 (처음 5개)")
    print("="*60)
    try:
        response = supabase.table('companies').select('*').limit(5).execute()
        print(f"✅ 조회 성공! {len(response.data)}개의 종목 데이터:")
        for company in response.data:
            print(f"  - [{company['code']}] {company['name_kr']} ({company['market']}) - {company.get('sector', 'N/A')}")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

    # 3. companies 테이블 총 개수 확인
    print("\n" + "="*60)
    print("📈 3. Companies 테이블 총 개수")
    print("="*60)
    try:
        response = supabase.table('companies').select('code', count='exact').execute()
        print(f"✅ 총 {response.count}개의 종목이 등록되어 있습니다.")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

    # 4. 특정 조건으로 조회 (KOSPI 종목)
    print("\n" + "="*60)
    print("💎 4. KOSPI 종목 조회 (처음 3개)")
    print("="*60)
    try:
        response = supabase.table('companies').select('*').eq('market', 'KOSPI').limit(3).execute()
        print(f"✅ 조회 성공! {len(response.data)}개의 KOSPI 종목:")
        for company in response.data:
            print(f"  - [{company['code']}] {company['name_kr']} - {company.get('sector', 'N/A')}")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

    # 5. sector별 종목 수 집계
    print("\n" + "="*60)
    print("📊 5. Sector별 종목 수")
    print("="*60)
    try:
        # sector별로 그룹화하여 개수 세기
        response = supabase.table('companies').select('sector').execute()

        # Python에서 집계
        sector_count = {}
        for company in response.data:
            sector = company.get('sector', '미분류')
            sector_count[sector] = sector_count.get(sector, 0) + 1

        # 상위 10개 업종 출력
        print("✅ Sector별 종목 수 (상위 10개):")
        sorted_sectors = sorted(sector_count.items(), key=lambda x: x[1], reverse=True)[:10]
        for sector, count in sorted_sectors:
            print(f"  - {sector}: {count}개")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

    print("\n" + "="*60)
    print("✅ 테스트 완료!")
    print("="*60)

if __name__ == '__main__':
    test_supabase_connection()
