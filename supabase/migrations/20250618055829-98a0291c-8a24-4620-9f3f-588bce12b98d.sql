
-- Update RLS policies for inquiries to allow anonymous submissions with name and email
DROP POLICY IF EXISTS "Users can create inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can view their own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Breeders can view inquiries for their litters" ON public.inquiries;

-- Allow anyone to create inquiries (for contact form)
CREATE POLICY "Anyone can create inquiries" ON public.inquiries
  FOR INSERT WITH CHECK (true);

-- Users can view their own inquiries (authenticated users)
CREATE POLICY "Users can view their own inquiries" ON public.inquiries
  FOR SELECT USING (auth.uid() = user_id);

-- Allow viewing inquiries that have name/email but no user_id (anonymous inquiries)
CREATE POLICY "Allow viewing anonymous inquiries with contact info" ON public.inquiries
  FOR SELECT USING (user_id IS NULL AND name IS NOT NULL AND email IS NOT NULL);

-- Breeders can view inquiries for their litters
CREATE POLICY "Breeders can view inquiries for their litters" ON public.inquiries
  FOR SELECT USING (litter_id IN (
    SELECT l.id FROM public.litters l
    JOIN public.breeders b ON l.breeder_id = b.id
    WHERE b.user_id = auth.uid()
  ));

-- Admins/breeders can view all inquiries (for admin panel)
CREATE POLICY "Breeders can view all inquiries" ON public.inquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.breeders b 
      WHERE b.user_id = auth.uid()
    )
  );
