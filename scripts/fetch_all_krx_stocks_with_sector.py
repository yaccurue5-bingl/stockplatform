#!/usr/bin/env python3
"""
KRX 전체 종목 정보 수집 (업종 포함)
- KOSPI, KOSDAQ 모든 종목 (2000+ 종목)
- 업종 정보 포함
- Supabase companies 테이블에 자동 저장
"""

import requests
import os
import io
from datetime import datetime
from supabase import create_client
import time
from dotenv import load_dotenv
from pathlib import Path

# 1. 환경 변수 로드 (.env.local 경로 자동 인식)
# 현재 스크립트(scripts/...)의 부모 폴더인 프로젝트 루트에서 .env.local을 찾습니다.
base_path = Path(__file__).resolve().parent.parent
env_path = base_path / '.env.local'

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"✅ 환경 변수 로드 완료: {env_path}")
else:
    load_dotenv()
    print("⚠️ 기본 경로에서 환경 변수 로드 시도")

# 2. Supabase 설정 (지침에 따라 NEXT_PUBLIC 및 SERVICE_ROLE_KEY 적용)
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"❌ Supabase 환경 변수 누락 (URL: {SUPABASE_URL}, KEY 존재여부: {'O' if SUPABASE_KEY else 'X'})")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_krx_stock_list():
    """KRX에서 전체 상장 종목 리스트 가져오기 (OTP 방식)"""
    print("\n📊 KRX API를 통해 전체 종목 정보 수집 중...")
    today = datetime.now().strftime('%Y%m%d')
    all_stocks = []

    for market_code, market_name in [('STK', 'KOSPI'), ('KSQ', 'KOSDAQ')]:
        print(f"\n🔍 {market_name} 종목 조회 중...")
        otp_url = "http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd"
        otp_params = {
            'mktId': market_code,
            'trdDd': today,
            'money': '1',
            'csvxls_isNo': 'false',
            'name': 'fileDown',
            'url': 'dbms/MDC/STAT/standard/MDCSTAT01901'
        }

        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader'
            }
            otp_response = requests.post(otp_url, params=otp_params, headers=headers, timeout=10)
            otp_code = otp_response.text.strip()

            if not otp_code: continue

            download_url = "http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd"
            download_response = requests.post(download_url, data={'code': otp_code}, headers=headers, timeout=30)
            csv_data = download_response.content.decode('euc-kr')
            lines = csv_data.strip().split('\n')

            if len(lines) < 2: continue

            for line in lines[1:]:
                fields = line.split(',')
                try:
                    stock = {
                        'code': fields[0].strip().replace('"', ''),
                        'name': fields[1].strip().replace('"', ''),
                        'market': market_name,
                        'sector': fields[2].strip().replace('"', '') if len(fields) > 2 else '기타',
                        'market_cap': int(fields[6].strip().replace('"', '').replace(',', '')) if len(fields) > 6 and fields[6].strip().replace('"', '').replace(',', '').isdigit() else 0,
                        'listed_shares': int(fields[7].strip().replace('"', '').replace(',', '')) if len(fields) > 7 and fields[7].strip().replace('"', '').replace(',', '').isdigit() else 0,
                    }
                    if stock['code']: all_stocks.append(stock)
                except: continue
            time.sleep(1)
        except Exception as e:
            print(f"   ❌ {market_name} 조회 실패: {e}")
    return all_stocks

def transform_to_db_format(stocks):
    """DB 형식으로 변환 (지침 준수: corp_name, sector)"""
    companies = []
    for stock in stocks:
        try:
            companies.append({
                'code': stock['code'],
                'stock_code': stock['code'], 
                'corp_name': stock['name'],     # name_kr -> corp_name으로 수정 [cite: 2026-01-22]
                'market': stock['market'],
                'sector': stock.get('sector', '기타'), # industry 대신 sector 사용 [cite: 2026-01-22]
                'market_cap': stock.get('market_cap', 0),
                'listed_shares': stock.get('listed_shares', 0),
                'updated_at': datetime.now().isoformat()
            })
        except Exception as e:
            continue
    return companies

def save_to_supabase(companies):
    """Supabase에 저장 (Upsert)"""
    print(f"\n💾 Supabase 저장 중 ({len(companies)}개)...\n")
    batch_size = 100
    success, failed = 0, 0

    for i in range(0, len(companies), batch_size):
        batch = companies[i:i+batch_size]
        try:
            supabase.table("companies").upsert(batch, on_conflict="code").execute()
            success += len(batch)
            print(f"   ✅ Batch {(i//batch_size)+1} 저장 완료")
            time.sleep(0.3)
        except Exception as e:
            failed += len(batch)
            print(f"   ❌ Batch {(i//batch_size)+1} 실패: {e}")
    return success, failed

def run():
    """메인 실행"""
    stocks = fetch_krx_stock_list()
    if not stocks: return False
    
    companies = transform_to_db_format(stocks)
    success, failed = save_to_supabase(companies)
    
    print(f"\n🎉 최종 완료: 성공 {success}개, 실패 {failed}개")
    return success > 0

if __name__ == "__main__":
    success = run()
    exit(0 if success else 1)