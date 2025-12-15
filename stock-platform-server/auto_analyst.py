# stock-platform-server/auto_analyst.py

import os
import requests
import json
import time
from bs4 import BeautifulSoup
from openai import OpenAI
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
# Python 표준 logging 모듈 추가
import logging 

# 로깅 설정: FastAPI 서버 터미널에 로그 레벨 DEBUG 이상을 출력하도록 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==========================================
# 1. 설정 (Configuration)
# ==========================================
API_KEY = "gen-lang-client-0124517097" # 실제 키로 교체 필요
try:
    client = OpenAI(api_key=API_KEY)
    logger.info("OpenAI client initialized successfully.")
except Exception as e:
    logger.error(f"OpenAI client initialization error: {e}. Check API key.")
    client = None

# ==========================================
# 2. AI 처리 모듈 (OpenAI Processor)
# ==========================================
class AIAnalyst:
    def __init__(self, client):
        self.client = client

    def analyze_news(self, title: str, content: str) -> Dict[str, Any] | None:
        """
        뉴스 기사를 분석하고 요약, 감성분석, 영문 번역을 수행하여 JSON으로 반환
        """
        if not self.client:
            logger.error("AI client not available, skipping analysis.")
            return {"error": "AI client not initialized."}

        prompt = f"""
        # Role
        You are a professional financial analyst for Global Investors investing in Korea.
        # Task
        Analyze the following Korean financial news.
        ... (Prompt 내용은 생략하고 그대로 유지) ...
        """

        try:
            logger.debug(f"Sending prompt to OpenAI. Title: {title[:50]}...")
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "system", "content": "You are a helpful financial assistant. Output JSON only."},
                          {"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            
            # 응답 내용을 로그에 출력 (디버깅 목적으로만 사용)
            logger.debug(f"OpenAI raw response received.") 
            
            result = json.loads(response.choices[0].message.content)
            logger.info("AI analysis succeeded.")
            return result
            
        except json.JSONDecodeError:
            logger.error("AI response failed to decode as JSON. Possible API internal error or invalid output.")
            return {"error": "Invalid JSON response from AI."}
        except Exception as e:
            logger.error(f"Critical Error during OpenAI API call: {e}", exc_info=True) # exc_info=True로 전체 스택 트레이스 출력
            return {"error": f"OpenAI API call failed: {e}"}

# ==========================================
# 3. 데이터 수집 모듈 (Scrapers)
# ==========================================
class MarketScraper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def get_naver_finance_news(self, stock_code: str) -> Dict[str, str] | None:
        """
        네이버 금융 특정 종목의 최신 뉴스 1개를 가져옴
        """
        url = f"https://finance.naver.com/item/news_news.naver?code={stock_code}"
        
        try:
            logger.info(f"Attempting to scrape news list for {stock_code} from {url}")
            resp = requests.get(url, headers=self.headers, timeout=10)
            resp.raise_for_status() 

            soup = BeautifulSoup(resp.text, 'html.parser')
            first_news = soup.select_one('.type5 tbody tr .title a')
            
            if not first_news:
                logger.warning(f"No recent news link found for {stock_code}.")
                return None
            
            article_url = "https://finance.naver.com" + first_news['href']
            title = first_news.text.strip()
            
            logger.info(f"Found article: {title[:20]}... Attempting content scrape.")
            article_resp = requests.get(article_url, headers=self.headers, timeout=10)
            article_resp.raise_for_status()
            
            article_soup = BeautifulSoup(article_resp.text, 'html.parser')
            content_element = article_soup.select_one('#news_read') or article_soup.select_one('.scr01')
            content = content_element.text.strip() if content_element else "Content extraction failed."
            
            logger.info(f"Content scrape success for {stock_code}.")
            return {
                "source": "Naver Finance",
                "original_url": article_url,
                "title_kr": title,
                "content_kr": content[:3000] 
            }
            
        except requests.exceptions.RequestException as req_err:
            logger.error(f"Scraping Request Error for {stock_code}. Status: {req_err.response.status_code if req_err.response else 'N/A'}", exc_info=True)
            return {"error": f"Request failed: {req_err}"}
        except Exception as e:
            logger.error(f"Scraping Parse/General Error for {stock_code}: {e}", exc_info=True)
            return {"error": f"Parsing failed: {e}"}


# ==========================================
# 4. API 호출용 메인 함수 (FastAPI에서 호출)
# ==========================================
def run_analysis_for_api(target_stocks: List[str]) -> List[Dict[str, Any]]:
    """
    FastAPI 요청에 따라 분석을 실행하고 결과를 리스트 형태로 반환
    """
    if not target_stocks:
        logger.warning("No target stocks provided for analysis.")
        return [{"error": "No target stocks provided."}]
        
    logger.info(f"--- API Analysis Request Started for {target_stocks} ---")
    
    scraper = MarketScraper()
    analyst = AIAnalyst(client)
    results = []

    for code in target_stocks:
        logger.info(f"--- Starting processing for Stock Code: {code} ---")
        
        final_record = {"stock_code": code, "scraped_at": str(datetime.now())}
        
        # 1. 크롤링 (Crawling)
        news_data = scraper.get_naver_finance_news(code)
        
        if news_data and "error" not in news_data:
            final_record["original_data"] = news_data
            
            # 2. AI 분석 (AI Processing)
            logger.info(f"Starting AI analysis for news title: {news_data['title_kr'][:30]}...")
            ai_result = analyst.analyze_news(news_data['title_kr'], news_data['content_kr'])
            
            if ai_result and "error" not in ai_result:
                final_record["ai_insight"] = ai_result
                logger.info(f"Analysis succeeded for {code}.")
            else:
                final_record["ai_insight"] = ai_result if ai_result else {"error": "AI Analysis Failed."}
                logger.error(f"Analysis failed for {code}. Reason: {final_record['ai_insight'].get('error', 'Unknown')}")
        else:
            final_record["original_data"] = news_data if news_data else {"error": "No news data or scraping failed."}
            final_record["ai_insight"] = {"error": "Skipping AI analysis due to scraping failure."}
            logger.warning(f"Skipping AI analysis for {code} due to scraping error.")
            
        results.append(final_record)
        time.sleep(1) 

    logger.info(f"--- API Analysis Request Finished ---")
    return results