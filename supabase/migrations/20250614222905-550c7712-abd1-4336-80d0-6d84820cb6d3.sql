
-- Alter blog_posts table to add 'lifestyle' to the category check constraint
-- First, we drop the existing constraint because it cannot be altered directly.
ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_category_check;

-- Then, we add the new constraint with 'lifestyle' included to match our AI generator.
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_category_check
CHECK (category IN ('nutrition', 'health', 'training', 'treats', 'general', 'lifestyle'));

-- Create the missing database function for the AI blog post generator.
-- This function will be called by our edge function to save the new blog post.
CREATE OR REPLACE FUNCTION public.create_blog_post_from_ai(
    post_title TEXT,
    post_content TEXT,
    post_excerpt TEXT,
    post_category TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.blog_posts (title, content, excerpt, category, published_at)
    VALUES (post_title, post_content, post_excerpt, lower(post_category), NULL)
    ON CONFLICT (title) DO NOTHING; -- Avoid errors if a post with the same title is generated again
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
