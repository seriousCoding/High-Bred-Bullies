
-- Create inquiries table for customer inquiries
CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  litter_id UUID REFERENCES public.litters(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create pet_owners table for tracking purchased pets
CREATE TABLE IF NOT EXISTS public.pet_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  puppy_id UUID REFERENCES public.puppies(id) ON DELETE CASCADE,
  pet_name TEXT,
  birth_date DATE,
  adoption_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create social_posts table for pet owner social features
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_owner_id UUID REFERENCES public.pet_owners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create badges table for gamification
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  requirements JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_badges table for tracking earned badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Create blog_posts table for AI-generated content
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE, -- Added UNIQUE constraint here
  content TEXT NOT NULL,
  excerpt TEXT,
  category TEXT NOT NULL CHECK (category IN ('nutrition', 'health', 'training', 'treats', 'general')),
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create newsletter_subscriptions table
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  preferences JSONB DEFAULT '{"litter_notifications": true, "birthday_reminders": true, "health_tips": true}'::jsonb,
  UNIQUE(user_id) -- Assuming user_id should be unique for subscriptions
);

-- Add columns to user_profiles if they don't exist
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS can_view_contact_info BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Enable RLS on tables (if not already enabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Breeders can view orders for their puppies" ON public.orders;
CREATE POLICY "Breeders can view orders for their puppies" ON public.orders
  FOR SELECT USING (puppy_id IN (
    SELECT p.id FROM public.puppies p
    JOIN public.litters l ON p.litter_id = l.id
    JOIN public.breeders b ON l.breeder_id = b.id
    WHERE b.user_id = auth.uid()
  ));

-- RLS Policies for inquiries
DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.inquiries;
CREATE POLICY "Users can view their own inquiries" ON public.inquiries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create inquiries" ON public.inquiries;
CREATE POLICY "Users can create inquiries" ON public.inquiries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Breeders can view inquiries for their litters" ON public.inquiries;
CREATE POLICY "Breeders can view inquiries for their litters" ON public.inquiries
  FOR SELECT USING (litter_id IN (
    SELECT l.id FROM public.litters l
    JOIN public.breeders b ON l.breeder_id = b.id
    WHERE b.user_id = auth.uid()
  ));
  
-- RLS Policies for pet_owners
DROP POLICY IF EXISTS "Users can view their own pets" ON public.pet_owners;
CREATE POLICY "Users can view their own pets" ON public.pet_owners
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own pets" ON public.pet_owners;
CREATE POLICY "Users can manage their own pets" ON public.pet_owners
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for social_posts
DROP POLICY IF EXISTS "Anyone can view social posts" ON public.social_posts;
CREATE POLICY "Anyone can view social posts" ON public.social_posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own posts" ON public.social_posts;
CREATE POLICY "Users can manage their own posts" ON public.social_posts
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for badges
DROP POLICY IF EXISTS "Anyone can view badges" ON public.badges;
CREATE POLICY "Anyone can view badges" ON public.badges
  FOR SELECT USING (true);

-- RLS Policies for user_badges
DROP POLICY IF EXISTS "Users can view their own badges" ON public.user_badges;
CREATE POLICY "Users can view their own badges" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view all user badges" ON public.user_badges;
CREATE POLICY "Anyone can view all user badges" ON public.user_badges
  FOR SELECT USING (true);

-- RLS Policies for blog_posts
DROP POLICY IF EXISTS "Anyone can view published blog posts" ON public.blog_posts;
CREATE POLICY "Anyone can view published blog posts" ON public.blog_posts
  FOR SELECT USING (true);

-- RLS Policies for newsletter_subscriptions
DROP POLICY IF EXISTS "Users can manage their own subscription" ON public.newsletter_subscriptions;
CREATE POLICY "Users can manage their own subscription" ON public.newsletter_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Insert some initial badges
INSERT INTO public.badges (name, description, icon, requirements) VALUES
('First Post', 'Share your first photo of your pet', '📸', '{"posts_count": 1}'),
('Social Butterfly', 'Get 10 likes on your posts', '🦋', '{"total_likes": 10}'),
('Pet Parent', 'Successfully adopt a puppy', '🐕', '{"adopted_pets": 1}'),
('Early Bird', 'One of the first 100 members', '🐦', '{"member_number": 100}'),
('Health Conscious', 'Read 5 health tip articles', '💊', '{"health_articles_read": 5}')
ON CONFLICT (name) DO NOTHING;

-- Insert sample blog post
INSERT INTO public.blog_posts (title, content, excerpt, category) VALUES
('Welcome to Pawsitive Breeders', 'Welcome to our community of dog lovers! Here you''ll find the latest tips on pet care, nutrition, and training. Stay tuned for daily updates from our AI assistant.', 'Get started with essential pet care tips and join our growing community.', 'general')
ON CONFLICT (title) DO NOTHING;

