
-- Add name and email columns to the inquiries table
ALTER TABLE public.inquiries 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;
