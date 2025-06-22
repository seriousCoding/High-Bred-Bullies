
-- Rename columns to be more generic for both pickup and delivery
ALTER TABLE public.orders RENAME COLUMN pickup_deadline TO scheduling_deadline;
ALTER TABLE public.orders RENAME COLUMN pickup_scheduled_date TO scheduled_date;
