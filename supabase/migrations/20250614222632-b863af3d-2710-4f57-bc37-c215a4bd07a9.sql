
-- Create site_config table to store dynamic configuration
CREATE TABLE public.site_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to everyone
CREATE POLICY "Public can read site config"
ON public.site_config
FOR SELECT
USING (true);

-- Policy: Allow admins (breeders) to insert new settings
CREATE POLICY "Admins can insert site config"
ON public.site_config
FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.breeders WHERE user_id = auth.uid()));

-- Policy: Allow admins (breeders) to update existing settings
CREATE POLICY "Admins can update site config"
ON public.site_config
FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.breeders WHERE user_id = auth.uid()));

-- Policy: Allow admins (breeders) to delete settings
CREATE POLICY "Admins can delete site config"
ON public.site_config
FOR DELETE
USING (EXISTS (SELECT 1 FROM public.breeders WHERE user_id = auth.uid()));

-- Insert initial data from the hardcoded values on the contact page
INSERT INTO public.site_config (key, value)
VALUES
    ('contact_location', '123 Puppy Lane, Dogtown, USA 12345'),
    ('contact_phone', '(123) 456-7890'),
    ('contact_email', 'contact@pawsitivebreeders.com'),
    ('business_hours_line1', 'Monday - Friday: 9:00 AM - 6:00 PM'),
    ('business_hours_line2', 'Saturday: 10:00 AM - 4:00 PM'),
    ('business_hours_line3', 'Sunday: Closed')
ON CONFLICT (key) DO NOTHING;

-- Trigger to automatically update the 'updated_at' timestamp on change
CREATE OR REPLACE FUNCTION public.handle_site_config_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_site_config_update
BEFORE UPDATE ON public.site_config
FOR EACH ROW
EXECUTE FUNCTION public.handle_site_config_update();
