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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assigned_drills: {
        Row: {
          created_at: string | null
          drill_name: string
          due_at: string | null
          id: string
          notes: string | null
          player_id: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          drill_name: string
          due_at?: string | null
          id?: string
          notes?: string | null
          player_id?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          drill_name?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          player_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assigned_drills_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          bat_length_in: number | null
          created_at: string | null
          dob: string | null
          handedness: string | null
          height_cm: number | null
          id: string
          name: string | null
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          bat_length_in?: number | null
          created_at?: string | null
          dob?: string | null
          handedness?: string | null
          height_cm?: number | null
          id?: string
          name?: string | null
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          bat_length_in?: number | null
          created_at?: string | null
          dob?: string | null
          handedness?: string | null
          height_cm?: number | null
          id?: string
          name?: string | null
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      drills: {
        Row: {
          equipment: string | null
          goal_metric: string | null
          how_to: string | null
          id: string
          name: string | null
          video_url: string | null
        }
        Insert: {
          equipment?: string | null
          goal_metric?: string | null
          how_to?: string | null
          id?: string
          name?: string | null
          video_url?: string | null
        }
        Update: {
          equipment?: string | null
          goal_metric?: string | null
          how_to?: string | null
          id?: string
          name?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_streak: number | null
          current_team: string | null
          email: string | null
          full_name: string | null
          height_feet: number | null
          height_inches: number | null
          id: string
          last_session_date: string | null
          primary_position: string | null
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_streak?: number | null
          current_team?: string | null
          email?: string | null
          full_name?: string | null
          height_feet?: number | null
          height_inches?: number | null
          id: string
          last_session_date?: string | null
          primary_position?: string | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_streak?: number | null
          current_team?: string | null
          email?: string | null
          full_name?: string | null
          height_feet?: number | null
          height_inches?: number | null
          id?: string
          last_session_date?: string | null
          primary_position?: string | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          athlete_id: string | null
          camera_fps: number | null
          created_at: string | null
          id: string
          notes: string | null
          view: string | null
        }
        Insert: {
          athlete_id?: string | null
          camera_fps?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          view?: string | null
        }
        Update: {
          athlete_id?: string | null
          camera_fps?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          view?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      swing_metrics: {
        Row: {
          id: number
          metric: string | null
          phase: number | null
          swing_id: string | null
          unit: string | null
          value: number | null
        }
        Insert: {
          id?: number
          metric?: string | null
          phase?: number | null
          swing_id?: string | null
          unit?: string | null
          value?: number | null
        }
        Update: {
          id?: number
          metric?: string | null
          phase?: number | null
          swing_id?: string | null
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "swing_metrics_swing_id_fkey"
            columns: ["swing_id"]
            isOneToOne: false
            referencedRelation: "swings"
            referencedColumns: ["id"]
          },
        ]
      }
      swing_videos: {
        Row: {
          content_type: string
          created_at: string | null
          file_size: number
          filename: string
          id: string
          public_url: string
          s3_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_type: string
          created_at?: string | null
          file_size: number
          filename: string
          id?: string
          public_url: string
          s3_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_type?: string
          created_at?: string | null
          file_size?: number
          filename?: string
          id?: string
          public_url?: string
          s3_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      swings: {
        Row: {
          bat_speed_avg: number | null
          bat_speed_peak: number | null
          client_request_id: string | null
          created_at: string | null
          cues: Json | null
          drill_data: Json | null
          drill_id: string | null
          id: string
          pose_data: Json | null
          score_phase1: number | null
          session_id: string | null
          video_url: string | null
        }
        Insert: {
          bat_speed_avg?: number | null
          bat_speed_peak?: number | null
          client_request_id?: string | null
          created_at?: string | null
          cues?: Json | null
          drill_data?: Json | null
          drill_id?: string | null
          id?: string
          pose_data?: Json | null
          score_phase1?: number | null
          session_id?: string | null
          video_url?: string | null
        }
        Update: {
          bat_speed_avg?: number | null
          bat_speed_peak?: number | null
          client_request_id?: string | null
          created_at?: string | null
          cues?: Json | null
          drill_data?: Json | null
          drill_id?: string | null
          id?: string
          pose_data?: Json | null
          score_phase1?: number | null
          session_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          pinned: boolean | null
          sender_id: string | null
          sender_name: string | null
          sender_role: string | null
          team_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          pinned?: boolean | null
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string | null
          team_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          pinned?: boolean | null
          sender_id?: string | null
          sender_name?: string | null
          sender_role?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          invite_code: string
          logo_url: string | null
          name: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          invite_code?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          invite_code?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_team_coach: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      update_user_streak: {
        Args: { user_id_param: string }
        Returns: undefined
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
