export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      api_usage_daily: {
        Row: {
          call_count: number
          date: string
          user_id: string
        }
        Insert: {
          call_count?: number
          date: string
          user_id: string
        }
        Update: {
          call_count?: number
          date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_log: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          latency_ms: number | null
          method: string
          plan: string | null
          status_code: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          latency_ms?: number | null
          method?: string
          plan?: string | null
          status_code?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          latency_ms?: number | null
          method?: string
          plan?: string | null
          status_code?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      backtest_results: {
        Row: {
          avg_return_per_trade: number | null
          computed_at: string | null
          equity_curve: Json | null
          event_filter: string | null
          hold_days: number
          id: string
          max_drawdown: number | null
          num_trades: number | null
          score_threshold: number | null
          sharpe_ratio: number | null
          strategy_id: string
          strategy_label: string
          total_return: number | null
          win_rate: number | null
        }
        Insert: {
          avg_return_per_trade?: number | null
          computed_at?: string | null
          equity_curve?: Json | null
          event_filter?: string | null
          hold_days?: number
          id?: string
          max_drawdown?: number | null
          num_trades?: number | null
          score_threshold?: number | null
          sharpe_ratio?: number | null
          strategy_id: string
          strategy_label: string
          total_return?: number | null
          win_rate?: number | null
        }
        Update: {
          avg_return_per_trade?: number | null
          computed_at?: string | null
          equity_curve?: Json | null
          event_filter?: string | null
          hold_days?: number
          id?: string
          max_drawdown?: number | null
          num_trades?: number | null
          score_threshold?: number | null
          sharpe_ratio?: number | null
          strategy_id?: string
          strategy_label?: string
          total_return?: number | null
          win_rate?: number | null
        }
        Relationships: []
      }
      backtest_trades: {
        Row: {
          base_score: number | null
          created_at: string
          disclosure_id: string | null
          event_date: string
          final_score: number | null
          id: string
          market_regime: string | null
          return_3d: number | null
          return_5d: number | null
          stock_code: string
          strategy_name: string
        }
        Insert: {
          base_score?: number | null
          created_at?: string
          disclosure_id?: string | null
          event_date: string
          final_score?: number | null
          id?: string
          market_regime?: string | null
          return_3d?: number | null
          return_5d?: number | null
          stock_code: string
          strategy_name: string
        }
        Update: {
          base_score?: number | null
          created_at?: string
          disclosure_id?: string | null
          event_date?: string
          final_score?: number | null
          id?: string
          market_regime?: string | null
          return_3d?: number | null
          return_5d?: number | null
          stock_code?: string
          strategy_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "backtest_trades_disclosure_id_fkey"
            columns: ["disclosure_id"]
            isOneToOne: false
            referencedRelation: "disclosure_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          corp_name: string
          corp_reg_no: string | null
          created_at: string | null
          employee_count: number | null
          established_at: string | null
          foreign_hold_shares: number | null
          foreign_ratio: number | null
          homepage_url: string | null
          id: number
          ksic_code: string | null
          listed_shares: number | null
          listed_shares_updated: string | null
          market_cap: number | null
          market_type: string | null
          representative: string | null
          sector: string | null
          sector_en: string | null
          stock_code: string
          updated_at: string | null
        }
        Insert: {
          corp_name: string
          corp_reg_no?: string | null
          created_at?: string | null
          employee_count?: number | null
          established_at?: string | null
          foreign_hold_shares?: number | null
          foreign_ratio?: number | null
          homepage_url?: string | null
          id?: number
          ksic_code?: string | null
          listed_shares?: number | null
          listed_shares_updated?: string | null
          market_cap?: number | null
          market_type?: string | null
          representative?: string | null
          sector?: string | null
          sector_en?: string | null
          stock_code: string
          updated_at?: string | null
        }
        Update: {
          corp_name?: string
          corp_reg_no?: string | null
          created_at?: string | null
          employee_count?: number | null
          established_at?: string | null
          foreign_hold_shares?: number | null
          foreign_ratio?: number | null
          homepage_url?: string | null
          id?: number
          ksic_code?: string | null
          listed_shares?: number | null
          listed_shares_updated?: string | null
          market_cap?: number | null
          market_type?: string | null
          representative?: string | null
          sector?: string | null
          sector_en?: string | null
          stock_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_indicators: {
        Row: {
          date: string
          foreign_net_buy_kosdaq: number | null
          foreign_net_buy_kospi: number | null
          id: number
          kosdaq_change_pct: number | null
          kosdaq_close: number | null
          kospi_change_pct: number | null
          kospi_close: number | null
          source: string | null
          treasury_yield_10y: number | null
          treasury_yield_3y: number | null
          updated_at: string | null
          usd_krw: number | null
          wti_oil: number | null
        }
        Insert: {
          date: string
          foreign_net_buy_kosdaq?: number | null
          foreign_net_buy_kospi?: number | null
          id?: number
          kosdaq_change_pct?: number | null
          kosdaq_close?: number | null
          kospi_change_pct?: number | null
          kospi_close?: number | null
          source?: string | null
          treasury_yield_10y?: number | null
          treasury_yield_3y?: number | null
          updated_at?: string | null
          usd_krw?: number | null
          wti_oil?: number | null
        }
        Update: {
          date?: string
          foreign_net_buy_kosdaq?: number | null
          foreign_net_buy_kospi?: number | null
          id?: number
          kosdaq_change_pct?: number | null
          kosdaq_close?: number | null
          kospi_change_pct?: number | null
          kospi_close?: number | null
          source?: string | null
          treasury_yield_10y?: number | null
          treasury_yield_3y?: number | null
          updated_at?: string | null
          usd_krw?: number | null
          wti_oil?: number | null
        }
        Relationships: []
      }
      dart_corp_codes: {
        Row: {
          corp_code: string
          corp_name: string
          corp_name_en: string | null
          created_at: string | null
          modify_date: string | null
          stock_code: string
          updated_at: string | null
        }
        Insert: {
          corp_code: string
          corp_name: string
          corp_name_en?: string | null
          created_at?: string | null
          modify_date?: string | null
          stock_code: string
          updated_at?: string | null
        }
        Update: {
          corp_code?: string
          corp_name?: string
          corp_name_en?: string | null
          created_at?: string | null
          modify_date?: string | null
          stock_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      disclosure_events: {
        Row: {
          disclosure_date: string
          event_type: string
          id: number
          return_1d: number | null
          return_3d: number | null
          return_5d: number | null
          stock_code: string
          updated_at: string | null
        }
        Insert: {
          disclosure_date: string
          event_type: string
          id?: number
          return_1d?: number | null
          return_3d?: number | null
          return_5d?: number | null
          stock_code: string
          updated_at?: string | null
        }
        Update: {
          disclosure_date?: string
          event_type?: string
          id?: number
          return_1d?: number | null
          return_3d?: number | null
          return_5d?: number | null
          stock_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      disclosure_hashes: {
        Row: {
          corp_code: string
          corp_name: string
          created_at: string | null
          expires_at: string | null
          groq_analyzed: boolean | null
          groq_analyzed_at: string | null
          hash_key: string
          id: string
          is_revision: boolean | null
          rcept_no: string
          report_name: string
          sonnet_analyzed: boolean | null
          sonnet_analyzed_at: string | null
        }
        Insert: {
          corp_code: string
          corp_name: string
          created_at?: string | null
          expires_at?: string | null
          groq_analyzed?: boolean | null
          groq_analyzed_at?: string | null
          hash_key: string
          id?: string
          is_revision?: boolean | null
          rcept_no: string
          report_name: string
          sonnet_analyzed?: boolean | null
          sonnet_analyzed_at?: string | null
        }
        Update: {
          corp_code?: string
          corp_name?: string
          created_at?: string | null
          expires_at?: string | null
          groq_analyzed?: boolean | null
          groq_analyzed_at?: string | null
          hash_key?: string
          id?: string
          is_revision?: boolean | null
          rcept_no?: string
          report_name?: string
          sonnet_analyzed?: boolean | null
          sonnet_analyzed_at?: string | null
        }
        Relationships: []
      }
      disclosure_insights: {
        Row: {
          ai_summary: string | null
          alpha_score: number | null
          analysis: string | null
          analysis_retry_count: number | null
          analysis_status: string | null
          analyzed_at: string | null
          base_score: number | null
          base_score_raw: number | null
          content: string | null
          corp_code: string | null
          corp_name: string | null
          corp_name_en: string | null
          counterparty_type: string | null
          created_at: string | null
          deal_revenue_pct: number | null
          dilution_pct: number | null
          event_type: string | null
          final_score: number | null
          financial_impact: string | null
          headline: string | null
          id: string
          importance: string | null
          industry_avg_comparison: Json | null
          industry_comparison_data: Json | null
          is_sample_disclosure: boolean | null
          is_visible: boolean | null
          key_numbers: Json | null
          market_reaction_history: Json | null
          rcept_dt: string | null
          rcept_no: string | null
          report_nm: string | null
          report_nm_en: string | null
          risk_factors: string | null
          sector: string | null
          sentiment: string | null
          sentiment_score: number | null
          short_term_impact_score: number | null
          signal_tag: string | null
          sonnet_analyzed: boolean | null
          sonnet_analyzed_at: string | null
          sonnet_detailed_analysis: string | null
          sonnet_investment_implications: string | null
          sonnet_key_metrics: string[] | null
          sonnet_risk_factors: string[] | null
          sonnet_summary: string | null
          sonnet_tokens_used: number | null
          stock_code: string | null
          system_score: number | null
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          alpha_score?: number | null
          analysis?: string | null
          analysis_retry_count?: number | null
          analysis_status?: string | null
          analyzed_at?: string | null
          base_score?: number | null
          base_score_raw?: number | null
          content?: string | null
          corp_code?: string | null
          corp_name?: string | null
          corp_name_en?: string | null
          counterparty_type?: string | null
          created_at?: string | null
          deal_revenue_pct?: number | null
          dilution_pct?: number | null
          event_type?: string | null
          final_score?: number | null
          financial_impact?: string | null
          headline?: string | null
          id?: string
          importance?: string | null
          industry_avg_comparison?: Json | null
          industry_comparison_data?: Json | null
          is_sample_disclosure?: boolean | null
          is_visible?: boolean | null
          key_numbers?: Json | null
          market_reaction_history?: Json | null
          rcept_dt?: string | null
          rcept_no?: string | null
          report_nm?: string | null
          report_nm_en?: string | null
          risk_factors?: string | null
          sector?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          short_term_impact_score?: number | null
          signal_tag?: string | null
          sonnet_analyzed?: boolean | null
          sonnet_analyzed_at?: string | null
          sonnet_detailed_analysis?: string | null
          sonnet_investment_implications?: string | null
          sonnet_key_metrics?: string[] | null
          sonnet_risk_factors?: string[] | null
          sonnet_summary?: string | null
          sonnet_tokens_used?: number | null
          stock_code?: string | null
          system_score?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          alpha_score?: number | null
          analysis?: string | null
          analysis_retry_count?: number | null
          analysis_status?: string | null
          analyzed_at?: string | null
          base_score?: number | null
          base_score_raw?: number | null
          content?: string | null
          corp_code?: string | null
          corp_name?: string | null
          corp_name_en?: string | null
          counterparty_type?: string | null
          created_at?: string | null
          deal_revenue_pct?: number | null
          dilution_pct?: number | null
          event_type?: string | null
          final_score?: number | null
          financial_impact?: string | null
          headline?: string | null
          id?: string
          importance?: string | null
          industry_avg_comparison?: Json | null
          industry_comparison_data?: Json | null
          is_sample_disclosure?: boolean | null
          is_visible?: boolean | null
          key_numbers?: Json | null
          market_reaction_history?: Json | null
          rcept_dt?: string | null
          rcept_no?: string | null
          report_nm?: string | null
          report_nm_en?: string | null
          risk_factors?: string | null
          sector?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          short_term_impact_score?: number | null
          signal_tag?: string | null
          sonnet_analyzed?: boolean | null
          sonnet_analyzed_at?: string | null
          sonnet_detailed_analysis?: string | null
          sonnet_investment_implications?: string | null
          sonnet_key_metrics?: string[] | null
          sonnet_risk_factors?: string[] | null
          sonnet_summary?: string | null
          sonnet_tokens_used?: number | null
          stock_code?: string | null
          system_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_statistics: {
        Row: {
          avg_1d: number | null
          avg_3d: number | null
          avg_5d: number | null
          event_type: string
          last_updated_at: string | null
          sample_size: number | null
          std_1d: number | null
          std_3d: number | null
          std_5d: number | null
          updated_at: string | null
        }
        Insert: {
          avg_1d?: number | null
          avg_3d?: number | null
          avg_5d?: number | null
          event_type: string
          last_updated_at?: string | null
          sample_size?: number | null
          std_1d?: number | null
          std_3d?: number | null
          std_5d?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_1d?: number | null
          avg_3d?: number | null
          avg_5d?: number | null
          event_type?: string
          last_updated_at?: string | null
          sample_size?: number | null
          std_1d?: number | null
          std_3d?: number | null
          std_5d?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_stats: {
        Row: {
          avg_1d_return: number | null
          avg_20d_return: number | null
          avg_3d_return: number | null
          avg_5d_open_return: number | null
          avg_5d_return: number | null
          avg_z_5d_large: number | null
          avg_z_5d_mid: number | null
          avg_z_5d_small: number | null
          event_type: string
          median_20d_return: number | null
          median_5d_open_return: number | null
          median_5d_return: number | null
          n_large: number | null
          n_mid: number | null
          n_small: number | null
          risk_adj_return: number | null
          sample_size: number | null
          sample_size_clean: number | null
          signal_confidence: number | null
          signal_grade: string | null
          signal_score: number | null
          std_5d: number | null
          updated_at: string | null
        }
        Insert: {
          avg_1d_return?: number | null
          avg_20d_return?: number | null
          avg_3d_return?: number | null
          avg_5d_open_return?: number | null
          avg_5d_return?: number | null
          avg_z_5d_large?: number | null
          avg_z_5d_mid?: number | null
          avg_z_5d_small?: number | null
          event_type: string
          median_20d_return?: number | null
          median_5d_open_return?: number | null
          median_5d_return?: number | null
          n_large?: number | null
          n_mid?: number | null
          n_small?: number | null
          risk_adj_return?: number | null
          sample_size?: number | null
          sample_size_clean?: number | null
          signal_confidence?: number | null
          signal_grade?: string | null
          signal_score?: number | null
          std_5d?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_1d_return?: number | null
          avg_20d_return?: number | null
          avg_3d_return?: number | null
          avg_5d_open_return?: number | null
          avg_5d_return?: number | null
          avg_z_5d_large?: number | null
          avg_z_5d_mid?: number | null
          avg_z_5d_small?: number | null
          event_type?: string
          median_20d_return?: number | null
          median_5d_open_return?: number | null
          median_5d_return?: number | null
          n_large?: number | null
          n_mid?: number | null
          n_small?: number | null
          risk_adj_return?: number | null
          sample_size?: number | null
          sample_size_clean?: number | null
          signal_confidence?: number | null
          signal_grade?: string | null
          signal_score?: number | null
          std_5d?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      financials: {
        Row: {
          created_at: string | null
          fiscal_year: number
          id: number
          is_financial_sector: boolean | null
          net_profit: number | null
          op_profit: number | null
          revenue: number | null
          stock_code: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fiscal_year: number
          id?: number
          is_financial_sector?: boolean | null
          net_profit?: number | null
          op_profit?: number | null
          revenue?: number | null
          stock_code: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fiscal_year?: number
          id?: number
          is_financial_sector?: boolean | null
          net_profit?: number | null
          op_profit?: number | null
          revenue?: number | null
          stock_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hot_stocks: {
        Row: {
          corp_code: string
          corp_name: string
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          level: string
          max_refreshes: number | null
          promoted_at: string
          reason: string
          reason_detail: string | null
          refresh_count: number | null
          stock_code: string | null
          trigger_threshold: number | null
          trigger_value: number | null
          updated_at: string | null
        }
        Insert: {
          corp_code: string
          corp_name: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          level?: string
          max_refreshes?: number | null
          promoted_at?: string
          reason: string
          reason_detail?: string | null
          refresh_count?: number | null
          stock_code?: string | null
          trigger_threshold?: number | null
          trigger_value?: number | null
          updated_at?: string | null
        }
        Update: {
          corp_code?: string
          corp_name?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          level?: string
          max_refreshes?: number | null
          promoted_at?: string
          reason?: string
          reason_detail?: string | null
          refresh_count?: number | null
          stock_code?: string | null
          trigger_threshold?: number | null
          trigger_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ksic_codes: {
        Row: {
          created_at: string | null
          description: string | null
          detail_code: string | null
          detail_name: string | null
          division_code: string | null
          division_name: string | null
          ksic_code: string
          ksic_name: string
          major_code: string | null
          major_name: string | null
          minor_code: string | null
          minor_name: string | null
          sub_code: string | null
          sub_name: string | null
          top_industry: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          detail_code?: string | null
          detail_name?: string | null
          division_code?: string | null
          division_name?: string | null
          ksic_code: string
          ksic_name: string
          major_code?: string | null
          major_name?: string | null
          minor_code?: string | null
          minor_name?: string | null
          sub_code?: string | null
          sub_name?: string | null
          top_industry?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          detail_code?: string | null
          detail_name?: string | null
          division_code?: string | null
          division_name?: string | null
          ksic_code?: string
          ksic_name?: string
          major_code?: string | null
          major_name?: string | null
          minor_code?: string | null
          minor_name?: string | null
          sub_code?: string | null
          sub_name?: string | null
          top_industry?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      loan_stats: {
        Row: {
          created_at: string | null
          date: string
          loan_balance: number | null
          loan_delta: number | null
          loan_z: number | null
          lps: number | null
          stock_code: string
          volume: number | null
          volume_ratio: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          loan_balance?: number | null
          loan_delta?: number | null
          loan_z?: number | null
          lps?: number | null
          stock_code: string
          volume?: number | null
          volume_ratio?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          loan_balance?: number | null
          loan_delta?: number | null
          loan_z?: number | null
          lps?: number | null
          stock_code?: string
          volume?: number | null
          volume_ratio?: number | null
        }
        Relationships: []
      }
      mail_logs: {
        Row: {
          corp_name: string | null
          created_at: string | null
          error_message: string | null
          id: string
          mail_type: string | null
          metadata: Json | null
          recipient: string
          resend_id: string | null
          sector: string | null
          status: string | null
          stock_code: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          corp_name?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          mail_type?: string | null
          metadata?: Json | null
          recipient: string
          resend_id?: string | null
          sector?: string | null
          status?: string | null
          stock_code?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          corp_name?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          mail_type?: string | null
          metadata?: Json | null
          recipient?: string
          resend_id?: string | null
          sector?: string | null
          status?: string | null
          stock_code?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      market_indices: {
        Row: {
          change_rate: number | null
          change_value: string | null
          name: string
          price: string
          symbol: string
          updated_at: string | null
        }
        Insert: {
          change_rate?: number | null
          change_value?: string | null
          name: string
          price: string
          symbol: string
          updated_at?: string | null
        }
        Update: {
          change_rate?: number | null
          change_value?: string | null
          name?: string
          price?: string
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      market_live: {
        Row: {
          created_at: string
          data: Json
          id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
        }
        Relationships: []
      }
      market_radar: {
        Row: {
          created_at: string | null
          date: string
          foreign_flow: string | null
          id: string
          kosdaq_change: number | null
          kospi_change: number | null
          market_signal: string | null
          summary: string | null
          top_sector: string | null
          top_sector_en: string | null
          total_disclosures: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          foreign_flow?: string | null
          id?: string
          kosdaq_change?: number | null
          kospi_change?: number | null
          market_signal?: string | null
          summary?: string | null
          top_sector?: string | null
          top_sector_en?: string | null
          total_disclosures?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          foreign_flow?: string | null
          id?: string
          kosdaq_change?: number | null
          kospi_change?: number | null
          market_signal?: string | null
          summary?: string | null
          top_sector?: string | null
          top_sector_en?: string | null
          total_disclosures?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          id: string
          paddle_subscription_id: string | null
          paid_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          paddle_subscription_id?: string | null
          paid_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          paddle_subscription_id?: string | null
          paid_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_summary: {
        Row: {
          annualized_return: number | null
          avg_loss: number | null
          avg_return: number | null
          avg_win: number | null
          equity_curve_json: Json | null
          expectancy: number | null
          holding_days: string | null
          max_drawdown: number | null
          period_end: string | null
          period_start: string | null
          risk_on_trades: number | null
          score_threshold: number | null
          sharpe_ratio: number | null
          strategy_name: string
          total_return: number | null
          total_trades: number | null
          updated_at: string
          win_rate: number | null
        }
        Insert: {
          annualized_return?: number | null
          avg_loss?: number | null
          avg_return?: number | null
          avg_win?: number | null
          equity_curve_json?: Json | null
          expectancy?: number | null
          holding_days?: string | null
          max_drawdown?: number | null
          period_end?: string | null
          period_start?: string | null
          risk_on_trades?: number | null
          score_threshold?: number | null
          sharpe_ratio?: number | null
          strategy_name: string
          total_return?: number | null
          total_trades?: number | null
          updated_at?: string
          win_rate?: number | null
        }
        Update: {
          annualized_return?: number | null
          avg_loss?: number | null
          avg_return?: number | null
          avg_win?: number | null
          equity_curve_json?: Json | null
          expectancy?: number | null
          holding_days?: string | null
          max_drawdown?: number | null
          period_end?: string | null
          period_start?: string | null
          risk_on_trades?: number | null
          score_threshold?: number | null
          sharpe_ratio?: number | null
          strategy_name?: string
          total_return?: number | null
          total_trades?: number | null
          updated_at?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          close: number | null
          date: string
          open: number | null
          stock_code: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          date: string
          open?: number | null
          stock_code: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          date?: string
          open?: number | null
          stock_code?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scores_log: {
        Row: {
          alpha_score: number | null
          base_score: number | null
          base_score_raw: number | null
          created_at: string | null
          date: string
          disclosure_id: string | null
          final_score: number | null
          future_return_20d: number | null
          future_return_3d: number | null
          future_return_5d: number | null
          future_return_5d_open: number | null
          id: string
          lps: number | null
          signal_tag: string | null
          stock_code: string
        }
        Insert: {
          alpha_score?: number | null
          base_score?: number | null
          base_score_raw?: number | null
          created_at?: string | null
          date: string
          disclosure_id?: string | null
          final_score?: number | null
          future_return_20d?: number | null
          future_return_3d?: number | null
          future_return_5d?: number | null
          future_return_5d_open?: number | null
          id?: string
          lps?: number | null
          signal_tag?: string | null
          stock_code: string
        }
        Update: {
          alpha_score?: number | null
          base_score?: number | null
          base_score_raw?: number | null
          created_at?: string | null
          date?: string
          disclosure_id?: string | null
          final_score?: number | null
          future_return_20d?: number | null
          future_return_3d?: number | null
          future_return_5d?: number | null
          future_return_5d_open?: number | null
          id?: string
          lps?: number | null
          signal_tag?: string | null
          stock_code?: string
        }
        Relationships: []
      }
      sector_benchmarks: {
        Row: {
          avg_net_margin: number | null
          avg_op_margin: number | null
          avg_pbr: number | null
          avg_per: number | null
          growth_rate_yoy: number | null
          id: number
          sector: string
          sector_en: string | null
          updated_at: string | null
        }
        Insert: {
          avg_net_margin?: number | null
          avg_op_margin?: number | null
          avg_pbr?: number | null
          avg_per?: number | null
          growth_rate_yoy?: number | null
          id: number
          sector: string
          sector_en?: string | null
          updated_at?: string | null
        }
        Update: {
          avg_net_margin?: number | null
          avg_op_margin?: number | null
          avg_pbr?: number | null
          avg_per?: number | null
          growth_rate_yoy?: number | null
          id?: number
          sector?: string
          sector_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sector_macro: {
        Row: {
          export_amount_mn: number | null
          export_momentum: string | null
          export_yoy: number | null
          id: string
          macro_label: string | null
          macro_score: number | null
          prev_export_yoy: number | null
          sector_en: string
          source: string | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          export_amount_mn?: number | null
          export_momentum?: string | null
          export_yoy?: number | null
          id?: string
          macro_label?: string | null
          macro_score?: number | null
          prev_export_yoy?: number | null
          sector_en: string
          source?: string | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          export_amount_mn?: number | null
          export_momentum?: string | null
          export_yoy?: number | null
          id?: string
          macro_label?: string | null
          macro_score?: number | null
          prev_export_yoy?: number | null
          sector_en?: string
          source?: string | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: []
      }
      sector_signals: {
        Row: {
          avg_return_3d: number | null
          confidence: number | null
          created_at: string | null
          date: string
          disclosure_count: number | null
          drivers: string[] | null
          id: string
          negative_count: number | null
          neutral_count: number | null
          positive_count: number | null
          risk_on_ratio: number | null
          score: number | null
          sector: string
          sector_en: string | null
          signal: string | null
          top_stocks: Json | null
          win_rate: number | null
          window_days: number
        }
        Insert: {
          avg_return_3d?: number | null
          confidence?: number | null
          created_at?: string | null
          date: string
          disclosure_count?: number | null
          drivers?: string[] | null
          id?: string
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          risk_on_ratio?: number | null
          score?: number | null
          sector: string
          sector_en?: string | null
          signal?: string | null
          top_stocks?: Json | null
          win_rate?: number | null
          window_days?: number
        }
        Update: {
          avg_return_3d?: number | null
          confidence?: number | null
          created_at?: string | null
          date?: string
          disclosure_count?: number | null
          drivers?: string[] | null
          id?: string
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          risk_on_ratio?: number | null
          score?: number | null
          sector?: string
          sector_en?: string | null
          signal?: string | null
          top_stocks?: Json | null
          win_rate?: number | null
          window_days?: number
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string | null
          description: string | null
          name: string
          sector_en: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          name: string
          sector_en?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          name?: string
          sector_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      short_interest: {
        Row: {
          created_at: string | null
          date: string
          id: number
          loan_balance: number | null
          loan_shares: number | null
          stock_code: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: number
          loan_balance?: number | null
          loan_shares?: number | null
          stock_code: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: number
          loan_balance?: number | null
          loan_shares?: number | null
          stock_code?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          next_billing_date: string | null
          paddle_customer_id: string | null
          paddle_plan_id: string | null
          paddle_subscription_id: string | null
          plan_type: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          next_billing_date?: string | null
          paddle_customer_id?: string | null
          paddle_plan_id?: string | null
          paddle_subscription_id?: string | null
          plan_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          next_billing_date?: string | null
          paddle_customer_id?: string | null
          paddle_plan_id?: string | null
          paddle_subscription_id?: string | null
          plan_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      test_dilution_events: {
        Row: {
          corp_name: string | null
          created_at: string | null
          disclosure_date: string | null
          id: number
          report_nm: string | null
          stock_code: string | null
        }
        Insert: {
          corp_name?: string | null
          created_at?: string | null
          disclosure_date?: string | null
          id?: number
          report_nm?: string | null
          stock_code?: string | null
        }
        Update: {
          corp_name?: string | null
          created_at?: string | null
          disclosure_date?: string | null
          id?: number
          report_nm?: string | null
          stock_code?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          api_key: string | null
          api_key_created_at: string | null
          created_at: string | null
          email: string
          id: string
          plan: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_key_created_at?: string | null
          created_at?: string | null
          email: string
          id: string
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_key_created_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          notified_at: string | null
          source: string | null
          subscribed: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          notified_at?: string | null
          source?: string | null
          subscribed?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          notified_at?: string | null
          source?: string | null
          subscribed?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      financials_yoy: {
        Row: {
          fiscal_year: number | null
          is_financial_sector: boolean | null
          net_profit: number | null
          op_profit: number | null
          op_profit_yoy: number | null
          profit_yoy: number | null
          revenue: number | null
          revenue_yoy: number | null
          stock_code: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_corp_code: {
        Args: { p_stock_code: string }
        Returns: {
          corp_code: string
          corp_name: string
        }[]
      }
      get_ksic_major_code: { Args: { ksic_code: string }; Returns: string }
      increment_usage_daily: {
        Args: { p_date: string; p_user_id: string }
        Returns: undefined
      }
      update_company_ksic: {
        Args: {
          p_corp_code?: string
          p_industry_category?: string
          p_ksic_code: string
          p_ksic_name?: string
          p_stock_code: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
