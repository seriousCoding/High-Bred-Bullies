
-- Add avatar_url and username to user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS username TEXT;

-- Populate username for existing users with a unique generated name
UPDATE public.user_profiles up
SET username = sub.username
FROM (
  SELECT
    u.id as user_id,
    lower(split_part(u.email, '@', 1)) || '_' || substr(md5(random()::text), 1, 4) as username
  FROM auth.users u
) as sub
WHERE up.user_id = sub.user_id AND up.username IS NULL;

-- Add a unique constraint to username. This is done after populating to avoid errors.
DO $$
BEGIN
   IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_username_key' AND conrelid = 'public.user_profiles'::regclass
   ) THEN
       ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_username_key UNIQUE (username);
   END IF;
END;
$$;


-- Update the handle_new_user function to populate profile details on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_profiles (user_id, username, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    lower(split_part(NEW.email, '@', 1)) || '_' || substr(md5(random()::text), 1, 4),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$;

-- Create a table for user follows relationship
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Add RLS for user_follows
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see follow relationships" ON public.user_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow/unfollow" ON public.user_follows FOR ALL
USING ( (SELECT user_id FROM public.user_profiles WHERE id = follower_id) = auth.uid() );


-- Add RLS for social_post_likes - assuming user_id refers to auth.users.id
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see all likes" ON public.social_post_likes FOR SELECT USING (true);

-- Allow users to insert/delete their own likes.
CREATE POLICY "Users can like/unlike posts" ON public.social_post_likes FOR ALL
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() );


-- Function and Trigger to update likes_count on social_posts table
CREATE OR REPLACE FUNCTION public.update_social_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.social_posts
    SET likes_count = COALESCE(likes_count, 0) + 1
    WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.social_posts
    SET likes_count = GREATEST(0, COALESCE(likes_count, 1) - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, to avoid errors on re-run
DROP TRIGGER IF EXISTS on_social_post_like_change ON public.social_post_likes;

CREATE TRIGGER on_social_post_like_change
AFTER INSERT OR DELETE ON public.social_post_likes
FOR EACH ROW EXECUTE FUNCTION public.update_social_post_likes_count();
