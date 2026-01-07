import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from datetime import datetime

# 환경 변수 설정
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_market_indices():
    print("🚀 네이버 금융 기반 지수 수집 시작 (최신 셀렉터 적용)...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://finance.naver.com/'
    }
    
    try:
        # 지수 정보가 가장 정확하게 노출되는 국내증시 메인 페이지
        res = requests.get("https://finance.naver.com/sise/", headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 참고용 파일의 ID 방식(#KOSPI_now)이 안될 경우를 대비한 다중 경로 설정
        targets = [
            {"id": "KOSPI", "label": "코스피"},
            {"id": "KOSDAQ", "label": "코스닥"}
        ]
        
        payload = []
        for item in targets:
            # 1순위: ID로 찾기 (#KOSPI_now)
            price_el = soup.select_one(f"#{item['id']}_now")
            rate_el = soup.select_one(f"#{item['id']}_rate")
            
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