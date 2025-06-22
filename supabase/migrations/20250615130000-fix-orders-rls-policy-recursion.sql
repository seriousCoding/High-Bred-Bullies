
-- Drop all existing policies on the orders table to clean up
DROP POLICY IF EXISTS "Users can manage their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Breeders can manage orders for their litters" ON public.orders;
DROP POLICY IF EXISTS "Breeders can view orders for their litters" ON public.orders;
DROP POLICY IF EXISTS "Breeders can update orders for their litters" ON public.orders;

-- Create a security definer function to check if the current user is a breeder for a specific order.
-- This helps avoid recursive RLS policy checks.
CREATE OR REPLACE FUNCTION public.is_breeder_for_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.puppies p ON oi.puppy_id = p.id
    JOIN public.litters l ON p.litter_id = l.id
    JOIN public.breeders b ON l.breeder_id = b.id
    WHERE oi.order_id = p_order_id AND b.user_id = auth.uid()
  );
$$;

-- Allow users to view their own orders
CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to update their own orders (for scheduling)
CREATE POLICY "Users can update their own orders"
ON public.orders FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Recreate breeder policies using the new function
CREATE POLICY "Breeders can view orders for their litters"
ON public.orders FOR SELECT
USING (public.is_breeder_for_order(id));

CREATE POLICY "Breeders can update orders for their litters"
ON public.orders FOR UPDATE
USING (public.is_breeder_for_order(id));
