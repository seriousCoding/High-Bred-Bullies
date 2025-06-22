
-- Update the social_feed_posts view to show public posts to everyone
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
    sp.visibility,
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
    -- Show approved public posts to everyone (authenticated or not)
    (sp.visibility = 'public' AND sp.moderation_status = 'approved')
    OR 
    -- Show all posts (public and private) to their owners when authenticated
    (auth.uid() IS NOT NULL AND sp.user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Grant access to the updated view for both authenticated and anonymous users
GRANT SELECT ON public.social_feed_posts TO authenticated;
GRANT SELECT ON public.social_feed_posts TO anon;
