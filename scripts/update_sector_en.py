#!/usr/bin/env python3
"""
섹터 영문명 매핑 스크립트
GICS 기반 영문 섹터명을 sectors 테이블에 업데이트합니다.

사용법:
    python scripts/update_sector_en.py

환경변수:
    SUPABASE_URL: Supabase 프로젝트 URL
    SUPABASE_SERVICE_ROLE_KEY: Supabase Service Role Key
"""

import os
from dotenv import load_dotenv 
from supabase import create_client, Client
load_dotenv('.env.local')

# GICS 기반 섹터 한글 -> 영문 매핑
SECTOR_MAPPING = {
    # Technology 그룹
    '반도체와 반도체장비': 'Semiconductors, IT & Displays',
    '디스플레이·전자부품': 'Semiconductors, IT & Displays',
    'IT·소프트웨어': 'Semiconductors, IT & Displays',
    '정보서비스': 'Semiconductors, IT & Displays',

    # Mobility 그룹
    '자동차': 'Automobiles, Aerospace & Logistics',
    '방산·항공': 'Automobiles, Aerospace & Logistics',
    '항공': 'Automobiles, Aerospace & Logistics',
    '운송': 'Automobiles, Aerospace & Logistics',
    '창고·물류': 'Automobiles, Aerospace & Logistics',
    '창고·운송': 'Automobiles, Aerospace & Logistics',

    # Healthcare 그룹
    '바이오·제약': 'Healthcare & Biotech',
    '전문·과학·기술서비스': 'Healthcare & Biotech',
    '연구개발': 'Healthcare & Biotech',
    '보건·의료': 'Healthcare & Biotech',

    # Finance 그룹
    '금융': 'Financial Services',
    '금융지원서비스': 'Financial Services',
    '보험·연금': 'Financial Services',
    '전문서비스': 'Financial Services',

    # Materials 그룹
    '화학': 'Materials & Chemicals',
    '2차전지·소재': 'Materials & Chemicals',
    '고무·플라스틱': 'Materials & Chemicals',
    '금속가공': 'Materials & Chemicals',
    '비금속광물': 'Materials & Chemicals',
    '1차금속': 'Materials & Chemicals',
    '석유·화학제품': 'Materials & Chemicals',
    '섬유': 'Materials & Chemicals',

    # Media 그룹
    '출판·미디어': 'Media & Entertainment',
    '영상·방송': 'Media & Entertainment',
    '통신·방송': 'Media & Entertainment',
    '창작·예술': 'Media & Entertainment',
    '광고·시장조사': 'Media & Entertainment',
    '출판·인쇄': 'Media & Entertainment',
    '통신': 'Media & Entertainment',

    # Consumer 그룹
    '식품': 'Consumer Goods & Retail',
    '음료': 'Consumer Goods & Retail',
    '도매': 'Consumer Goods & Retail',
    '소매': 'Consumer Goods & Retail',
    '의복·패션': 'Consumer Goods & Retail',
    '가죽·신발': 'Consumer Goods & Retail',
    '담배': 'Consumer Goods & Retail',
    '숙박': 'Consumer Goods & Retail',
    '음식점': 'Consumer Goods & Retail',

    # Infrastructure 그룹
    '건설': 'Infrastructure & Energy',
    '토목': 'Infrastructure & Energy',
    '전기장비': 'Infrastructure & Energy',
    '전기·가스': 'Infrastructure & Energy',
    '환경·복원': 'Infrastructure & Energy',
    '환경정화': 'Infrastructure & Energy',
    '전문건설': 'Infrastructure & Energy',
    '하수·폐기물': 'Infrastructure & Energy',
    '수도': 'Infrastructure & Energy',

    # Industrial 그룹
    '기계·설비': 'Industrial Machinery',
    '목재·종이': 'Industrial Machinery',

    # Business 그룹
    '사업지원서비스': 'Business & Services',
    '부동산': 'Business & Services',
    '사회복지': 'Business & Services',

    # Others 그룹
    '농업': 'Education & Agriculture',
    '어업': 'Education & Agriculture',
    '임업': 'Education & Agriculture',
    '교육': 'Education & Agriculture',
    '도서관·박물관': 'Education & Agriculture',

    # Mining 그룹
    '석탄·광업': 'Mining & Resources',
    '원유·가스': 'Mining & Resources',
    '금속광업': 'Mining & Resources',

    # 기타
    '기타': 'Others',
    '미분류': 'Unclassified',
    '공공행정': 'Public Administration',
    '예술·스포츠·여가': 'Arts, Sports & Leisure',
}


def get_supabase_client() -> Client:
    """Supabase 클라이언트 생성"""
    url = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")

    return create_client(url, key)


def update_sectors():
    """companies 테이블의 한글 sector를 기반으로 sector_en 업데이트"""
    print("🔄 Connecting to Supabase...")
    supabase = get_supabase_client()

    print("📊 Fetching companies from database...")
    # 1. 한글 섹터명이 저장된 'sector' 컬럼을 반드시 가져와야 합니다.
    response = supabase.table('companies').select('corp_name, sector, sector_en').execute()
    companies = response.data

    print(f"✅ Found {len(companies)} companies")

    updated_count = 0
    skipped_count = 0

    for company in companies:
        name_val = company['corp_name']
        kr_sector = company.get('sector')  # DB의 한글 섹터명
        current_en = company.get('sector_en')

        # 2. 매핑의 키(Key)인 'kr_sector'가 있는지 확인합니다.
        if kr_sector in SECTOR_MAPPING:
            new_en = SECTOR_MAPPING[kr_sector]

            # 이미 업데이트가 되어 있다면 스킵
            if current_en == new_en:
                skipped_count += 1
                continue

            # 3. 해당 종목(corp_name)의 영문 섹터명을 업데이트
            print(f"  📝 {name_val} ({kr_sector}) -> {new_en}")
            supabase.table('companies').update({'sector_en': new_en}).eq('corp_name', name_val).execute()
            updated_count += 1
        else:
            # 매핑 테이블에 없는 한글 섹터명인 경우
            if not current_en:
                print(f"  ⚠️ {name_val} ({kr_sector}) -> Others (not in mapping)")
                supabase.table('companies').update({'sector_en': 'Others'}).eq('corp_name', name_val).execute()
                updated_count += 1
            else:
                skipped_count += 1

    print(f"\n✅ Update complete!")
    print(f"   - Updated: {updated_count}")
    print(f"   - Skipped: {skipped_count}")


def verify_mapping():
    """매핑 결과 확인"""
    print("\n🔍 Verifying sector mapping...")
    supabase = get_supabase_client()

    response = supabase.table('companies').select('corp_name, sector_en').order('sector_en').execute()
    sectors = response.data

    # 그룹별로 출력
    groups = {}
    for sector in sectors:
        en = sector.get('sector_en') or 'NULL'
        if en not in groups:
            groups[en] = []
        groups[en].append(sector['corp_name'])

    print("\n📋 Sector groups:")
    for en_name, kr_names in sorted(groups.items()):
        print(f"\n  [{en_name}]")
        for kr in kr_names:
            print(f"    - {kr}")


if __name__ == '__main__':
    try:
        update_sectors()
        verify_mapping()
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
