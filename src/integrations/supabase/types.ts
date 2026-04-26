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
          phone: string | null
          tax_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          tax_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          tax_id?: string | null
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
      admin_conversion_by_trial_day: {
        Args: never
        Returns: {
          conversions: number
          trial_day: number
        }[]
      }
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
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          current_period_end: string
          email: string
          last_session: string
          last_sign_in_at: string
          plan: string
          status: string
          top_module: string
          total_sessions: number
          user_id: string
        }[]
      }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
