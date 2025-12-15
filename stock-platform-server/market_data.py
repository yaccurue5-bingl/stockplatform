# stock-platform-server/market_data.py

import requests
from bs4 import BeautifulSoup
import re
import logging
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MarketDataScraper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def get_kospi_kosdaq(self) -> Dict[str, Any]:
        """
        네이버 금융에서 KOSPI, KOSDAQ 지수 가져오기
        """
        try:
            url = "https://finance.naver.com/sise/"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # KOSPI 데이터
            kospi_now = soup.select_one('#KOSPI_now')
            kospi_change = soup.select_one('#KOSPI_change')
            kospi_rate = soup.select_one('#KOSPI_rate')
            
            # KOSDAQ 데이터
            kosdaq_now = soup.select_one('#KOSDAQ_now')
            kosdaq_change = soup.select_one('#KOSDAQ_change')
            kosdaq_rate = soup.select_one('#KOSDAQ_rate')
            
            # 상승/하락 판단
            kospi_status = 'up' if kospi_change and 'up' in kospi_change.get('class', []) else 'down'
            kosdaq_status = 'up' if kosdaq_change and 'up' in kosdaq_change.get('class', []) else 'down'
            
            return {
                "kospi": {
                    "value": kospi_now.text.strip() if kospi_now else "N/A",
                    "change": kospi_change.text.strip() if kospi_change else "0",
                    "rate": kospi_rate.text.strip() if kospi_rate else "0%",
                    "status": kospi_status
                },
                "kosdaq": {
                    "value": kosdaq_now.text.strip() if kosdaq_now else "N/A",
                    "change": kosdaq_change.text.strip() if kosdaq_change else "0",
                    "rate": kosdaq_rate.text.strip() if kosdaq_rate else "0%",
                    "status": kosdaq_status
                }
            }
            
        except Exception as e:
            logger.error(f"KOSPI/KOSDAQ scraping error: {e}")
            return {
                "kospi": {"value": "N/A", "change": "0", "rate": "0%", "status": "neutral"},
                "kosdaq": {"value": "N/A", "change": "0", "rate": "0%", "status": "neutral"}
            }
    
    def get_exchange_rate(self) -> Dict[str, Any]:
        """
        USD/KRW 환율 가져오기
        """
        try:
            url = "https://finance.naver.com/marketindex/"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # USD/KRW 환율
            usd_krw = soup.select_one('.head_info .value')
            change = soup.select_one('.head_info .change')
            
            if usd_krw:
                value = usd_krw.text.strip()
                change_text = change.text.strip() if change else "0"
                
                # 상승/하락 판단
                status = 'up' if change and 'up' in change.get('class', []) else 'down'
                
                return {
                    "usd_krw": {
                        "value": value,
                        "change": change_text,
                        "status": status
                    }
                }
            
            return {"usd_krw": {"value": "N/A", "change": "0", "status": "neutral"}}
            
        except Exception as e:
            logger.error(f"Exchange rate scraping error: {e}")
            return {"usd_krw": {"value": "N/A", "change": "0", "status": "neutral"}}
    
    def get_stock_price(self, ticker: str) -> Dict[str, Any]:
        """
        개별 종목 현재가 가져오기
        """
        try:
            url = f"https://finance.naver.com/item/main.naver?code={ticker}"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 현재가
            price_element = soup.select_one('.no_today .blind')
            # 전일대비
            change_element = soup.select_one('.no_exday .blind')
            # 등락률
            rate_element = soup.select_one('.no_exday em span')
            
            # 상승/하락 판단
            status_element = soup.select_one('.no_exday')
            status = 'up' if status_element and 'up' in status_element.get('class', []) else 'down'
            
            if price_element:
                price = price_element.text.strip()
                change = change_element.text.strip() if change_element else "0"
                rate = rate_element.text.strip() if rate_element else "0%"
                
                return {
                    "ticker": ticker,
                    "price": price,
                    "change": change,
                    "rate": rate,
                    "status": status
                }
            
            return {
                "ticker": ticker,
                "price": "N/A",
                "change": "0",
                "rate": "0%",
                "status": "neutral"
            }
            
        except Exception as e:
            logger.error(f"Stock price scraping error for {ticker}: {e}")
            return {
                "ticker": ticker,
                "price": "N/A",
                "change": "0",
                "rate": "0%",
                "status": "neutral"
            }
    
    def get_multiple_stocks(self, tickers: List[str]) -> List[Dict[str, Any]]:
        """
        여러 종목의 가격을 한 번에 가져오기
        """
        results = []
        for ticker in tickers:
            results.append(self.get_stock_price(ticker))
        return results
    
    def get_all_market_data(self, stock_tickers: List[str] = None) -> Dict[str, Any]:
        """
        모든 시장 데이터를 한 번에 가져오기
        """
        logger.info("Fetching all market data...")
        
        indices = self.get_kospi_kosdaq()
        exchange = self.get_exchange_rate()
        
        result = {
            "indices": indices,
            "exchange": exchange,
            "stocks": []
        }
        
        if stock_tickers:
            result["stocks"] = self.get_multiple_stocks(stock_tickers)
        
        logger.info("Market data fetching completed.")
        return result