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
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_name: string
          id: string
          session_id: string | null
          trial_day: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_name: string
          id?: string
          session_id?: string | null
          trial_day?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          session_id?: string | null
          trial_day?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      cancel_attempts: {
        Row: {
          created_at: string
          id: string
          offers_shown: Json
          outcome: string
          reason: string | null
          reason_detail: string | null
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offers_shown?: Json
          outcome?: string
          reason?: string | null
          reason_detail?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          offers_shown?: Json
          outcome?: string
          reason?: string | null
          reason_detail?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      module_analytics: {
        Row: {
          created_at: string
          duration_seconds: number
          entered_at: string
          id: string
          module_id: string
          tab_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          entered_at?: string
          id?: string
          module_id: string
          tab_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          entered_at?: string
          id?: string
          module_id?: string
          tab_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          landing_path: string | null
          phone: string | null
          referrer: string | null
          source_captured_at: string | null
          tax_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          landing_path?: string | null
          phone?: string | null
          referrer?: string | null
          source_captured_at?: string | null
          tax_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          landing_path?: string | null
          phone?: string | null
          referrer?: string | null
          source_captured_at?: string | null
          tax_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      retention_offers_used: {
        Row: {
          applied_at: string | null
          apply_attempts: number
          id: string
          last_apply_error: string | null
          metadata: Json | null
          offer_type: string
          status: string
          used_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          apply_attempts?: number
          id?: string
          last_apply_error?: string | null
          metadata?: Json | null
          offer_type: string
          status?: string
          used_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          apply_attempts?: number
          id?: string
          last_apply_error?: string | null
          metadata?: Json | null
          offer_type?: string
          status?: string
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          abacatepay_billing_id: string | null
          abacatepay_subscription_id: string | null
          billing_period: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_email: string | null
          id: string
          payment_method: string
          plan: string | null
          status: string
          user_id: string
        }
        Insert: {
          abacatepay_billing_id?: string | null
          abacatepay_subscription_id?: string | null
          billing_period?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          id?: string
          payment_method?: string
          plan?: string | null
          status?: string
          user_id: string
        }
        Update: {
          abacatepay_billing_id?: string | null
          abacatepay_subscription_id?: string | null
          billing_period?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          id?: string
          payment_method?: string
          plan?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          cancel_attempt_id: string | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          cancel_attempt_id?: string | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          cancel_attempt_id?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      trial_email_schedule: {
        Row: {
          created_at: string
          email_key: string
          id: string
          send_at: string
          sent_at: string | null
          status: string
          user_id: string
          variant_key: string | null
        }
        Insert: {
          created_at?: string
          email_key: string
          id?: string
          send_at: string
          sent_at?: string | null
          status?: string
          user_id: string
          variant_key?: string | null
        }
        Update: {
          created_at?: string
          email_key?: string
          id?: string
          send_at?: string
          sent_at?: string | null
          status?: string
          user_id?: string
          variant_key?: string | null
        }
        Relationships: []
      }
      user_activations: {
        Row: {
          action_key: string
          completed_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action_key: string
          completed_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action_key?: string
          completed_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_data: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json | null
        }
        Relationships: []
      }
      user_data_backup_lucas_seed: {
        Row: {
          backed_up_at: string
          id: string
          key: string
          original_created_at: string | null
          original_updated_at: string | null
          user_id: string
          value: Json | null
        }
        Insert: {
          backed_up_at?: string
          id?: string
          key: string
          original_created_at?: string | null
          original_updated_at?: string | null
          user_id: string
          value?: Json | null
        }
        Update: {
          backed_up_at?: string
          id?: string
          key?: string
          original_created_at?: string | null
          original_updated_at?: string | null
          user_id?: string
          value?: Json | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event: string | null
          id: string
          processed_at: string
          source: string
        }
        Insert: {
          event?: string | null
          id: string
          processed_at?: string
          source?: string
        }
        Update: {
          event?: string | null
          id?: string
          processed_at?: string
          source?: string
        }
        Relationships: []
      }
      winback_attempts: {
        Row: {
          accepted_at: string | null
          converted_at: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          offer_shown_at: string | null
          triggered_at: string
          user_id: string
          wheel_shown_at: string | null
          wheel_spun_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          converted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          offer_shown_at?: string | null
          triggered_at?: string
          user_id: string
          wheel_shown_at?: string | null
          wheel_spun_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          converted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          offer_shown_at?: string | null
          triggered_at?: string
          user_id?: string
          wheel_shown_at?: string | null
          wheel_spun_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_activation_funnel: {
        Args: never
        Returns: {
          action_key: string
          completed_count: number
          pct: number
          total_users: number
        }[]
      }
      admin_at_risk_users: {
        Args: never
        Returns: {
          days_inactive: number
          email: string
          last_session: string
          plan: string
          user_id: string
        }[]
      }
      admin_canceled_users: {
        Args: { _days?: number }
        Returns: {
          canceled_at: string
          email: string
          plan: string
          reason: string
          user_id: string
        }[]
      }
      admin_card_reset_at: { Args: { _key: string }; Returns: string }
      admin_conversion_by_trial_day: {
        Args: never
        Returns: {
          conversions: number
          trial_day: number
        }[]
      }
      admin_dashboard_v2: { Args: never; Returns: Json }
      admin_email_variant_stats: {
        Args: never
        Returns: {
          banner_clicks_after: number
          conversion_pct: number
          conversions_48h: number
          ctr_pct: number
          email_key: string
          sent_count: number
          variant_key: string
        }[]
      }
      admin_finance_card_usage: {
        Args: { _from?: string; _to?: string }
        Returns: {
          card_key: string
          interactions: number
          last_used: string
          tab_id: string
          unique_users: number
          views: number
        }[]
      }
      admin_finance_tab_usage: {
        Args: { _from?: string; _to?: string }
        Returns: {
          avg_seconds: number
          last_used: string
          sessions: number
          tab_id: string
          total_seconds: number
          unique_users: number
        }[]
      }
      admin_get_card_resets: { Args: never; Returns: Json }
      admin_landing_funnel:
        | { Args: { _days?: number }; Returns: Json }
        | { Args: { _from?: string; _to?: string }; Returns: Json }
      admin_lead_sources_summary: {
        Args: never
        Returns: {
          converted: number
          first_seen: string
          last_seen: string
          referrer_host: string
          source_label: string
          total: number
          utm_medium: string
          utm_source: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          current_period_end: string
          email: string
          last_session: string
          last_sign_in_at: string
          plan: string
          referrer: string
          status: string
          top_module: string
          total_sessions: number
          user_id: string
          utm_campaign: string
          utm_medium: string
          utm_source: string
        }[]
      }
      admin_lp_funnel: { Args: { _from?: string; _to?: string }; Returns: Json }
      admin_metrics_overview: { Args: never; Returns: Json }
      admin_module_funnel: {
        Args: never
        Returns: {
          module_id: string
          returning_users: number
          total_seconds: number
          total_sessions: number
          unique_users: number
        }[]
      }
      admin_nudge_stats: {
        Args: never
        Returns: {
          clicked: number
          completed: number
          completion_pct: number
          conversion_pct: number
          conversions_48h: number
          ctr_pct: number
          dismissed: number
          nudge_key: string
          shown: number
          trial_day: number
        }[]
      }
      admin_onboarding_funnel: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      admin_onboarding_funnel_v2: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      admin_paying_user_funnel: { Args: { _user_id: string }; Returns: Json }
      admin_paying_users: {
        Args: never
        Returns: {
          billing_period: string
          cards_filled_count: number
          current_period_end: string
          days_trial_to_paid: number
          email: string
          payment_method: string
          plan: string
          signup_at: string
          status: string
          subscribed_at: string
          tabs_visited_count: number
          top_module: string
          total_seconds_in_app: number
          total_sessions: number
          trial_days_active: number
          user_id: string
        }[]
      }
      admin_pre_signup_funnel: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      admin_recent_visitors: {
        Args: { _limit?: number }
        Returns: {
          events: number
          first_seen: string
          last_event: string
          last_module: string
          last_seen: string
          last_step: string
          session_id: string
          utm_source: string
        }[]
      }
      admin_reset_analytics: { Args: never; Returns: Json }
      admin_retention_offers_breakdown: {
        Args: never
        Returns: {
          count: number
          offer_type: string
          pct_of_type: number
          status: string
        }[]
      }
      admin_retention_stats: { Args: never; Returns: Json }
      admin_set_card_reset: { Args: { _key: string }; Returns: string }
      admin_top_tabs: {
        Args: { _from?: string; _to?: string }
        Returns: {
          last_used: string
          module_id: string
          sessions: number
          tab_id: string
          total_seconds: number
          unique_users: number
        }[]
      }
      admin_trials_started: {
        Args: { _period?: string }
        Returns: {
          days_since_start: number
          email: string
          started_at: string
          subscription_status: string
          user_id: string
        }[]
      }
      admin_tutorial_compare: { Args: { _cutoff?: string }; Returns: Json }
      admin_tutorial_dropoff:
        | { Args: { _days?: number }; Returns: Json }
        | { Args: { _from?: string; _to?: string }; Returns: Json }
      admin_tutorial_users: {
        Args: { _action_key?: string }
        Returns: {
          action_key: string
          completed_at: string
          email: string
          user_id: string
        }[]
      }
      admin_user_journey: {
        Args: { _limit?: number; _session_id?: string; _user_id?: string }
        Returns: {
          created_at: string
          event_data: Json
          event_name: string
          session_id: string
        }[]
      }
      admin_user_trial_journey: { Args: { _user_id: string }; Returns: Json }
      admin_welcome_dropoff: {
        Args: { _from?: string; _to?: string }
        Returns: {
          backs: number
          dropoff_pct: number
          exits: number
          step: number
          unique_users: number
          views: number
        }[]
      }
      admin_winback_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_test_user: { Args: { _user_id: string }; Returns: boolean }
      pending_discount_for_user: {
        Args: { _user_id: string }
        Returns: {
          apply_attempts: number
          id: string
          metadata: Json
          offer_type: string
          used_at: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
