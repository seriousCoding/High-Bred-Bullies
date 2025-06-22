
-- This migration safely renames columns and notifies the API to reload its schema cache.

-- Safely rename the user confirmation column
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pickup_confirmed_by_user') THEN
      ALTER TABLE public.orders RENAME COLUMN pickup_confirmed_by_user TO scheduling_confirmed_by_user;
   END IF;
END;
$$;

-- Safely rename the breeder confirmation column
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pickup_confirmed_by_breeder') THEN
      ALTER TABLE public.orders RENAME COLUMN pickup_confirmed_by_breeder TO scheduling_confirmed_by_breeder;
   END IF;
END;
$$;

-- Notify PostgREST to reload its schema cache to recognize the new column names.
NOTIFY pgrst, 'reload schema';
