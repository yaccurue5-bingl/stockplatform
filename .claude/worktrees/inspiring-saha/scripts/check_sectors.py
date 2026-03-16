#!/usr/bin/env python3
"""
Supabase companies 테이블의 sector 값을 조사하는 스크립트
- sector가 null인 기업 수
- sector가 "기타"인 기업 목록
- 모든 고유한 sector 값들
"""

import os
from supabase import create_client, Client
from collections import Counter

# Supabase 클라이언트 설정
url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not url or not key:
    print("❌ Error: NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.")
    exit(1)

supabase: Client = create_client(url, key)

print("=" * 80)
print("Supabase Companies 테이블 Sector 분석")
print("=" * 80)

# 전체 기업 데이터 조회
response = supabase.table('companies').select('code, name_kr, market, sector').execute()
companies = response.data

print(f"\n📊 전체 기업 수: {len(companies)}")

# Sector 통계
null_sectors = [c for c in companies if not c.get('sector')]
gita_sectors = [c for c in companies if c.get('sector') == '기타']
valid_sectors = [c for c in companies if c.get('sector') and c.get('sector') != '기타']

print(f"   - Sector NULL: {len(null_sectors)}개")
print(f"   - Sector '기타': {len(gita_sectors)}개")
print(f"   - 유효한 Sector: {len(valid_sectors)}개")

# 고유한 sector 값들
sector_counter = Counter([c.get('sector') or 'NULL' for c in companies])
print(f"\n📋 고유한 Sector 값 ({len(sector_counter)}개):")
for sector, count in sector_counter.most_common():
    print(f"   {sector}: {count}개")

# BYC 확인
print("\n" + "=" * 80)
print("🔍 BYC 기업 정보")
print("=" * 80)
byc = supabase.table('companies').select('*').ilike('name_kr', '%BYC%').execute()
if byc.data:
    for company in byc.data:
        print(f"종목코드: {company.get('code')}")
        print(f"기업명: {company.get('name_kr')}")
        print(f"시장: {company.get('market')}")
        print(f"업종: {company.get('sector')}")
        print(f"업데이트: {company.get('updated_at')}")
        print()
else:
    print("BYC를 찾을 수 없습니다.")

# "기타"로 분류된 기업 목록 (상위 20개)
if gita_sectors:
    print("=" * 80)
    print("📌 '기타'로 분류된 기업 목록 (상위 20개)")
    print("=" * 80)
    for i, company in enumerate(gita_sectors[:20], 1):
        print(f"{i:2d}. {company.get('code'):6s} | {company.get('name_kr'):20s} | {company.get('market')}")

# Sector가 NULL인 기업 목록 (상위 20개)
if null_sectors:
    print("\n" + "=" * 80)
    print("📌 Sector가 NULL인 기업 목록 (상위 20개)")
    print("=" * 80)
    for i, company in enumerate(null_sectors[:20], 1):
        print(f"{i:2d}. {company.get('code'):6s} | {company.get('name_kr'):20s} | {company.get('market')}")

print("\n" + "=" * 80)
print("분석 완료")
print("=" * 80)
