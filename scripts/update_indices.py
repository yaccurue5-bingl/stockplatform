import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from datetime import datetime

# 환경 변수 설정
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# scripts/update_indices.py 수정본
def get_market_indices():
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    try:
        res = requests.get("https://finance.naver.com/", headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 더 포괄적인 셀렉터 사용
        targets = [
            {"id": "KOSPI", "selector": "#KOSPI_now, .num_area .num"},
            {"id": "KOSDAQ", "selector": "#KOSDAQ_now, .box_quot.quot_kosdaq .num"}
        ]
        
        payload = []
        for item in targets:
            element = soup.select_one(item['selector'])
            if element:
                price = element.text.replace(',', '').strip()
                # ... 이하 생략 (동일)            
            # 2순위: ID가 실패할 경우 클래스 구조로 찾기
            if not price_el:
                # 네이버 금융 페이지 내의 대체 경로 (예: .num_area .num)
                area = soup.find("a", string=lambda x: x and item['label'] in x)
                if area:
                    parent = area.find_parent("div")
                    price_el = parent.select_one(".num")
                    rate_el = parent.select_one(".rate")

            if price_el:
                price = price_el.text.replace(',', '').strip()
                # 등락률에서 %, 공백, 화살표 제거
                rate_text = rate_el.text.strip().replace('%', '').replace('상승', '').replace('하락', '')
                
                payload.append({
                    "symbol": item['id'],
                    "name": item['id'],
                    "price": price,
                    "change_rate": float(rate_text),
                    "updated_at": datetime.now().isoformat()
                })
                print(f"✅ {item['id']} 수집 성공: {price} ({rate_text}%)")
            else:
                print(f"⚠️ {item['id']} 데이터를 찾을 수 없습니다.")

        if payload:
            supabase.table("market_indices").upsert(payload, on_conflict="symbol").execute()
            print("✨ Supabase 업데이트 완료")
            
    except Exception as e:
        print(f"🚨 지수 수집 에러 발생: {e}")

if __name__ == "__main__":
    get_market_indices()