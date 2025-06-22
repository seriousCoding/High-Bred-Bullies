
-- Add "upcoming" as a valid status for litters
ALTER TABLE public.litters DROP CONSTRAINT IF EXISTS litters_status_check;
ALTER TABLE public.litters ADD CONSTRAINT litters_status_check 
  CHECK (status IN ('active', 'sold_out', 'archived', 'upcoming'));
