import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime

# .env 로드 (로컬 테스트용)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def get_recent_disclosures():
    # GitHub Secrets에서 키 가져오기
    api_key = os.environ.get("DART_API_KEY")
    url = "https://opendart.fss.or.kr/api/list.json"
    
    # 파라미터 설정 (오늘 날짜 기준으로 검색 가능)
    params = {
        'crtfc_key': api_key,
        'bgn_de': '20231218', # 시작일 (예시: 오늘 날짜로 변경 가능)
        'pcorp_cls': 'Y',      # 유가증권시장(KOSPI)
        'page_count': '100'
    }

    response = requests.get(url, params=params)
    data = response.json()

    if data.get('status') == '000': # 정상 호출
        disclosures = data.get('list')
        print(f"총 {len(disclosures)}건의 공시를 발견했어!")
        
        # 우리가 관심 있는 키워드들
        targets = ["주식소각", "유형자산", "배당", "공급계약"]
        
        for d in disclosures:
            for target in targets:
                if target in d['report_nm']:
                    print(f"🚨 [발견!] {d['corp_name']}: {d['report_nm']}")
                    print(f"🔗 링크: https://dart.fss.or.kr/dsaf001/main.do?rcpNo={d['rcept_no']}")
    else:
        print(f"에러 발생: {data.get('message')}")

if __name__ == "__main__":
    get_recent_disclosures()
def get_stock_info(ticker, name):
    url = f"https://finance.naver.com/item/main.naver?code={ticker}"
    res = requests.get(url)
    soup = BeautifulSoup(res.text, 'html.parser')
    
    try:
        price = soup.select_one(".no_today .blind").text.replace(",", "")
        change_text = soup.select_one(".no_exday .blind").text.strip()
        direction = soup.select_one(".no_exday .ico")
        is_up = "상승" in direction.text if direction else True
        
        return {
            "ticker": ticker,
            "name": name,
            "current_price": int(price),
            "change_amount": int(change_text.replace(",", "")),
            "change_rate": ("+" if is_up else "-") + "1.5%", # 필요시 계산식 추가
            "chart_data": [
                {"time": "현재", "price": int(price)}
            ]
        }
    except Exception as e:
        print(f"{name} 크롤링 실패: {e}")
        return None

def run_update():
    if not SUPABASE_KEY:
        print("에러: API Key가 없습니다.")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 업데이트할 종목들
    TICKERS = {"005930": "삼성전자", "086520": "에코프로"}
    
    print(f"[{datetime.now()}] 업데이트 시작...")
    for ticker, name in TICKERS.items():
        data = get_stock_info(ticker, name)
        if data:
            supabase.table("stock_details").upsert(data, on_conflict="ticker").execute()
            print(f"{name} 완료")

if __name__ == "__main__":
    run_update() # 한 번만 실행하고 종료