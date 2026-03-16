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
    '지주회사(반도체·ICT)': 'Semiconductors, IT & Displays',
    '지주회사(전자·화학)': 'Semiconductors, IT & Displays',

    # Mobility 그룹
    '자동차': 'Automobiles, Aerospace & Logistics',
    '방산·항공': 'Automobiles, Aerospace & Logistics',
    '항공': 'Automobiles, Aerospace & Logistics',
    '운송': 'Automobiles, Aerospace & Logistics',
    '창고·물류': 'Automobiles, Aerospace & Logistics',
    '창고·운송': 'Automobiles, Aerospace & Logistics',
    '운송장비': 'Automobiles, Aerospace & Logistics',

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
    '지주회사(금융)': 'Financial Services', 

    # Materials 그룹
    '화학': 'Materials & Chemicals',
    '2차전지·소재': 'Materials & Chemicals',
    '고무·플라스틱': 'Materials & Chemicals',
    '금속가공': 'Materials & Chemicals',
    '비금속광물': 'Materials & Chemicals',
    '1차금속': 'Materials & Chemicals',
    '석유·화학제품': 'Materials & Chemicals',
    '섬유': 'Materials & Chemicals',
    '기타 제조': 'Materials & Chemicals',
    '기타 제조': 'Materials & Chemicals', 

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
    '가구': 'Consumer Goods & Retail',
    '지주회사(유통·식품)': 'Consumer Goods & Retail',

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
    '지주회사(방산·에너지)': 'Infrastructure & Energy',
    '지주회사(기계·건설)': 'Infrastructure & Energy',
    '지주회사(에너지·인프라)': 'Infrastructure & Energy',
    '지주회사(건설·시멘트)': 'Infrastructure & Energy',

    # Industrial 그룹
    '기계·설비': 'Industrial Machinery',
    '목재·종이': 'Industrial Machinery',

    # Business 그룹
    '사업지원서비스': 'Business & Services',
    '부동산': 'Business & Services',
    '사회복지': 'Business & Services',
    '임대업': 'Business & Services',
    '수리업': 'Business & Services',

    # Others 그룹
    '농업': 'Education & Agriculture',
    '어업': 'Education & Agriculture',
    '임업': 'Education & Agriculture',
    '교육': 'Education & Agriculture',
    '도서관·박물관': 'Education & Agriculture',
    '기타 개인서비스': 'Others',

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


import os
import time # 지연 시간을 주기 위해 추가
from dotenv import load_dotenv 
from supabase import create_client, Client

load_dotenv('.env.local')

# SECTOR_MAPPING (기존 내용 유지)

def update_all_sectors_safe():
    print("🔄 Connecting to Supabase...")
    supabase = get_supabase_client()

    # 1. 한 번에 가져올 데이터 양 조절 (Batch Size)
    batch_size = 100
    current_start = 0
    total_updated = 0
    total_skipped = 0
    missing_stocks = []

    print("🚀 Starting Batch Update...")

    while True:
        print(f"📦 Fetching range {current_start} to {current_start + batch_size - 1}...")
        
        # 100개씩 끊어서 가져오기
        try:
            response = supabase.table('companies')\
                .select('corp_name, sector, sector_en')\
                .range(current_start, current_start + batch_size - 1)\
                .execute()
        except Exception as e:
            print(f"❌ Network Error: {e}. Retrying in 3 seconds...")
            time.sleep(3)
            continue

        companies = response.data

        # 더 이상 가져올 데이터가 없으면 종료
        if not companies:
            break

        for company in companies:
            name_val = company['corp_name']
            kr_sector = company.get('sector')
            current_en = company.get('sector_en')

            if not kr_sector:
                missing_stocks.append(f"{name_val} (섹터 정보 없음)")
                continue

            if kr_sector in SECTOR_MAPPING:
                new_en = SECTOR_MAPPING[kr_sector]
                
                if current_en == new_en:
                    total_skipped += 1
                    continue

                # 개별 업데이트 실행
                supabase.table('companies').update({'sector_en': new_en}).eq('corp_name', name_val).execute()
                total_updated += 1
            else:
                missing_stocks.append(f"{name_val} ({kr_sector})")

        print(f"   ✅ Done: {current_start + len(companies)} processed. (Updated: {total_updated})")
        
        current_start += batch_size
        time.sleep(0.1) # 서버 과부하 방지용 짧은 휴식

    # 📁 미매핑 목록 저장
    if missing_stocks:
        with open('missing_sectors_list.txt', 'w', encoding='utf-8') as f:
            f.write("\n".join(missing_stocks))
        print(f"\n⚠️  Found unmapped stocks. Saved to 'missing_sectors_list.txt'")

    print(f"\n✨ All process finished! Total Updated: {total_updated}")

if __name__ == '__main__':
    update_all_sectors_safe()
