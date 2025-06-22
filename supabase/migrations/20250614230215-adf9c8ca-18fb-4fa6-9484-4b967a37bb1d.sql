
-- Create a new storage bucket for blog images
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', TRUE)
ON CONFLICT (id) DO NOTHING;

-- RLS: We drop policy first to make sure this script is re-runnable
DROP POLICY IF EXISTS "Public read for blog_images" ON storage.objects;
-- RLS: Allow public read access to blog images
CREATE POLICY "Public read for blog_images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'blog-images' );

-- RLS: We drop policy first to make sure this script is re-runnable
DROP POLICY IF EXISTS "Authenticated uploads for blog_images" ON storage.objects;
-- RLS: Allow authenticated uploads to blog images
-- The edge function will use the service role key, which bypasses RLS, but this is good practice
CREATE POLICY "Authenticated uploads for blog_images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'blog-images' AND auth.role() = 'authenticated' );

-- Update the database function to accept image_url and author_name
CREATE OR REPLACE FUNCTION public.create_blog_post_from_ai(
    post_title text,
    post_content text,
    post_excerpt text,
    post_category text,
    post_image_url text,
    post_author_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.blog_posts (title, content, excerpt, category, image_url, author_name, published_at)
    VALUES (post_title, post_content, post_excerpt, lower(post_category), post_image_url, post_author_name, NULL)
    ON CONFLICT (title) DO NOTHING;
END;
$function$
