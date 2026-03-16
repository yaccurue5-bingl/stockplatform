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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bundle_hashes: {
        Row: {
          bundle_date: string
          corp_code: string
          corp_name: string
          created_at: string | null
          disclosure_count: number | null
          expires_at: string | null
          hash_key: string
          id: string
          sonnet_called: boolean | null
          time_bucket: string
          tokens_used: number | null
        }
        Insert: {
          bundle_date: string
          corp_code: string
          corp_name: string
          created_at?: string | null
          disclosure_count?: number | null
          expires_at?: string | null
          hash_key: string
          id?: string
          sonnet_called?: boolean | null
          time_bucket: string
          tokens_used?: number | null
        }
        Update: {
          bundle_date?: string
          corp_code?: string
          corp_name?: string
          created_at?: string | null
          disclosure_count?: number | null
          expires_at?: string | null
          hash_key?: string
          id?: string
          sonnet_called?: boolean | null
          time_bucket?: string
          tokens_used?: number | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          close_price: number | null
          code: string | null
          corp_name: string
          created_at: string | null
          full_code: string | null
          high_price: number | null
          id: number
          listed_shares: number | null
          low_price: number | null
          market: string | null
          market_cap: number | null
          market_type: string | null
          open_price: number | null
          sector: string | null
          sector_en: string | null
          stock_code: string
          trade_value: number | null
          updated_at: string | null
          volume: number | null
        }
        Insert: {
          close_price?: number | null
          code?: string | null
          corp_name: string
          created_at?: string | null
          full_code?: string | null
          high_price?: number | null
          id?: number
          listed_shares?: number | null
          low_price?: number | null
          market?: string | null
          market_cap?: number | null
          market_type?: string | null
          open_price?: number | null
          sector?: string | null
          sector_en?: string | null
          stock_code: string
          trade_value?: number | null
          updated_at?: string | null
          volume?: number | null
        }
        Update: {
          close_price?: number | null
          code?: string | null
          corp_name?: string
          created_at?: string | null
          full_code?: string | null
          high_price?: number | null
          id?: number
          listed_shares?: number | null
          low_price?: number | null
          market?: string | null
          market_cap?: number | null
          market_type?: string | null
          open_price?: number | null
          sector?: string | null
          sector_en?: string | null
          stock_code?: string
          trade_value?: number | null
          updated_at?: string | null
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_companies_sector"
            columns: ["sector"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["name"]
          },
        ]
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
          analysis: string | null
          analysis_retry_count: number | null
          analysis_status: string | null
          analyzed_at: string | null
          content: string | null
          corp_code: string
          corp_name: string
          created_at: string | null
          event_type: string | null
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
          rcept_dt: string
          rcept_no: string
          report_nm: string
          risk_factors: string | null
          sector: string | null
          sentiment: string | null
          sentiment_score: number | null
          short_term_impact_score: number | null
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
          content?: string | null
          corp_code: string
          corp_name: string
          created_at?: string | null
          event_type?: string | null
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
          rcept_dt: string
          rcept_no: string
          report_nm: string
          risk_factors?: string | null
          sector?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          short_term_impact_score?: number | null
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
          content?: string | null
          corp_code?: string
          corp_name?: string
          created_at?: string | null
          event_type?: string | null
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
          rcept_dt?: string
          rcept_no?: string
          report_nm?: string
          risk_factors?: string | null
          sector?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          short_term_impact_score?: number | null
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
          description: string | null
          detail_code: string | null
          detail_name: string | null
          division_code: string | null
          division_name: string | null
          ksic_code: string
          ksic_name: string | null
          major_code: string | null
          major_name: string | null
          minor_code: string | null
          minor_name: string | null
          sub_code: string | null
          sub_name: string | null
          top_industry: string | null
        }
        Insert: {
          description?: string | null
          detail_code?: string | null
          detail_name?: string | null
          division_code?: string | null
          division_name?: string | null
          ksic_code: string
          ksic_name?: string | null
          major_code?: string | null
          major_name?: string | null
          minor_code?: string | null
          minor_name?: string | null
          sub_code?: string | null
          sub_name?: string | null
          top_industry?: string | null
        }
        Update: {
          description?: string | null
          detail_code?: string | null
          detail_name?: string | null
          division_code?: string | null
          division_name?: string | null
          ksic_code?: string
          ksic_name?: string | null
          major_code?: string | null
          major_name?: string | null
          minor_code?: string | null
          minor_name?: string | null
          sub_code?: string | null
          sub_name?: string | null
          top_industry?: string | null
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
          id: number
          name: string
          price: string | null
          symbol: string
          updated_at: string | null
        }
        Insert: {
          change_rate?: number | null
          change_value?: string | null
          id?: number
          name: string
          price?: string | null
          symbol: string
          updated_at?: string | null
        }
        Update: {
          change_rate?: number | null
          change_value?: string | null
          id?: number
          name?: string
          price?: string | null
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
          id?: number
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
      sectors: {
        Row: {
          created_at: string | null
          description: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_type: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
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
      test_event_returns: {
        Row: {
          corp_name: string | null
          created_at: string | null
          disclosure_date: string | null
          id: number
          return_1d: number | null
          return_3d: number | null
          return_5d: number | null
          stock_code: string | null
        }
        Insert: {
          corp_name?: string | null
          created_at?: string | null
          disclosure_date?: string | null
          id?: number
          return_1d?: number | null
          return_3d?: number | null
          return_5d?: number | null
          stock_code?: string | null
        }
        Update: {
          corp_name?: string | null
          created_at?: string | null
          disclosure_date?: string | null
          id?: number
          return_1d?: number | null
          return_3d?: number | null
          return_5d?: number | null
          stock_code?: string | null
        }
        Relationships: []
      }
      test_event_statistics: {
        Row: {
          avg_1d: number | null
          avg_3d: number | null
          avg_5d: number | null
          created_at: string | null
          event_type: string | null
          id: number
          sample_size: number | null
          std_1d: number | null
          std_3d: number | null
          std_5d: number | null
        }
        Insert: {
          avg_1d?: number | null
          avg_3d?: number | null
          avg_5d?: number | null
          created_at?: string | null
          event_type?: string | null
          id?: number
          sample_size?: number | null
          std_1d?: number | null
          std_3d?: number | null
          std_5d?: number | null
        }
        Update: {
          avg_1d?: number | null
          avg_3d?: number | null
          avg_5d?: number | null
          created_at?: string | null
          event_type?: string | null
          id?: number
          sample_size?: number | null
          std_1d?: number | null
          std_3d?: number | null
          std_5d?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          last_session_id: string | null
          plan: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          last_session_id?: string | null
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          last_session_id?: string | null
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
      [_ in never]: never
    }
    Functions: {
      demote_expired_hot_stocks: { Args: never; Returns: number }
      get_active_hot_stocks: {
        Args: never
        Returns: {
          corp_code: string
          corp_name: string
          expires_at: string
          promoted_at: string
          reason: string
          stock_code: string
        }[]
      }
      get_corp_code: {
        Args: { p_stock_code: string }
        Returns: {
          corp_code: string
          corp_name: string
        }[]
      }
      is_hot_stock: { Args: { p_corp_code: string }; Returns: boolean }
      promote_to_hot_stock: {
        Args: {
          p_corp_code: string
          p_corp_name: string
          p_reason: string
          p_reason_detail?: string
          p_stock_code: string
          p_trigger_threshold?: number
          p_trigger_value?: number
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
