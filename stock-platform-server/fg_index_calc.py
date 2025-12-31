from pykrx import stock
import pandas as pd
from datetime import datetime, timedelta

def update_fear_greed_idx():
    print("--- Calculating Daily K-Market Fear & Greed Index ---")
    try:
        today = datetime.now().strftime("%Y%m%d")
        prev_125 = (datetime.now() - timedelta(days=180)).strftime("%Y%m%d")

        # 1. 시장 모멘텀 (KOSPI vs 125일 이평선)
        df_kospi = stock.get_index_ohlcv_by_date(prev_125, today, "1001")
        current_kospi = df_kospi['종가'].iloc[-1]
        ma125 = df_kospi['종가'].rolling(window=125).mean().iloc[-1]
        momentum_score = 50 + ((current_kospi - ma125) / ma125 * 100)

        # 2. VKOSPI (변동성 지수) - 낮을수록 탐욕, 높을수록 공포
        # 20을 기준으로 점수화 (임의 기준)
        vkospi_df = stock.get_index_ohlcv_by_date(today, today, "1001") # 실제 VKOSPI 코드로 수정 필요
        vkospi = 18.5 # 예시 수치
        volatility_score = 100 - (vkospi * 2) 

        # 3. ADR (상승종목/하락종목 비율)
        # 최근 20일간의 상승/하락 종목 수 데이터를 활용

        # 4. 최종 점수 합산 (가중치 적용)
        final_score = int((momentum_score * 0.6) + (volatility_score * 0.4))
        final_score = max(0, min(100, final_score)) # 0~100 사이로 고정

        # 5. DB 저장
        supabase.table("market_indices").upsert({
            "name": "FEAR_GREED",
            "current_val": str(final_score),
            "updated_at": datetime.now().isoformat()
        }, on_conflict="name").execute()
        
        print(f"✅ F&G Score Calculated: {final_score}")
        
    except Exception as e:
        print(f"❌ F&G Calculation Error: {e}")