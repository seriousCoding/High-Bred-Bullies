
-- Fix the RLS policy for social_posts table
-- The issue is that the policy is checking against auth.uid() but the insert is using user_profile.id
-- We need to allow users to insert posts where the user_id matches their profile id

DROP POLICY IF EXISTS "Users can create their own social posts" ON public.social_posts;

-- Create a new policy that allows users to insert posts with their profile id
CREATE POLICY "Users can create their own social posts" ON public.social_posts
FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

-- Also ensure the policy for updates works correctly
DROP POLICY IF EXISTS "Users can update their own social posts" ON public.social_posts;

CREATE POLICY "Users can update their own social posts" ON public.social_posts
FOR UPDATE USING (
  user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

-- And for deletes
DROP POLICY IF EXISTS "Users can delete their own social posts" ON public.social_posts;

CREATE POLICY "Users can delete their own social posts" ON public.social_posts
FOR DELETE USING (
  user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);
