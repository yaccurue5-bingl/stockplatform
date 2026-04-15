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
      dart_corp_codes: {
        Row: {
          corp_code: string
          corp_name: string
          created_at: string | null
          modify_date: string | null
          stock_code: string
          updated_at: string | null
        }
        Insert: {
          corp_code: string
          corp_name: string
          created_at?: string | null
          modify_date?: string | null
          stock_code: string
          updated_at?: string | null
        }
        Update: {
          corp_code?: string
          corp_name?: string
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
          analysis: string | null
          analysis_retry_count: number | null
          analysis_status: string | null
          analyzed_at: string | null
          base_score: number | null
          base_score_raw: number | null
          content: string | null
          corp_code: string | null
          corp_name: string | null
          created_at: string | null
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
          analysis?: string | null
          analysis_retry_count?: number | null
          analysis_status?: string | null
          analyzed_at?: string | null
          base_score?: number | null
          base_score_raw?: number | null
          content?: string | null
          corp_code?: string | null
          corp_name?: string | null
          created_at?: string | null
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
          analysis?: string | null
          analysis_retry_count?: number | null
          analysis_status?: string | null
          analyzed_at?: string | null
          base_score?: number | null
          base_score_raw?: number | null
          content?: string | null
          corp_code?: string | null
          corp_name?: string | null
          created_at?: string | null
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
          avg_5d_return: number | null
          event_type: string
          sample_size: number | null
          std_5d: number | null
          updated_at: string | null
        }
        Insert: {
          avg_1d_return?: number | null
          avg_20d_return?: number | null
          avg_3d_return?: number | null
          avg_5d_return?: number | null
          event_type: string
          sample_size?: number | null
          std_5d?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_1d_return?: number | null
          avg_20d_return?: number | null
          avg_3d_return?: number | null
          avg_5d_return?: number | null
          event_type?: string
          sample_size?: number | null
          std_5d?: number | null
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
          base_score: number | null
          base_score_raw: number | null
          created_at: string | null
          date: string
          disclosure_id: string | null
          final_score: number | null
          future_return_20d: number | null
          future_return_5d: number | null
          id: string
          lps: number | null
          signal_tag: string | null
          stock_code: string
        }
        Insert: {
          base_score?: number | null
          base_score_raw?: number | null
          created_at?: string | null
          date: string
          disclosure_id?: string | null
          final_score?: number | null
          future_return_20d?: number | null
          future_return_5d?: number | null
          id?: string
          lps?: number | null
          signal_tag?: string | null
          stock_code: string
        }
        Update: {
          base_score?: number | null
          base_score_raw?: number | null
          created_at?: string | null
          date?: string
          disclosure_id?: string | null
          final_score?: number | null
          future_return_20d?: number | null
          future_return_5d?: number | null
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
      sector_signals: {
        Row: {
          confidence: number | null
          created_at: string | null
          date: string
          disclosure_count: number | null
          drivers: string[] | null
          id: string
          negative_count: number | null
          neutral_count: number | null
          positive_count: number | null
          sector: string
          sector_en: string | null
          signal: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          date: string
          disclosure_count?: number | null
          drivers?: string[] | null
          id?: string
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          sector: string
          sector_en?: string | null
          signal?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          date?: string
          disclosure_count?: number | null
          drivers?: string[] | null
          id?: string
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
          sector?: string
          sector_en?: string | null
          signal?: string | null
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
      subscriptions: {
        Row: {
          id: string
          user_id: string | null
          paddle_subscription_id: string | null
          paddle_customer_id: string | null
          paddle_plan_id: string | null
          plan_type: string
          status: string
          next_billing_date: string | null
          canceled_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          paddle_subscription_id?: string | null
          paddle_customer_id?: string | null
          paddle_plan_id?: string | null
          plan_type?: string
          status?: string
          next_billing_date?: string | null
          canceled_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          paddle_subscription_id?: string | null
          paddle_customer_id?: string | null
          paddle_plan_id?: string | null
          plan_type?: string
          status?: string
          next_billing_date?: string | null
          canceled_at?: string | null
          created_at?: string | null
          updated_at?: string | null
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
    }
    Views: {
      [_ in never]: never
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
