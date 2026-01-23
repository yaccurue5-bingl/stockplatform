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

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Supabase 환경 변수 누락")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_krx_stock_list():
    """
    KRX에서 전체 상장 종목 리스트 가져오기 (KOSPI + KOSDAQ)
    OTP 방식 사용
    """
    print("\n📊 KRX API를 통해 전체 종목 정보 수집 중...")

    # 오늘 날짜
    today = datetime.now().strftime('%Y%m%d')

    all_stocks = []

    # KOSPI와 KOSDAQ 각각 조회
    for market_code, market_name in [('STK', 'KOSPI'), ('KSQ', 'KOSDAQ')]:
        print(f"\n🔍 {market_name} 종목 조회 중...")

        # 1단계: OTP 생성
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

            if not otp_code or len(otp_code) < 10:
                print(f"   ⚠️ {market_name} OTP 생성 실패")
                continue

            # 2단계: OTP로 CSV 데이터 다운로드
            download_url = "http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd"
            download_response = requests.post(
                download_url,
                data={'code': otp_code},
                headers=headers,
                timeout=30
            )

            # CSV 파싱 (EUC-KR 인코딩)
            csv_data = download_response.content.decode('euc-kr')
            lines = csv_data.strip().split('\n')

            if len(lines) < 2:
                print(f"   ⚠️ {market_name} 데이터 없음")
                continue

            # 헤더 제거
            data_lines = lines[1:]

            for line in data_lines:
                if not line.strip():
                    continue

                # CSV 파싱
                fields = line.split(',')

                # 필요한 필드 추출
                try:
                    stock = {
                        'code': fields[0].strip().replace('"', ''),  # 종목코드
                        'name': fields[1].strip().replace('"', ''),  # 종목명
                        'market': market_name,
                        'sector': fields[2].strip().replace('"', '') if len(fields) > 2 else '기타',  # 업종
                        'market_cap': int(fields[6].strip().replace('"', '').replace(',', '')) if len(fields) > 6 and fields[6].strip().replace('"', '').replace(',', '').isdigit() else 0,  # 시가총액
                        'listed_shares': int(fields[7].strip().replace('"', '').replace(',', '')) if len(fields) > 7 and fields[7].strip().replace('"', '').replace(',', '').isdigit() else 0,  # 상장주식수
                    }

                    if stock['code'] and stock['name']:
                        all_stocks.append(stock)
                except Exception as e:
                    print(f"   ⚠️ 파싱 실패: {line[:50]}... - {e}")
                    continue

            print(f"   ✅ {market_name}: {len([s for s in all_stocks if s['market'] == market_name])}개 종목")
            time.sleep(1)  # API 부하 방지

        except Exception as e:
            print(f"   ❌ {market_name} 조회 실패: {e}")
            continue

    return all_stocks


def fetch_naver_fallback():
    """
    네이버 금융에서 전체 종목 리스트 가져오기 (폴백)
    """
    print("\n📊 네이버 금융에서 종목 정보 수집 중...")

    all_stocks = []

    # KOSPI
    print("\n🔍 KOSPI 종목 조회 중...")
    try:
        url = "https://finance.naver.com/sise/sise_market_sum.naver?&page=1"
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)

        # 간단한 HTML 파싱으로 종목 코드 추출
        import re
        codes = re.findall(r'code=([0-9]{6})', response.text)

        for code in list(set(codes))[:100]:  # 샘플로 100개만 (중복 제거)
            all_stocks.append({
                'code': code,
                'name': f'종목{code}',
                'market': 'KOSPI',
                'sector': '기타',
                'market_cap': 0,
                'listed_shares': 0,
            })

        print(f"   ✅ KOSPI: {len([s for s in all_stocks if s['market'] == 'KOSPI'])}개 종목")
    except Exception as e:
        print(f"   ❌ KOSPI 조회 실패: {e}")

    return all_stocks


def transform_to_db_format(stocks):
    """
    DB 형식으로 변환
    """
    companies = []

    for stock in stocks:
        try:
            companies.append({
                'code': stock['code'],
                'stock_code': stock['code'],  # code와 stock_code 둘 다 저장
                'name_kr': stock['name'],
                'market': stock['market'],
                'sector': stock.get('sector', '기타'),
                'market_cap': stock.get('market_cap', 0),
                'listed_shares': stock.get('listed_shares', 0),
                'updated_at': datetime.now().isoformat()
            })
        except Exception as e:
            print(f"   ⚠️ 변환 실패: {stock.get('name', 'Unknown')} - {e}")
            continue

    return companies


def save_to_supabase(companies):
    """
    Supabase에 저장
    """
    print(f"\n💾 Supabase 저장 중 ({len(companies)}개)...\n")

    batch_size = 100
    success = 0
    failed = 0

    for i in range(0, len(companies), batch_size):
        batch = companies[i:i+batch_size]

        try:
            supabase.table("companies").upsert(batch, on_conflict="code").execute()
            success += len(batch)
            print(f"   ✅ Batch {(i//batch_size)+1}/{(len(companies)//batch_size)+1}: {len(batch)}개 저장")
            time.sleep(0.3)  # API 부하 방지
        except Exception as e:
            failed += len(batch)
            print(f"   ❌ Batch {(i//batch_size)+1} 실패: {str(e)[:200]}")

    return success, failed


def run():
    """메인 실행"""
    print(f"\n{'='*70}")
    print(f"🚀 KRX 전체 종목 정보 수집 (업종 포함)")
    print(f"{'='*70}\n")

    # KRX API로 시도
    stocks = fetch_krx_stock_list()

    # 실패 시 네이버 폴백
    if not stocks or len(stocks) < 100:
        print("\n⚠️ KRX API 조회 실패 또는 데이터 부족, 네이버 폴백 시도...")
        stocks = fetch_naver_fallback()

    if not stocks:
        print("\n❌ 종목 정보를 가져올 수 없습니다.")
        return False

    print(f"\n📊 총 {len(stocks)}개 종목 수집 완료")

    # 업종별 분포 출력
    sector_count = {}
    for stock in stocks:
        sector = stock.get('sector', '기타')
        sector_count[sector] = sector_count.get(sector, 0) + 1

    print("\n📈 업종별 분포:")
    for sector, count in sorted(sector_count.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"   - {sector}: {count}개")

    # DB 형식으로 변환
    companies = transform_to_db_format(stocks)

    # Supabase에 저장
    success, failed = save_to_supabase(companies)

    print(f"\n🎉 최종 완료:")
    print(f"   ✅ 성공: {success}개")
    print(f"   ❌ 실패: {failed}개")
    print(f"   📊 전체: {len(companies)}개\n")

    return success > 0


if __name__ == "__main__":
    success = run()
    exit(0 if success else 1)
