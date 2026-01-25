"""
Industry Classifier for K-Market Insight
==========================================

공공데이터 기반 한국 주식 종목 업종 분류 파이프라인

주요 기능:
- 종목코드 → 기업코드 매핑 (DART)
- DART 기업개황 API를 통한 KSIC 코드 추출
- KSIC 중분류 기반 상위 업종 자동 분류
"""

__version__ = "1.0.0"
__author__ = "K-Market Insight Team"

from .pipeline import classify_stock_industry, batch_classify_stocks, IndustryClassifier
from .dart_api import DARTClient
from .ksic_mapper import KSICMapper
from .rule_table import KSIC_TOP_INDUSTRY_RULES

__all__ = [
    'classify_stock_industry',
    'batch_classify_stocks',
    'IndustryClassifier',
    'DARTClient',
    'KSICMapper',
    'KSIC_TOP_INDUSTRY_RULES',
]
