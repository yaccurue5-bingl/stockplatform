/**
 * Supabase Database Types (Auto-generated)
 *
 * 생성 방법:
 * npx supabase gen types typescript --project-id your-project-id > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          plan: 'FREE' | 'PRO';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          plan?: 'FREE' | 'PRO';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          plan?: 'FREE' | 'PRO';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      companies: {
        Row: {
          code: string;
          name_kr: string;
          name_en: string | null;
          market: 'KOSPI' | 'KOSDAQ' | null;
          sector: string | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          name_kr: string;
          name_en?: string | null;
          market?: 'KOSPI' | 'KOSDAQ' | null;
          sector?: string | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name_kr?: string;
          name_en?: string | null;
          market?: 'KOSPI' | 'KOSDAQ' | null;
          sector?: string | null;
          updated_at?: string;
        };
      };
      disclosure_insights: {
        Row: {
          id: string;
          company_code: string | null;
          title_kr: string;
          title_en: string | null;
          summary_kr: string | null;
          summary_en: string | null;
          sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_code?: string | null;
          title_kr: string;
          title_en?: string | null;
          summary_kr?: string | null;
          summary_en?: string | null;
          sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null;
          published_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_code?: string | null;
          title_kr?: string;
          title_en?: string | null;
          summary_kr?: string | null;
          summary_en?: string | null;
          sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null;
          published_at?: string | null;
          created_at?: string;
        };
      };
      market_indices: {
        Row: {
          id: string;
          index_name: string;
          value: number | null;
          change_percent: number | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          index_name: string;
          value?: number | null;
          change_percent?: number | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          index_name?: string;
          value?: number | null;
          change_percent?: number | null;
          recorded_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Legacy types (기존 코드 호환용)
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