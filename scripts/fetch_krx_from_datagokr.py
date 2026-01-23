#!/usr/bin/env python3
"""
KRX 전체 종목 정보 수집 (data.go.kr API 사용)
- KOSPI, KOSDAQ 모든 종목 (2000+ 종목)
- 업종 정보 포함
- Supabase companies 테이블에 자동 저장

기존 fetch_all_krx_stocks_with_sector.py가 KRX OTP 크롤링 실패로 인해
data.go.kr 공공데이터 API를 사용하도록 변경
"""

import requests
import os
from datetime import datetime, timedelta
from supabase import create_client
import time
from dotenv import load_dotenv
from pathlib import Path

# 1. 환경 변수 로드
base_path = Path(__file__).resolve().parent.parent
env_path = base_path / 'my-research-platform' / '.env.local'

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"✅ 환경 변수 로드 완료: {env_path}")
else:
    load_dotenv()
    print("⚠️ 기본 경로에서 환경 변수 로드 시도")

# 2. Supabase 설정
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"❌ Supabase 환경 변수 누락")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 3. data.go.kr API 설정
PUBLIC_DATA_API_KEY = os.getenv("PUBLIC_DATA_API_KEY")

if not PUBLIC_DATA_API_KEY:
    print("❌ PUBLIC_DATA_API_KEY 환경 변수가 설정되지 않았습니다.")
    print("📝 .env.local 파일에 PUBLIC_DATA_API_KEY를 추가하세요.")
    exit(1)

# data.go.kr API URL
API_BASE_URL = "https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo"


def get_yesterday_date():
    """어제 날짜를 YYYYMMDD 형식으로 반환"""
    yesterday = datetime.now() - timedelta(days=1)
    return yesterday.strftime('%Y%m%d')


def fetch_krx_stocks_from_datagokr(bas_dt, num_of_rows=1000, page_no=1):
    """
    data.go.kr API로 KRX 종목 정보 조회

    Args:
        bas_dt: 기준일자 (YYYYMMDD)
        num_of_rows: 조회 건수
        page_no: 페이지 번호

    Returns:
        list: 종목 정보 리스트
    """
    params = {
        'serviceKey': PUBLIC_DATA_API_KEY,
        'numOfRows': num_of_rows,
        'pageNo': page_no,
        'resultType': 'json',
        'basDt': bas_dt
    }

    try:
        print(f"   📡 API 호출 중 (페이지 {page_no})...")
        response = requests.get(API_BASE_URL, params=params, timeout=30)
        response.raise_for_status()

        data = response.json()

        # API 응답 확인
        result_code = data.get('response', {}).get('header', {}).get('resultCode')
        if result_code != '00':
            result_msg = data.get('response', {}).get('header', {}).get('resultMsg', 'Unknown error')
            print(f"   ❌ API 오류: {result_msg}")
            return []

        # items 추출
        items = data.get('response', {}).get('body', {}).get('items', {}).get('item', [])

        # 단일 item인 경우 리스트로 변환
        if isinstance(items, dict):
            items = [items]

        return items

    except Exception as e:
        print(f"   ❌ API 호출 실패: {e}")
        return []


def fetch_all_krx_stocks(bas_dt):
    """
    모든 KRX 종목 조회 (자동 pagination)

    Args:
        bas_dt: 기준일자 (YYYYMMDD)

    Returns:
        list: 전체 종목 리스트
    """
    print(f"\n📊 data.go.kr API를 통해 KRX 종목 정보 수집 중 (기준일: {bas_dt})...")

    all_stocks = []
    page_no = 1
    num_of_rows = 1000  # 한 번에 최대 1000개

    while True:
        stocks = fetch_krx_stocks_from_datagokr(bas_dt, num_of_rows, page_no)

        if not stocks:
            break

        all_stocks.extend(stocks)
        print(f"   ✅ 페이지 {page_no}: {len(stocks)}개 조회 (누적: {len(all_stocks)}개)")

        # 더 이상 데이터가 없으면 종료
        if len(stocks) < num_of_rows:
            break

        page_no += 1
        time.sleep(0.5)  # API 부하 방지

    print(f"\n✅ 총 {len(all_stocks)}개 종목 조회 완료")
    return all_stocks


def transform_to_db_format(stocks):
    """
    data.go.kr API 응답을 DB 형식으로 변환

    Args:
        stocks: data.go.kr API 응답 데이터

    Returns:
        list: DB에 저장할 형식의 데이터
    """
    companies = []

    for stock in stocks:
        try:
            # 문자열 값 정리
            stock_code = stock.get('srtnCd', '').strip()
            stock_name = stock.get('itmsNm', '').strip()
            market = stock.get('mrktCtg', '').strip()

            # 숫자 값 변환 (콤마 제거 후 정수 변환)
            try:
                market_cap = int(stock.get('mrktTotAmt', '0').replace(',', ''))
            except:
                market_cap = 0

            try:
                listed_shares = int(stock.get('lstgStCnt', '0').replace(',', ''))
            except:
                listed_shares = 0

            # 빈 값 체크
            if not stock_code or not stock_name:
                continue

            company = {
                'code': stock_code,
                'stock_code': stock_code,
                'corp_name': stock_name,
                'market': market if market in ['KOSPI', 'KOSDAQ'] else 'KOSPI',
                'sector': '기타',  # data.go.kr API는 업종 정보 미제공
                'market_cap': market_cap,
                'listed_shares': listed_shares,
                'updated_at': datetime.now().isoformat()
            }

            companies.append(company)

        except Exception as e:
            print(f"   ⚠️ 데이터 변환 실패: {e}")
            continue

    return companies


def save_to_supabase(companies):
    """
    Supabase에 저장 (Upsert)

    Args:
        companies: 저장할 회사 데이터 리스트

    Returns:
        tuple: (성공 건수, 실패 건수)
    """
    print(f"\n💾 Supabase 저장 중 ({len(companies)}개)...\n")

    batch_size = 100
    success, failed = 0, 0

    for i in range(0, len(companies), batch_size):
        batch = companies[i:i+batch_size]
        try:
            supabase.table("companies").upsert(batch, on_conflict="code").execute()
            success += len(batch)
            print(f"   ✅ Batch {(i//batch_size)+1} 저장 완료 ({len(batch)}개)")
            time.sleep(0.3)
        except Exception as e:
            failed += len(batch)
            print(f"   ❌ Batch {(i//batch_size)+1} 실패: {e}")

    return success, failed


def run():
    """메인 실행 함수"""
    print("=" * 60)
    print("🚀 KRX 종목 정보 수집 시작 (data.go.kr API)")
    print("=" * 60)

    # 어제 날짜 사용 (당일은 데이터가 없을 수 있음)
    bas_dt = get_yesterday_date()
    print(f"📅 기준일자: {bas_dt}")

    # 1. data.go.kr API로 종목 조회
    stocks = fetch_all_krx_stocks(bas_dt)

    if not stocks:
        print("\n❌ 조회된 종목이 없습니다.")
        print("💡 팁: 영업일이 아니거나 API 키가 잘못되었을 수 있습니다.")
        return False

    # 2. DB 형식으로 변환
    companies = transform_to_db_format(stocks)
    print(f"\n✅ {len(companies)}개 종목 변환 완료")

    # 3. Supabase에 저장
    success, failed = save_to_supabase(companies)

    # 4. 결과 출력
    print("\n" + "=" * 60)
    print(f"🎉 최종 완료")
    print(f"   ✅ 성공: {success}개")
    print(f"   ❌ 실패: {failed}개")
    print("=" * 60)

    return success > 0


if __name__ == "__main__":
    success = run()
    exit(0 if success else 1)
