
-- Create a storage bucket for social media uploads (images and videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media', 'social-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the social-media bucket
CREATE POLICY "Public read access for social-media" ON storage.objects
FOR SELECT USING (bucket_id = 'social-media');

CREATE POLICY "Authenticated users can upload to social-media" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'social-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own files in social-media" ON storage.objects
FOR UPDATE USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files in social-media" ON storage.objects
FOR DELETE USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);
