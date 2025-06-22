
-- Enable real-time updates for the puppies table
ALTER TABLE public.puppies REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.puppies;

-- Enable real-time updates for the litters table to catch availability changes
ALTER TABLE public.litters REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.litters;
