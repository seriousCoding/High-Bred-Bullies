
-- Update the RLS policy to allow public access to both active and upcoming litters
DROP POLICY IF EXISTS "Public can view active litters" ON public.litters;

CREATE POLICY "Public can view active and upcoming litters" ON public.litters
  FOR SELECT USING (status IN ('active', 'upcoming'));
