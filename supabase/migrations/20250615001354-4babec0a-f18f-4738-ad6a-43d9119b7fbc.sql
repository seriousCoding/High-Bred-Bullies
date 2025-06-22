
-- Modify litters table for new pricing and images
ALTER TABLE public.litters
  DROP COLUMN IF EXISTS price_per_puppy,
  ADD COLUMN IF NOT EXISTS price_per_male INTEGER NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS price_per_female INTEGER NOT NULL DEFAULT 60000,
  ADD COLUMN IF NOT EXISTS dam_image_url TEXT,
  ADD COLUMN IF NOT EXISTS sire_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS stripe_male_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_female_price_id TEXT;

-- Modify puppies table for images
ALTER TABLE public.puppies
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('litter-images', 'litter-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage bucket
DROP POLICY IF EXISTS "Litter images are publicly viewable" ON storage.objects;
CREATE POLICY "Litter images are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'litter-images' );

DROP POLICY IF EXISTS "Anyone can upload to litter-images" ON storage.objects;
CREATE POLICY "Anyone can upload to litter-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'litter-images' );

DROP POLICY IF EXISTS "Authenticated users can update their own images" ON storage.objects;
CREATE POLICY "Authenticated users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( auth.uid() = owner )
WITH CHECK ( auth.uid() = owner );

DROP POLICY IF EXISTS "Authenticated users can delete their own images" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING ( auth.uid() = owner );
