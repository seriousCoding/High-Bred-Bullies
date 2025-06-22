
-- This function is called by the AI blog generator.
-- We are updating it to accept the image_url and author_name fields
-- that the AI now provides, ensuring the generated post can be saved correctly.
CREATE OR REPLACE FUNCTION public.create_blog_post_from_ai(
    post_title TEXT,
    post_content TEXT,
    post_excerpt TEXT,
    post_category TEXT,
    post_image_url TEXT,
    post_author_name TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.blog_posts (title, content, excerpt, category, image_url, author_name, published_at)
    VALUES (post_title, post_content, post_excerpt, lower(post_category), post_image_url, post_author_name, NULL)
    ON CONFLICT (title) DO NOTHING; -- Avoid errors if a post with the same title is generated again
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
