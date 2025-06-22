
-- Add social posting capabilities to user_profiles table
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS facebook text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS breeding_experience text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS favorite_breeds text[];
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS years_with_dogs integer;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS specializations text[];

-- Enable RLS on social_posts table if not already enabled
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for social_posts
CREATE POLICY "Users can view approved social posts" ON public.social_posts
FOR SELECT USING (moderation_status = 'approved' OR user_id = auth.uid());

CREATE POLICY "Users can create their own social posts" ON public.social_posts
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social posts" ON public.social_posts
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social posts" ON public.social_posts
FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on social_post_likes table
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for social_post_likes
CREATE POLICY "Users can view all likes" ON public.social_post_likes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create likes" ON public.social_post_likes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON public.social_post_likes
FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on user_profiles table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view all profiles" ON public.user_profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);
