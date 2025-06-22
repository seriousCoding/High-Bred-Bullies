
-- Enable RLS for the blog_posts table if it's not already
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- RLS: Drop policies if they exist to make the script re-runnable
DROP POLICY IF EXISTS "Public can read published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON public.blog_posts;

-- Policy: Allow public read access to published blog posts
CREATE POLICY "Public can read published blog posts"
ON public.blog_posts
FOR SELECT
USING (published_at IS NOT NULL);

-- Policy: Allow admins (users in the 'breeders' table) to perform any action on any blog post
CREATE POLICY "Admins can manage all blog posts"
ON public.blog_posts
FOR ALL
USING (EXISTS (SELECT 1 FROM public.breeders WHERE user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.breeders WHERE user_id = auth.uid()));
