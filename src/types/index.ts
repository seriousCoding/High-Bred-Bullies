export interface SocialPost {
  id: string;
  user_id?: string;
  title: string;
  content?: string;
  image_url?: string;
  likes_count?: number;
  comments_count?: number;
  is_liked_by_user?: boolean;
  created_at: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  is_testimonial?: boolean;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  visibility?: 'public' | 'private';
}

export interface UserProfile {
  id: string;
  user_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  bio?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  breeding_experience?: string;
  favorite_breeds?: string[];
  years_with_dogs?: number;
  specializations?: string[];
  is_validated?: boolean;
  validation_date?: string;
  validation_notes?: string;
  can_view_contact_info?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HighTableInvitation {
  id: string;
  inviter_id: string;
  invited_email: string;
  invited_user_id?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
}

export interface Litter {
  id: string;
  name: string;
  breed: string;
  birth_date: string;
  available_puppies: number;
  total_puppies: number;
  price_per_male: number;
  price_per_female: number;
  image_url?: string;
  dam_image_url?: string;
  sire_image_url?: string;
  dam_name?: string;
  sire_name?: string;
  description?: string;
  status?: 'active' | 'upcoming' | 'sold_out' | 'archived';
  breeder_id?: string;
  breeders?: {
    business_name?: string;
    delivery_fee?: number;
    delivery_areas?: string[];
  };
}

export interface LitterDetail extends Litter {
  puppies: Puppy[];
  quantity_discounts?: QuantityDiscount[];
}

export interface Puppy {
  id: string;
  litter_id: string;
  name?: string;
  gender: 'male' | 'female';
  color: string;
  is_available: boolean;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QuantityDiscount {
  quantity: number;
  discount_percentage: number;
}

export interface NewsletterSubscription {
  id: string;
  email: string;
  subscribed_at: string;
  is_active: boolean;
  preferences?: {
    health_tips?: boolean;
    birthday_reminders?: boolean;
    litter_notifications?: boolean;
  };
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}
