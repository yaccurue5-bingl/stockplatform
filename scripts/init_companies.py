import os
import requests
import time
from supabase import create_client, Client
from datetime import datetime

# 환경 변수 로드
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def run():
    print("🏢 Daum 금융 API 기반 기업 정보 수집 시작 (공시 데이터 커플링)...")
    
    # 1. 최근 공시가 올라온 종목 코드들 가져오기
    try:
        res = supabase.table("disclosure_insights").select("stock_code").execute()
        # 중복 제거 및 유효한 코드 필터링
        stock_codes = list(set([item['stock_code'] for item in res.data if item.get('stock_code')]))
        
        if not stock_codes:
            print("⚠️ 분석할 공시 종목 코드가 DB에 없습니다.")
            return
            
        print(f"🔗 총 {len(stock_codes)}개의 종목 정보를 업데이트합니다.")
    except Exception as e:
        print(f"🚨 DB 조회 에러: {e}")
        return

    # 2. 다음 금융 API 호출을 위한 브라우저 헤더 설정 (차단 방지 핵심)
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://finance.daum.net/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
    }

    all_companies = []
    
    # 다음 금융은 종목코드 앞에 'A'를 붙여야 함 (예: A005930)
    for code in stock_codes:
        try:
            api_url = f"https://finance.daum.net/api/quotes/A{code}"
            
            # API 호출
            response = requests.get(api_url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # 'tradePrice'나 'marketCap'이 없는 경우(상장폐지 등) 대비
                if data and 'name' in data:
                    all_companies.append({
                        "stock_code": code,
                        "corp_name": data.get('name'),
                        "market_cap": int(data.get('marketCap', 0)),
                        "updated_at": datetime.now().isoformat()
                    })
                    print(f"✅ [{data.get('name')}] 데이터 수집 완료")
                else:
                    print(f"⚠️ {code}: 유효한 종목 정보를 응답받지 못했습니다.")
            else:
                print(f"❌ {code}: HTTP {response.status_code} 에러")
            
            # 다음 서버 부하 방지 및 차단 회피를 위한 짧은 대기
            time.sleep(0.3)
            
        except Exception as e:
            print(f"🚨 {code} 처리 중 오류 발생: {e}")
            continue

    # 3. Supabase Upsert 실행
    if all_companies:
        try:
            supabase.table("companies").upsert(all_companies, on_conflict="stock_code").execute()
            print(f"🎉 성공적으로 {len(all_companies)}개 기업 정보를 DB에 저장했습니다.")
        except Exception as e:
            print(f"🚨 DB 저장 에러: {e}")
    else:
        print("⚠️ 수집된 데이터가 없어 업데이트를 진행하지 않습니다.")

if __name__ == "__main__":
    run()