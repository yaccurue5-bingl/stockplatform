// API 기본 URL 설정
const getApiBaseUrl = () => {
  // 개발 환경
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8000';
  }
  
  // 프로덕션 환경 (Firebase Hosting)
  // 백엔드를 배포할 URL로 변경하세요
  return process.env.REACT_APP_API_URL || 'https://api.bingl.net';
};

export const API_BASE_URL = getApiBaseUrl();

// API 엔드포인트
export const API_ENDPOINTS = {
  MARKET_LIVE: '/api/market/live',
  STOCK_PRICE: '/api/stock/price',
  STOCK_DETAILS: '/api/stock/details',
  FULL_ANALYSIS: '/api/run_full_analysis'
};

// API 호출 헬퍼 함수
export const fetchAPI = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};