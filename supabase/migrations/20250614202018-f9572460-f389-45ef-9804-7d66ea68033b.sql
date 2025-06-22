
-- This function securely fetches orders for the logged-in breeder,
-- joining them with customer (user_profiles) and puppy information.
CREATE OR REPLACE FUNCTION get_admin_orders()
RETURNS TABLE (
    id uuid,
    status text,
    amount integer,
    delivery_type text,
    created_at timestamptz,
    customer_name text,
    puppy_name text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        o.id,
        o.status,
        o.amount,
        o.delivery_type,
        o.created_at,
        TRIM(CONCAT(up.first_name, ' ', up.last_name)),
        p.name
    FROM
        public.orders AS o
    LEFT JOIN
        public.user_profiles AS up ON o.user_id = up.user_id
    LEFT JOIN
        public.puppies AS p ON o.puppy_id = p.id
    WHERE EXISTS (
      SELECT 1 FROM public.litters l
      JOIN public.breeders b ON l.breeder_id = b.id
      WHERE l.id = p.litter_id AND b.user_id = auth.uid()
    )
    ORDER BY
        o.created_at DESC;
$$;
