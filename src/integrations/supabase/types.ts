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
      admin_settings: {
        Row: {
          global_multiplier: number
          id: number
          maintenance_mode: boolean
          updated_at: string
        }
        Insert: {
          global_multiplier?: number
          id?: number
          maintenance_mode?: boolean
          updated_at?: string
        }
        Update: {
          global_multiplier?: number
          id?: number
          maintenance_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      booster_action_rules: {
        Row: {
          action: string
          bonus: number
          booster_id: string
          created_at: string
          id: string
          multiplier: number
        }
        Insert: {
          action: string
          bonus?: number
          booster_id: string
          created_at?: string
          id?: string
          multiplier?: number
        }
        Update: {
          action?: string
          bonus?: number
          booster_id?: string
          created_at?: string
          id?: string
          multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "booster_action_rules_booster_id_fkey"
            columns: ["booster_id"]
            isOneToOne: false
            referencedRelation: "boosters"
            referencedColumns: ["id"]
          },
        ]
      }
      booster_activity_log: {
        Row: {
          action: string
          base_points: number
          bonus_points: number
          booster_id: string
          created_at: string
          id: string
          total_points: number
          user_id: string
        }
        Insert: {
          action: string
          base_points?: number
          bonus_points?: number
          booster_id: string
          created_at?: string
          id?: string
          total_points?: number
          user_id: string
        }
        Update: {
          action?: string
          base_points?: number
          bonus_points?: number
          booster_id?: string
          created_at?: string
          id?: string
          total_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booster_activity_log_booster_id_fkey"
            columns: ["booster_id"]
            isOneToOne: false
            referencedRelation: "boosters"
            referencedColumns: ["id"]
          },
        ]
      }
      booster_tier_rules: {
        Row: {
          bonus: number
          booster_id: string
          created_at: string
          id: string
          multiplier: number
          tier: string
        }
        Insert: {
          bonus?: number
          booster_id: string
          created_at?: string
          id?: string
          multiplier?: number
          tier: string
        }
        Update: {
          bonus?: number
          booster_id?: string
          created_at?: string
          id?: string
          multiplier?: number
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "booster_tier_rules_booster_id_fkey"
            columns: ["booster_id"]
            isOneToOne: false
            referencedRelation: "boosters"
            referencedColumns: ["id"]
          },
        ]
      }
      booster_user_targets: {
        Row: {
          booster_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          booster_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          booster_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booster_user_targets_booster_id_fkey"
            columns: ["booster_id"]
            isOneToOne: false
            referencedRelation: "boosters"
            referencedColumns: ["id"]
          },
        ]
      }
      boosters: {
        Row: {
          active: boolean
          bonus_value: number
          brand_id: string | null
          created_at: string
          description: string | null
          end_at: string | null
          id: string
          multiplier_value: number
          name: string
          required_action: string
          required_tier: string
          start_at: string
          type: string
        }
        Insert: {
          active?: boolean
          bonus_value?: number
          brand_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          multiplier_value?: number
          name: string
          required_action?: string
          required_tier?: string
          start_at?: string
          type?: string
        }
        Update: {
          active?: boolean
          bonus_value?: number
          brand_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          multiplier_value?: number
          name?: string
          required_action?: string
          required_tier?: string
          start_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "boosters_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_gem_mapping: {
        Row: {
          brand_id: string
          gem_id: string
          id: string
          linked_at: string
          location_id: string
          source_id: string | null
          status: string
        }
        Insert: {
          brand_id: string
          gem_id: string
          id?: string
          linked_at?: string
          location_id: string
          source_id?: string | null
          status?: string
        }
        Update: {
          brand_id?: string
          gem_id?: string
          id?: string
          linked_at?: string
          location_id?: string
          source_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_gem_mapping_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_locations: {
        Row: {
          address_line: string | null
          brand_id: string
          city: string | null
          country: string | null
          created_at: string
          geofence_radius_meters: number
          geometry: unknown
          id: string
          is_headquarters: boolean
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          address_line?: string | null
          brand_id: string
          city?: string | null
          country?: string | null
          created_at?: string
          geofence_radius_meters?: number
          geometry?: unknown
          id?: string
          is_headquarters?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line?: string | null
          brand_id?: string
          city?: string | null
          country?: string | null
          created_at?: string
          geofence_radius_meters?: number
          geometry?: unknown
          id?: string
          is_headquarters?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_locations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_settings: {
        Row: {
          brand_id: string
          earn_rate: number
          id: string
          redemption_rate: number
          tier_thresholds: Json | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          earn_rate?: number
          id?: string
          redemption_rate?: number
          tier_thresholds?: Json | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          earn_rate?: number
          id?: string
          redemption_rate?: number
          tier_thresholds?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_settings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_visits: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_visits_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          address_line: string | null
          api_field_name: string | null
          category: string | null
          created_at: string
          geofence_radius_meters: number
          id: string
          latitude: number | null
          logo_emoji: string
          longitude: number | null
          loyalty_api_url: string | null
          loyalty_provider: string | null
          milestone_points: number
          milestone_visits: number
          name: string
          visit_expiry_months: number
          website_url: string | null
        }
        Insert: {
          address_line?: string | null
          api_field_name?: string | null
          category?: string | null
          created_at?: string
          geofence_radius_meters?: number
          id?: string
          latitude?: number | null
          logo_emoji?: string
          longitude?: number | null
          loyalty_api_url?: string | null
          loyalty_provider?: string | null
          milestone_points?: number
          milestone_visits?: number
          name: string
          visit_expiry_months?: number
          website_url?: string | null
        }
        Update: {
          address_line?: string | null
          api_field_name?: string | null
          category?: string | null
          created_at?: string
          geofence_radius_meters?: number
          id?: string
          latitude?: number | null
          logo_emoji?: string
          longitude?: number | null
          loyalty_api_url?: string | null
          loyalty_provider?: string | null
          milestone_points?: number
          milestone_visits?: number
          name?: string
          visit_expiry_months?: number
          website_url?: string | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon_name: string
          id: string
          name: string
          requirement: number
          reward_points: number
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon_name?: string
          id?: string
          name: string
          requirement?: number
          reward_points?: number
          type?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon_name?: string
          id?: string
          name?: string
          requirement?: number
          reward_points?: number
          type?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      external_loyalty_connections: {
        Row: {
          access_token: string | null
          api_endpoint: string | null
          brand_id: string
          created_at: string
          external_member_id: string | null
          external_points_balance: number | null
          id: string
          last_synced_at: string | null
          provider_name: string
          refresh_token: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          api_endpoint?: string | null
          brand_id: string
          created_at?: string
          external_member_id?: string | null
          external_points_balance?: number | null
          id?: string
          last_synced_at?: string | null
          provider_name: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          api_endpoint?: string | null
          brand_id?: string
          created_at?: string
          external_member_id?: string | null
          external_points_balance?: number | null
          id?: string
          last_synced_at?: string | null
          provider_name?: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_loyalty_connections_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_brands: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          job_id: string
          source_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          job_id: string
          source_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          job_id?: string
          source_id?: string | null
        }
        Relationships: []
      }
      geofence_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json | null
          id: string
          job_id: string
          review_csv_url: string | null
          source_id: string
          status: string
          summary: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          job_id: string
          review_csv_url?: string | null
          source_id: string
          status?: string
          summary?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json | null
          id?: string
          job_id?: string
          review_csv_url?: string | null
          source_id?: string
          status?: string
          summary?: Json | null
        }
        Relationships: []
      }
      geofences: {
        Row: {
          active_hours: Json | null
          brand_id: string
          brand_location_id: string | null
          created_at: string
          dwell_seconds: number | null
          geofence_id: string
          geometry: unknown
          id: string
          import_hash: string | null
          location_id: string
          metadata: Json | null
          polygon_coords: Json | null
          priority: number
          radius_m: number
          source_id: string | null
          status: string
          triggers: string[]
          type: string
          updated_at: string
        }
        Insert: {
          active_hours?: Json | null
          brand_id: string
          brand_location_id?: string | null
          created_at?: string
          dwell_seconds?: number | null
          geofence_id: string
          geometry?: unknown
          id?: string
          import_hash?: string | null
          location_id: string
          metadata?: Json | null
          polygon_coords?: Json | null
          priority?: number
          radius_m?: number
          source_id?: string | null
          status?: string
          triggers?: string[]
          type?: string
          updated_at?: string
        }
        Update: {
          active_hours?: Json | null
          brand_id?: string
          brand_location_id?: string | null
          created_at?: string
          dwell_seconds?: number | null
          geofence_id?: string
          geometry?: unknown
          id?: string
          import_hash?: string | null
          location_id?: string
          metadata?: Json | null
          polygon_coords?: Json | null
          priority?: number
          radius_m?: number
          source_id?: string | null
          status?: string
          triggers?: string[]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofences_brand_location_id_fkey"
            columns: ["brand_location_id"]
            isOneToOne: false
            referencedRelation: "brand_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          balance_after: number
          created_at: string
          delta_points: number
          expires_at: string | null
          external_txn_id: string | null
          id: string
          idempotency_key: string | null
          merchant_id: string
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta_points: number
          expires_at?: string | null
          external_txn_id?: string | null
          id?: string
          idempotency_key?: string | null
          merchant_id: string
          metadata?: Json | null
          type: string
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta_points?: number
          expires_at?: string | null
          external_txn_id?: string | null
          id?: string
          idempotency_key?: string | null
          merchant_id?: string
          metadata?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_users: {
        Row: {
          created_at: string
          id: string
          merchant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_users_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          category: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          provider: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          provider?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          provider?: string | null
        }
        Relationships: []
      }
      nest_activities: {
        Row: {
          created_at: string
          id: string
          points: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_steps: {
        Row: {
          active: boolean
          color_class: string
          created_at: string
          description: string
          icon_name: string
          id: string
          sort_order: number
          step_type: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color_class?: string
          created_at?: string
          description?: string
          icon_name?: string
          id?: string
          sort_order?: number
          step_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color_class?: string
          created_at?: string
          description?: string
          icon_name?: string
          id?: string
          sort_order?: number
          step_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_access: {
        Row: {
          allowed: boolean
          id: string
          page_key: string
          page_label: string
          role_name: string
        }
        Insert: {
          allowed?: boolean
          id?: string
          page_key: string
          page_label: string
          role_name: string
        }
        Update: {
          allowed?: boolean
          id?: string
          page_key?: string
          page_label?: string
          role_name?: string
        }
        Relationships: []
      }
      privacy_policies: {
        Row: {
          content_markdown: string
          created_at: string
          id: string
          published_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          content_markdown: string
          created_at?: string
          id?: string
          published_at?: string
          updated_by?: string | null
          version: string
        }
        Update: {
          content_markdown?: string
          created_at?: string
          id?: string
          published_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          challenges_completed: number
          city: string | null
          created_at: string
          display_name: string | null
          id: string
          last_check_in: string | null
          nest_points: number
          onboarding_completed: boolean
          phone: string | null
          state: string | null
          streak_count: number
          tier: string
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          challenges_completed?: number
          city?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_check_in?: string | null
          nest_points?: number
          onboarding_completed?: boolean
          phone?: string | null
          state?: string | null
          streak_count?: number
          tier?: string
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          challenges_completed?: number
          city?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_check_in?: string | null
          nest_points?: number
          onboarding_completed?: boolean
          phone?: string | null
          state?: string | null
          streak_count?: number
          tier?: string
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      quick_actions: {
        Row: {
          color_class: string
          created_at: string
          icon_name: string
          id: string
          label: string
          route: string
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          color_class?: string
          created_at?: string
          icon_name?: string
          id?: string
          label: string
          route: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          color_class?: string
          created_at?: string
          icon_name?: string
          id?: string
          label?: string
          route?: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          created_at: string
          external_txn_id: string | null
          id: string
          merchant_id: string
          points_spent: number
          reward_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_txn_id?: string | null
          id?: string
          merchant_id: string
          points_spent: number
          reward_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_txn_id?: string | null
          id?: string
          merchant_id?: string
          points_spent?: number
          reward_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          inventory: number | null
          merchant_id: string
          points_cost: number
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          inventory?: number | null
          merchant_id: string
          points_cost: number
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          inventory?: number | null
          merchant_id?: string
          points_cost?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      subscription_features: {
        Row: {
          created_at: string
          description: string | null
          feature_key: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          feature_key: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          feature_key?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      subscription_tiers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          interval: string
          is_free: boolean
          name: string
          price_cents: number
          price_label: string
          slug: string
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          interval?: string
          is_free?: boolean
          name: string
          price_cents?: number
          price_label?: string
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          interval?: string
          is_free?: boolean
          name?: string
          price_cents?: number
          price_label?: string
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          message: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      tier_feature_access: {
        Row: {
          enabled: boolean
          feature_id: string
          id: string
          tier_id: string
        }
        Insert: {
          enabled?: boolean
          feature_id: string
          id?: string
          tier_id: string
        }
        Update: {
          enabled?: boolean
          feature_id?: string
          id?: string
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_feature_access_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "subscription_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier_feature_access_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_progression: {
        Row: {
          brand_id: string
          current_tier: string
          id: string
          lifetime_spend: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          current_tier?: string
          id?: string
          lifetime_spend?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          current_tier?: string
          id?: string
          lifetime_spend?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_progression_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          brand_id: string
          created_at: string
          id: string
          points_earned: number
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          brand_id: string
          created_at?: string
          id?: string
          points_earned?: number
          source?: string
          user_id: string
        }
        Update: {
          amount?: number
          brand_id?: string
          created_at?: string
          id?: string
          points_earned?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted: boolean
          accepted_at: string
          id: string
          metadata: Json | null
          policy_version: string
          user_id: string
        }
        Insert: {
          accepted: boolean
          accepted_at?: string
          id?: string
          metadata?: Json | null
          policy_version: string
          user_id: string
        }
        Update: {
          accepted?: boolean
          accepted_at?: string
          id?: string
          metadata?: Json | null
          policy_version?: string
          user_id?: string
        }
        Relationships: []
      }
      user_merchants: {
        Row: {
          id: string
          linked_at: string
          merchant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          linked_at?: string
          merchant_id: string
          user_id: string
        }
        Update: {
          id?: string
          linked_at?: string
          merchant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_merchants_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          role_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          role_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_merchant_id: { Args: { _user_id: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_merchant_member: {
        Args: { _merchant_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
