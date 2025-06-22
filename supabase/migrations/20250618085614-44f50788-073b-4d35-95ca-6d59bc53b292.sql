
-- Update the social_feed_posts view to include private posts for the current user
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
    -- Show approved public posts to everyone
    (sp.visibility = 'public' AND sp.moderation_status = 'approved')
    OR 
    -- Show all posts (public and private) to their owners
    (sp.user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Grant access to the updated view
GRANT SELECT ON public.social_feed_posts TO authenticated;

-- Create a function to create test posts for the current user
CREATE OR REPLACE FUNCTION public.create_test_posts_for_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_profile_id uuid;
BEGIN
    -- Get the current user's profile ID
    SELECT id INTO current_profile_id 
    FROM public.user_profiles 
    WHERE user_id = auth.uid() 
    LIMIT 1;
    
    IF current_profile_id IS NULL THEN
        RAISE EXCEPTION 'User profile not found. Please create a profile first.';
    END IF;
    
    -- Insert test posts
    INSERT INTO public.social_posts (user_id, title, content, visibility, moderation_status, is_testimonial)
    VALUES 
        (current_profile_id, 'Welcome to High Table!', 'This is my first post in the High Table community. Excited to share my pet journey with everyone!', 'public', 'approved', false),
        (current_profile_id, 'My Puppy''s First Day Home', 'Just brought home my new Golden Retriever puppy! He''s adjusting well and already loves his new toys. Any tips for first-time puppy parents?', 'public', 'approved', false),
        (current_profile_id, 'Private Update', 'This is a private post that only I can see. Great for personal notes and updates!', 'private', 'approved', false),
        (current_profile_id, 'Testimonial: Amazing Experience', 'I had such a wonderful experience with my breeder. The puppy is healthy, well-socialized, and exactly what I was looking for. Highly recommend!', 'public', 'approved', true),
        (current_profile_id, 'Training Progress Update', 'Week 3 of puppy training and we''re making great progress! Sit, stay, and come commands are almost mastered. Next up: leash training!', 'public', 'approved', false);
    
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_test_posts_for_user() TO authenticated;
