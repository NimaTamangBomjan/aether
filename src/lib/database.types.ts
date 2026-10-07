export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_requests: {
        Row: {
          created_at: string;
          id: string;
          input_tokens: number;
          kind: Database["public"]["Enums"]["ai_kind"];
          list_id: string | null;
          output_tokens: number;
          recipient_id: string | null;
          status: Database["public"]["Enums"]["ai_status"];
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          input_tokens?: number;
          kind: Database["public"]["Enums"]["ai_kind"];
          list_id?: string | null;
          output_tokens?: number;
          recipient_id?: string | null;
          status?: Database["public"]["Enums"]["ai_status"];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          input_tokens?: number;
          kind?: Database["public"]["Enums"]["ai_kind"];
          list_id?: string | null;
          output_tokens?: number;
          recipient_id?: string | null;
          status?: Database["public"]["Enums"]["ai_status"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_requests_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_requests_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "recipients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_hidden_from: {
        Row: {
          gift_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          gift_id: string;
          user_id: string;
        };
        Update: {
          gift_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gift_hidden_from_gift_id_fkey";
            columns: ["gift_id"];
            isOneToOne: false;
            referencedRelation: "gifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gift_hidden_from_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gifts: {
        Row: {
          bought_by: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          link: string | null;
          list_id: string;
          notes: string;
          price_cents: number | null;
          purchase_date: string | null;
          quantity: number;
          recipient_id: string;
          return_by: string | null;
          status: Database["public"]["Enums"]["gift_status"];
          status_changed_at: string | null;
          status_changed_by: string | null;
          store: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bought_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          link?: string | null;
          list_id: string;
          notes?: string;
          price_cents?: number | null;
          purchase_date?: string | null;
          quantity?: number;
          recipient_id: string;
          return_by?: string | null;
          status?: Database["public"]["Enums"]["gift_status"];
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          store?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          bought_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          link?: string | null;
          list_id?: string;
          notes?: string;
          price_cents?: number | null;
          purchase_date?: string | null;
          quantity?: number;
          recipient_id?: string;
          return_by?: string | null;
          status?: Database["public"]["Enums"]["gift_status"];
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          store?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gifts_bought_by_fkey";
            columns: ["bought_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gifts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gifts_recipient_id_list_id_fkey";
            columns: ["recipient_id", "list_id"];
            isOneToOne: false;
            referencedRelation: "recipients";
            referencedColumns: ["id", "list_id"];
          },
          {
            foreignKeyName: "gifts_status_changed_by_fkey";
            columns: ["status_changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          list_id: string;
          token_hash: string;
          used_at: string | null;
          used_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          list_id: string;
          token_hash: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          list_id?: string;
          token_hash?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_used_by_fkey";
            columns: ["used_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      list_members: {
        Row: {
          joined_at: string;
          list_id: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          joined_at?: string;
          list_id: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          joined_at?: string;
          list_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "list_members_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          overall_budget_cents: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name?: string;
          overall_budget_cents?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          overall_budget_cents?: number | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_cents: number;
          currency: string;
          id: string;
          paid_at: string;
          refunded_at: string | null;
          status: string;
          stripe_payment_intent_id: string | null;
          stripe_session_id: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          currency?: string;
          id?: string;
          paid_at?: string;
          refunded_at?: string | null;
          status: string;
          stripe_payment_intent_id?: string | null;
          stripe_session_id: string;
          user_id?: string | null;
        };
        Update: {
          amount_cents?: number;
          currency?: string;
          id?: string;
          paid_at?: string;
          refunded_at?: string | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          email_reminders: boolean;
          id: string;
          onboarded_at: string | null;
          paid_until: string | null;
          time_zone: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string;
          email_reminders?: boolean;
          id: string;
          onboarded_at?: string | null;
          paid_until?: string | null;
          time_zone?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          email_reminders?: boolean;
          id?: string;
          onboarded_at?: string | null;
          paid_until?: string | null;
          time_zone?: string;
        };
        Relationships: [];
      };
      recipients: {
        Row: {
          age_range: Database["public"]["Enums"]["age_range"] | null;
          archived_at: string | null;
          budget_cents: number | null;
          created_at: string;
          created_by: string | null;
          dont_buy_notes: string;
          id: string;
          interests: string[];
          linked_user_id: string | null;
          list_id: string;
          name: string;
          notes: string;
          relationship: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          age_range?: Database["public"]["Enums"]["age_range"] | null;
          archived_at?: string | null;
          budget_cents?: number | null;
          created_at?: string;
          created_by?: string | null;
          dont_buy_notes?: string;
          id?: string;
          interests?: string[];
          linked_user_id?: string | null;
          list_id: string;
          name: string;
          notes?: string;
          relationship?: string;
          updated_at?: string;
        };
        Update: {
          age_range?: Database["public"]["Enums"]["age_range"] | null;
          archived_at?: string | null;
          budget_cents?: number | null;
          created_at?: string;
          created_by?: string | null;
          dont_buy_notes?: string;
          id?: string;
          interests?: string[];
          linked_user_id?: string | null;
          list_id?: string;
          name?: string;
          notes?: string;
          relationship?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipients_linked_user_id_fkey";
            columns: ["linked_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipients_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_log: {
        Row: {
          gift_ids: string[];
          local_date: string;
          sent_at: string | null;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          gift_ids: string[];
          local_date: string;
          sent_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          gift_ids?: string[];
          local_date?: string;
          sent_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          processed_at: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          id: string;
          processed_at?: string;
          type: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
          type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string };
      list_member_names: {
        Args: { p_list: string };
        Returns: {
          display_name: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        }[];
      };
      list_plan: {
        Args: { p_list: string };
        Returns: {
          has_pass: boolean;
          member_count: number;
          recipient_count: number;
        }[];
      };
      set_gift_status: {
        Args: { p_gift: string; p_status: Database["public"]["Enums"]["gift_status"] };
        Returns: undefined;
      };
    };
    Enums: {
      age_range: "baby" | "toddler" | "kid" | "tween" | "teen" | "young_adult" | "adult" | "senior";
      ai_kind: "initial" | "more_like_this" | "different_direction";
      ai_status: "pending" | "success" | "failed";
      gift_status: "idea" | "bought" | "wrapped" | "given";
      member_role: "owner" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      age_range: ["baby", "toddler", "kid", "tween", "teen", "young_adult", "adult", "senior"],
      ai_kind: ["initial", "more_like_this", "different_direction"],
      ai_status: ["pending", "success", "failed"],
      gift_status: ["idea", "bought", "wrapped", "given"],
      member_role: ["owner", "member"],
    },
  },
} as const;
