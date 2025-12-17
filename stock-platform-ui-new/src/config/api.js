import { supabase } from '../supabaseClient';

// 1. 기존 백엔드(Cloud Run 등) 호출용 (유지)
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.bingl.net';

export const fetchAPI = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// 2. Supabase 전용 호출 함수 (추가)
export const fetchFromSupabase = async (tableName) => {
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) throw error;
  return data;
};

export const API_ENDPOINTS = {
  MARKET_LIVE: 'market_live',
  STOCK_DETAILS: 'stock_details'
};