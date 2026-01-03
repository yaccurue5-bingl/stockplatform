export interface DisclosureInsight {
  id: number;
  corp_name: string;
  stock_code: string;
  report_nm: string;
  ai_summary: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  rcept_no: string;
  created_at: string;
}
// types/database.ts에 추가
export interface Company {
  stock_code: string;
  corp_name: string;
  sector: string;
  market_cap: number;
  foreign_ownership: number;
  revenue: string;
  operating_profit_margin: number;
  updated_at: string;
}