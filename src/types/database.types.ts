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
      profiles: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          display_name: string | null;
          avatar_url: string | null;
          total_points: number;
          level: number;
          is_anonymous: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          total_points?: number;
          level?: number;
          is_anonymous?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          total_points?: number;
          level?: number;
          is_anonymous?: boolean;
        };
        Relationships: [];
      };

      places: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          name_fi: string | null;
          description: string | null;
          description_fi: string | null;
          category: string;
          lat: number;
          lng: number;
          address: string | null;
          image_url: string | null;
          rating: number | null;
          price_level: number | null;
          tags: string[];
          opening_hours: Json | null;
          website: string | null;
          pricing_info: string | null;
          pricing_items: Json | null;
          phone: string | null;
          email: string | null;
          reservation_url: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          name_fi?: string | null;
          description?: string | null;
          description_fi?: string | null;
          category: string;
          lat: number;
          lng: number;
          address?: string | null;
          image_url?: string | null;
          rating?: number | null;
          price_level?: number | null;
          tags?: string[];
          opening_hours?: Json | null;
          website?: string | null;
          pricing_info?: string | null;
          pricing_items?: Json | null;
          phone?: string | null;
          email?: string | null;
          reservation_url?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          name_fi?: string | null;
          description?: string | null;
          description_fi?: string | null;
          category?: string;
          lat?: number;
          lng?: number;
          address?: string | null;
          image_url?: string | null;
          rating?: number | null;
          price_level?: number | null;
          tags?: string[];
          opening_hours?: Json | null;
          website?: string | null;
          pricing_info?: string | null;
          pricing_items?: Json | null;
          phone?: string | null;
          email?: string | null;
          reservation_url?: string | null;
        };
        Relationships: [];
      };

      trips: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          title: string;
          duration_days: number;
          budget_level: number;
          interests: string[];
          status: "planning" | "active" | "completed";
          start_date: string | null;
          arrival_date: string | null;
          arrival_time: string | null;
          departure_date: string | null;
          departure_time: string | null;
          accommodation_name: string | null;
          accommodation_address: string | null;
          accommodation_lat: number | null;
          accommodation_lng: number | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          title?: string;
          duration_days: number;
          budget_level: number;
          interests: string[];
          status?: "planning" | "active" | "completed";
          start_date?: string | null;
          arrival_date?: string | null;
          arrival_time?: string | null;
          departure_date?: string | null;
          departure_time?: string | null;
          accommodation_name?: string | null;
          accommodation_address?: string | null;
          accommodation_lat?: number | null;
          accommodation_lng?: number | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          title?: string;
          duration_days?: number;
          budget_level?: number;
          interests?: string[];
          status?: "planning" | "active" | "completed";
          start_date?: string | null;
          arrival_date?: string | null;
          arrival_time?: string | null;
          departure_date?: string | null;
          departure_time?: string | null;
          accommodation_name?: string | null;
          accommodation_address?: string | null;
          accommodation_lat?: number | null;
          accommodation_lng?: number | null;
        };
        Relationships: [];
      };

      trip_days: {
        Row: {
          id: string;
          created_at: string;
          trip_id: string;
          day_number: number;
          title: string | null;
          date: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          trip_id: string;
          day_number: number;
          title?: string | null;
          date?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          trip_id?: string;
          day_number?: number;
          title?: string | null;
          date?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_days_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          }
        ];
      };

      trip_activities: {
        Row: {
          id: string;
          created_at: string;
          trip_day_id: string;
          place_id: string | null;
          title: string;
          description: string | null;
          order_index: number;
          duration_minutes: number | null;
          completed: boolean;
          custom_location: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          trip_day_id: string;
          place_id?: string | null;
          title: string;
          description?: string | null;
          order_index?: number;
          duration_minutes?: number | null;
          completed?: boolean;
          custom_location?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          trip_day_id?: string;
          place_id?: string | null;
          title?: string;
          description?: string | null;
          order_index?: number;
          duration_minutes?: number | null;
          completed?: boolean;
          custom_location?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trip_activities_trip_day_id_fkey";
            columns: ["trip_day_id"];
            isOneToOne: false;
            referencedRelation: "trip_days";
            referencedColumns: ["id"];
          }
        ];
      };

      achievements: {
        Row: {
          id: string;
          created_at: string;
          key: string;
          title: string;
          description: string;
          icon: string;
          points: number;
          category: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          key: string;
          title: string;
          description: string;
          icon: string;
          points: number;
          category: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          key?: string;
          title?: string;
          description?: string;
          icon?: string;
          points?: number;
          category?: string;
        };
        Relationships: [];
      };

      user_achievements: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          achievement_id: string;
          unlocked_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          achievement_id?: string;
          unlocked_at?: string;
        };
        Relationships: [];
      };

      points_history: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          points: number;
          reason: string;
          reference_id: string | null;
          reference_type: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          points: number;
          reason: string;
          reference_id?: string | null;
          reference_type?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          points?: number;
          reason?: string;
          reference_id?: string | null;
          reference_type?: string | null;
        };
        Relationships: [];
      };
    };

    Views: { [_ in never]: never };
    Functions: {
      is_admin_user: {
        Args: Record<never, never>;
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

// Convenience aliases — use these instead of Database["public"]["Tables"]["x"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Place = Database["public"]["Tables"]["places"]["Row"];
export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type TripDay = Database["public"]["Tables"]["trip_days"]["Row"];
export type TripActivity = Database["public"]["Tables"]["trip_activities"]["Row"];
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"];
export type UserAchievement = Database["public"]["Tables"]["user_achievements"]["Row"];
export type PointsHistory = Database["public"]["Tables"]["points_history"]["Row"];
