
-- Add comments_count to social_posts table to efficiently track comment numbers
ALTER TABLE public.social_posts
ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0;

-- Create a function to update the comments count on social_posts when comments are added or deleted
CREATE OR REPLACE FUNCTION public.update_social_post_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE social_posts
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE social_posts
    SET comments_count = GREATEST(0, COALESCE(comments_count, 1) - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop trigger if it exists to prevent errors on re-run
DROP TRIGGER IF EXISTS on_social_post_comment_created_or_deleted ON public.social_post_comments;

-- Create a trigger to call the function when a comment is added or removed
CREATE TRIGGER on_social_post_comment_created_or_deleted
AFTER INSERT OR DELETE ON public.social_post_comments
FOR EACH ROW
EXECUTE PROCEDURE public.update_social_post_comments_count();

-- Create a view for the social feed to gather all necessary data efficiently
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
    public.user_profiles up ON sp.user_id = up.user_id
WHERE
    sp.visibility = 'public';

-- Grant access to the new view for logged-in users
GRANT SELECT ON public.social_feed_posts TO authenticated;
