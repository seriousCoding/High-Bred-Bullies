export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      badges: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          requirements: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          requirements?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          requirements?: Json | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          category: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          category: string
          content: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      breeder_subscriptions: {
        Row: {
          breeder_id: string | null
          created_at: string
          id: string
          is_trial_active: boolean | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          breeder_id?: string | null
          created_at?: string
          id?: string
          is_trial_active?: boolean | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          breeder_id?: string | null
          created_at?: string
          id?: string
          is_trial_active?: boolean | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeder_subscriptions_breeder_id_fkey"
            columns: ["breeder_id"]
            isOneToOne: false
            referencedRelation: "breeders"
            referencedColumns: ["id"]
          },
        ]
      }
      breeders: {
        Row: {
          address: string | null
          breeder_type: Database["public"]["Enums"]["breeder_type"] | null
          business_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          delivery_areas: string[] | null
          delivery_fee: number | null
          id: string
          is_verified: boolean | null
          stripe_secret_key: string | null
          subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          breeder_type?: Database["public"]["Enums"]["breeder_type"] | null
          business_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          delivery_areas?: string[] | null
          delivery_fee?: number | null
          id?: string
          is_verified?: boolean | null
          stripe_secret_key?: string | null
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          breeder_type?: Database["public"]["Enums"]["breeder_type"] | null
          business_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          delivery_areas?: string[] | null
          delivery_fee?: number | null
          id?: string
          is_verified?: boolean | null
          stripe_secret_key?: string | null
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breeders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "breeder_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          receiver_id: string
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          breeder_id: string
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          min_purchase_amount: number | null
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          breeder_id: string
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          min_purchase_amount?: number | null
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          breeder_id?: string
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          min_purchase_amount?: number | null
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_breeder_id_fkey"
            columns: ["breeder_id"]
            isOneToOne: false
            referencedRelation: "breeders"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string | null
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      high_table_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invited_email: string
          invited_user_id: string | null
          inviter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_email: string
          invited_user_id?: string | null
          inviter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_email?: string
          invited_user_id?: string | null
          inviter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "high_table_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "high_table_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          created_at: string
          email: string | null
          id: string
          litter_id: string | null
          message: string
          name: string | null
          response: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          litter_id?: string | null
          message: string
          name?: string | null
          response?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          litter_id?: string | null
          message?: string
          name?: string | null
          response?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_litter_id_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
        ]
      }
      litters: {
        Row: {
          available_puppies: number
          birth_date: string
          breed: string
          breeder_id: string | null
          created_at: string | null
          dam_image_url: string | null
          dam_name: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_per_female: number
          price_per_male: number
          quantity_discounts: Json | null
          sire_image_url: string | null
          sire_name: string
          status: string
          stripe_female_price_id: string | null
          stripe_male_price_id: string | null
          stripe_product_id: string | null
          total_puppies: number
          updated_at: string | null
        }
        Insert: {
          available_puppies?: number
          birth_date: string
          breed: string
          breeder_id?: string | null
          created_at?: string | null
          dam_image_url?: string | null
          dam_name: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_per_female?: number
          price_per_male?: number
          quantity_discounts?: Json | null
          sire_image_url?: string | null
          sire_name: string
          status?: string
          stripe_female_price_id?: string | null
          stripe_male_price_id?: string | null
          stripe_product_id?: string | null
          total_puppies?: number
          updated_at?: string | null
        }
        Update: {
          available_puppies?: number
          birth_date?: string
          breed?: string
          breeder_id?: string | null
          created_at?: string | null
          dam_image_url?: string | null
          dam_name?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_per_female?: number
          price_per_male?: number
          quantity_discounts?: Json | null
          sire_image_url?: string | null
          sire_name?: string
          status?: string
          stripe_female_price_id?: string | null
          stripe_male_price_id?: string | null
          stripe_product_id?: string | null
          total_puppies?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "litters_breeder_id_fkey"
            columns: ["breeder_id"]
            isOneToOne: false
            referencedRelation: "breeders"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_found_pets: {
        Row: {
          age_estimate: string | null
          breed: string | null
          color: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          description: string
          id: string
          image_url: string | null
          last_seen_date: string | null
          location: string
          pet_name: string
          pet_type: string
          reward_amount: number | null
          size: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          age_estimate?: string | null
          breed?: string | null
          color?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          last_seen_date?: string | null
          location: string
          pet_name: string
          pet_type?: string
          reward_amount?: number | null
          size?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          age_estimate?: string | null
          breed?: string | null
          color?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          last_seen_date?: string | null
          location?: string
          pet_name?: string
          pet_type?: string
          reward_amount?: number | null
          size?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      newsletter_subscriptions: {
        Row: {
          email: string
          id: string
          preferences: Json | null
          subscribed_at: string
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          preferences?: Json | null
          subscribed_at?: string
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          preferences?: Json | null
          subscribed_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          puppy_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          puppy_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          puppy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_breeder_contacts"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_puppy_id_fkey"
            columns: ["puppy_id"]
            isOneToOne: false
            referencedRelation: "puppies"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          delivery_address: string | null
          delivery_cost: number | null
          delivery_option: string | null
          delivery_type: string
          delivery_zip_code: string | null
          discount_amount: number | null
          discount_id: string | null
          id: string
          notes: string | null
          scheduled_date: string | null
          scheduling_confirmed_by_breeder: boolean | null
          scheduling_confirmed_by_user: boolean | null
          scheduling_deadline: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_amount: number | null
          total_amount: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_address?: string | null
          delivery_cost?: number | null
          delivery_option?: string | null
          delivery_type: string
          delivery_zip_code?: string | null
          discount_amount?: number | null
          discount_id?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          scheduling_confirmed_by_breeder?: boolean | null
          scheduling_confirmed_by_user?: boolean | null
          scheduling_deadline?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_amount?: number | null
          total_amount: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_address?: string | null
          delivery_cost?: number | null
          delivery_option?: string | null
          delivery_type?: string
          delivery_zip_code?: string | null
          discount_amount?: number | null
          discount_id?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          scheduling_confirmed_by_breeder?: boolean | null
          scheduling_confirmed_by_user?: boolean | null
          scheduling_deadline?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_amount?: number | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_owners: {
        Row: {
          adoption_date: string | null
          birth_date: string | null
          created_at: string
          id: string
          pet_name: string | null
          puppy_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          adoption_date?: string | null
          birth_date?: string | null
          created_at?: string
          id?: string
          pet_name?: string | null
          puppy_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          adoption_date?: string | null
          birth_date?: string | null
          created_at?: string
          id?: string
          pet_name?: string | null
          puppy_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_owners_puppy_id_fkey"
            columns: ["puppy_id"]
            isOneToOne: false
            referencedRelation: "puppies"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_reminders: {
        Row: {
          created_at: string
          id: string
          order_id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_reminders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_breeder_contacts"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "pickup_reminders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      puppies: {
        Row: {
          color: string
          created_at: string | null
          current_weight: number | null
          gender: string
          health_status: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          litter_id: string | null
          markings: string | null
          name: string | null
          notes: string | null
          reserved_by: string | null
          sold_to: string | null
          stripe_price_id: string | null
          updated_at: string | null
          weight_at_birth: number | null
        }
        Insert: {
          color: string
          created_at?: string | null
          current_weight?: number | null
          gender: string
          health_status?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          litter_id?: string | null
          markings?: string | null
          name?: string | null
          notes?: string | null
          reserved_by?: string | null
          sold_to?: string | null
          stripe_price_id?: string | null
          updated_at?: string | null
          weight_at_birth?: number | null
        }
        Update: {
          color?: string
          created_at?: string | null
          current_weight?: number | null
          gender?: string
          health_status?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          litter_id?: string | null
          markings?: string | null
          name?: string | null
          notes?: string | null
          reserved_by?: string | null
          sold_to?: string | null
          stripe_price_id?: string | null
          updated_at?: string | null
          weight_at_birth?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "puppies_litter_id_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
        ]
      }
      site_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      social_post_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          comments_count: number
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          is_testimonial: boolean | null
          likes_count: number | null
          media_type:
            | Database["public"]["Enums"]["social_post_media_type"]
            | null
          moderation_status:
            | Database["public"]["Enums"]["social_post_moderation_status"]
            | null
          pet_owner_id: string | null
          rejection_reason: string | null
          title: string
          updated_at: string
          user_id: string | null
          visibility: Database["public"]["Enums"]["social_post_visibility"]
        }
        Insert: {
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_testimonial?: boolean | null
          likes_count?: number | null
          media_type?:
            | Database["public"]["Enums"]["social_post_media_type"]
            | null
          moderation_status?:
            | Database["public"]["Enums"]["social_post_moderation_status"]
            | null
          pet_owner_id?: string | null
          rejection_reason?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
          visibility?: Database["public"]["Enums"]["social_post_visibility"]
        }
        Update: {
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_testimonial?: boolean | null
          likes_count?: number | null
          media_type?:
            | Database["public"]["Enums"]["social_post_media_type"]
            | null
          moderation_status?:
            | Database["public"]["Enums"]["social_post_moderation_status"]
            | null
          pet_owner_id?: string | null
          rejection_reason?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          visibility?: Database["public"]["Enums"]["social_post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_pet_owner_id_fkey"
            columns: ["pet_owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string | null
          earned_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          badge_id?: string | null
          earned_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          badge_id?: string | null
          earned_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sent_at: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sent_at?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sent_at?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          breeding_experience: string | null
          can_view_contact_info: boolean | null
          city: string | null
          created_at: string | null
          facebook: string | null
          favorite_breeds: string[] | null
          first_name: string | null
          id: string
          instagram: string | null
          is_admin: boolean | null
          is_validated: boolean | null
          last_name: string | null
          phone: string | null
          specializations: string[] | null
          state: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
          validation_date: string | null
          validation_notes: string | null
          website: string | null
          years_with_dogs: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          breeding_experience?: string | null
          can_view_contact_info?: boolean | null
          city?: string | null
          created_at?: string | null
          facebook?: string | null
          favorite_breeds?: string[] | null
          first_name?: string | null
          id?: string
          instagram?: string | null
          is_admin?: boolean | null
          is_validated?: boolean | null
          last_name?: string | null
          phone?: string | null
          specializations?: string[] | null
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
          validation_date?: string | null
          validation_notes?: string | null
          website?: string | null
          years_with_dogs?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          breeding_experience?: string | null
          can_view_contact_info?: boolean | null
          city?: string | null
          created_at?: string | null
          facebook?: string | null
          favorite_breeds?: string[] | null
          first_name?: string | null
          id?: string
          instagram?: string | null
          is_admin?: boolean | null
          is_validated?: boolean | null
          last_name?: string | null
          phone?: string | null
          specializations?: string[] | null
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
          validation_date?: string | null
          validation_notes?: string | null
          website?: string | null
          years_with_dogs?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      order_breeder_contacts: {
        Row: {
          breeder_email: string | null
          breeder_name: string | null
          breeder_phone: string | null
          order_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      social_feed_posts: {
        Row: {
          avatar_url: string | null
          comments_count: number | null
          content: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          image_url: string | null
          is_testimonial: boolean | null
          last_name: string | null
          liked_by_user: boolean | null
          likes_count: number | null
          moderation_status:
            | Database["public"]["Enums"]["social_post_moderation_status"]
            | null
          title: string | null
          user_id: string | null
          username: string | null
          visibility:
            | Database["public"]["Enums"]["social_post_visibility"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_breeder_access: {
        Args: { breeder_user_id: string }
        Returns: {
          has_access: boolean
          breeder_type: Database["public"]["Enums"]["breeder_type"]
          is_trial_active: boolean
          trial_days_remaining: number
          subscription_status: string
        }[]
      }
      create_blog_post_from_ai: {
        Args:
          | {
              post_title: string
              post_content: string
              post_excerpt: string
              post_category: string
            }
          | {
              post_title: string
              post_content: string
              post_excerpt: string
              post_category: string
              post_image_url: string
              post_author_name: string
            }
        Returns: undefined
      }
      create_test_posts_for_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_admin_archived_orders: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          status: string
          total_amount: number
          delivery_type: string
          created_at: string
          updated_at: string
          customer_name: string
          puppy_names: string
          puppy_count: number
        }[]
      }
      get_admin_orders: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          status: string
          total_amount: number
          delivery_type: string
          created_at: string
          customer_name: string
          puppy_names: string
          puppy_count: number
        }[]
      }
      get_user_email: {
        Args: { user_uuid: string }
        Returns: string
      }
      is_breeder_for_order: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      to_utc_date: {
        Args: { ts: string }
        Returns: string
      }
    }
    Enums: {
      breeder_type: "site_admin" | "subscription_breeder"
      social_post_media_type: "image" | "video"
      social_post_moderation_status: "pending" | "approved" | "rejected"
      social_post_visibility: "public" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      breeder_type: ["site_admin", "subscription_breeder"],
      social_post_media_type: ["image", "video"],
      social_post_moderation_status: ["pending", "approved", "rejected"],
      social_post_visibility: ["public", "private"],
    },
  },
} as const
