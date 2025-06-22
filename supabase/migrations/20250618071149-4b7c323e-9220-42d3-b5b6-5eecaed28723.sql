
-- Add missing columns to social_posts table for better content management
ALTER TABLE public.social_posts 
ADD COLUMN IF NOT EXISTS is_testimonial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create invitations table for High Table friend invites
CREATE TABLE IF NOT EXISTS public.high_table_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(inviter_id, invited_email)
);

-- Enable RLS on invitations table
ALTER TABLE public.high_table_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for invitations
CREATE POLICY "Users can view their own invitations" 
ON public.high_table_invitations FOR SELECT 
USING (inviter_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) 
       OR invited_user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Pet owners can create invitations" 
ON public.high_table_invitations FOR INSERT 
WITH CHECK (
  inviter_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) 
  AND EXISTS (SELECT 1 FROM public.pet_owners WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own invitations" 
ON public.high_table_invitations FOR UPDATE 
USING (invited_user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Update social_posts policies to handle testimonials and moderation
DROP POLICY IF EXISTS "Users can view public posts" ON public.social_posts;
CREATE POLICY "Users can view approved public posts or own posts" 
ON public.social_posts FOR SELECT 
USING (
  (visibility = 'public' AND moderation_status = 'approved') 
  OR user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

-- Update the social_feed_posts view to include new fields
DROP VIEW IF EXISTS public.social_feed_posts;
CREATE OR REPLACE VIEW public.social_feed_posts AS
SELECT
    sp.id,
    sp.user_id,
    sp.title,
    sp.content,
    sp.image_url,
    sp.likes_count,
    sp.comments_count,
    sp.created_at,
    sp.is_testimonial,
    sp.moderation_status,
    up.username,
    up.avatar_url,
    up.first_name,
    up.last_name,
    (SELECT EXISTS (
        SELECT 1
        FROM public.social_post_likes spl
        WHERE spl.post_id = sp.id AND spl.user_id = auth.uid()
    )) AS liked_by_user
FROM
    public.social_posts sp
LEFT JOIN
    public.user_profiles up ON sp.user_id = up.id
WHERE
    sp.visibility = 'public' AND sp.moderation_status = 'approved';

-- Grant access to the updated view
GRANT SELECT ON public.social_feed_posts TO authenticated;
GRANT SELECT ON public.high_table_invitations TO authenticated;
GRANT INSERT ON public.high_table_invitations TO authenticated;
GRANT UPDATE ON public.high_table_invitations TO authenticated;
