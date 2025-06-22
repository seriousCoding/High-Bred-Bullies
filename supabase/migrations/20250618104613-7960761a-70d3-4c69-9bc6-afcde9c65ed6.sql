
-- Add breeder contact information to orders view for AI assistant
CREATE OR REPLACE VIEW public.order_breeder_contacts AS
SELECT 
    o.id as order_id,
    o.user_id,
    b.contact_email as breeder_email,
    b.contact_phone as breeder_phone,
    b.business_name as breeder_name
FROM public.orders o
JOIN public.order_items oi ON o.id = oi.order_id
JOIN public.puppies p ON oi.puppy_id = p.id
JOIN public.litters l ON p.litter_id = l.id
JOIN public.breeders b ON l.breeder_id = b.id;

-- Create friend requests table
CREATE TABLE public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(sender_id, receiver_id)
);

-- Create friendships table (for accepted friend requests)
CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user1_id, user2_id),
    CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

-- Create messages table for direct messaging
CREATE TABLE public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for friend_requests
CREATE POLICY "Users can view friend requests involving them" ON public.friend_requests
FOR SELECT USING (
    sender_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) OR
    receiver_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create friend requests" ON public.friend_requests
FOR INSERT WITH CHECK (
    sender_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update friend requests they received" ON public.friend_requests
FOR UPDATE USING (
    receiver_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

-- RLS policies for friendships
CREATE POLICY "Users can view their friendships" ON public.friendships
FOR SELECT USING (
    user1_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) OR
    user2_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "System can create friendships" ON public.friendships
FOR INSERT WITH CHECK (true); -- Will be handled by trigger

-- RLS policies for direct_messages
CREATE POLICY "Users can view their messages" ON public.direct_messages
FOR SELECT USING (
    sender_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) OR
    receiver_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can send messages" ON public.direct_messages
FOR INSERT WITH CHECK (
    sender_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their received messages" ON public.direct_messages
FOR UPDATE USING (
    receiver_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

-- Create function to handle friend request acceptance
CREATE OR REPLACE FUNCTION public.handle_friend_request_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If a friend request is accepted, create a friendship
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        INSERT INTO public.friendships (user1_id, user2_id)
        VALUES (
            LEAST(NEW.sender_id, NEW.receiver_id),
            GREATEST(NEW.sender_id, NEW.receiver_id)
        )
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for friend request acceptance
CREATE TRIGGER on_friend_request_accepted
    AFTER UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_friend_request_acceptance();

-- Update social_feed_posts view to show only friends' posts for authenticated users
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
    (sp.user_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()))
    OR
    -- Show friends' posts to authenticated users
    (auth.uid() IS NOT NULL AND sp.user_id IN (
        SELECT CASE 
            WHEN f.user1_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) THEN f.user2_id
            ELSE f.user1_id
        END
        FROM public.friendships f
        WHERE f.user1_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
           OR f.user2_id = (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    ));

-- Grant permissions
GRANT SELECT ON public.order_breeder_contacts TO authenticated;
GRANT ALL ON public.friend_requests TO authenticated;
GRANT ALL ON public.friendships TO authenticated;
GRANT ALL ON public.direct_messages TO authenticated;
GRANT SELECT ON public.social_feed_posts TO authenticated;
