
-- Add delivery fee to the breeders table
ALTER TABLE public.breeders
ADD COLUMN IF NOT EXISTS delivery_fee INTEGER DEFAULT 0; -- Delivery fee in cents

-- Add pickup scheduling and delivery option fields to the orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS pickup_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_scheduled_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pickup_confirmed_by_user BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pickup_confirmed_by_breeder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS delivery_option TEXT CHECK (delivery_option IN ('pickup', 'delivery'));

-- Create a table to track pickup reminders
CREATE TABLE IF NOT EXISTS public.pickup_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('purchaser_daily', 'breeder_daily', 'final_purchaser', 'final_breeder')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a helper function to cast timestamptz to date immutably
CREATE OR REPLACE FUNCTION public.to_utc_date(ts timestamptz)
RETURNS date AS $$
  -- We specify UTC to ensure the date is consistent regardless of session timezone
  SELECT (ts AT TIME ZONE 'UTC')::date;
$$ LANGUAGE sql IMMUTABLE;

-- Drop the potentially problematic index if it exists from a partial run
DROP INDEX IF EXISTS pickup_reminders_order_id_reminder_type_sent_at_date_idx;

-- Add a unique constraint to prevent duplicate reminders per day for the same order and type
CREATE UNIQUE INDEX pickup_reminders_order_id_reminder_type_sent_at_date_idx
ON public.pickup_reminders (order_id, reminder_type, (public.to_utc_date(sent_at)));

-- Enable Row Level Security for the new table
ALTER TABLE public.pickup_reminders ENABLE ROW LEVEL SECURITY;

-- Allow users to view reminders for their own orders
DROP POLICY IF EXISTS "Users can view reminders for their orders" ON public.pickup_reminders;
CREATE POLICY "Users can view reminders for their orders" ON public.pickup_reminders
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id));

-- Allow breeders to view reminders for orders related to their litters
DROP POLICY IF EXISTS "Breeders can view reminders for their orders" ON public.pickup_reminders;
CREATE POLICY "Breeders can view reminders for their orders" ON public.pickup_reminders
  FOR SELECT USING (EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.puppies p ON oi.puppy_id = p.id
    JOIN public.litters l ON p.litter_id = l.id
    JOIN public.breeders b ON l.breeder_id = b.id
    WHERE oi.order_id = pickup_reminders.order_id AND b.user_id = auth.uid()
  ));
