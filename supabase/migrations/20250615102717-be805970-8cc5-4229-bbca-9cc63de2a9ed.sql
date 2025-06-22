
-- Update the function to exclude archived and cancelled orders from the main view
CREATE OR REPLACE FUNCTION public.get_admin_orders()
 RETURNS TABLE(id uuid, status text, total_amount integer, delivery_type text, created_at timestamp with time zone, customer_name text, puppy_names text, puppy_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.status,
        o.total_amount,
        o.delivery_type,
        o.created_at,
        TRIM(CONCAT(up.first_name, ' ', up.last_name)) AS customer_name,
        (
            SELECT string_agg(COALESCE(p.name, 'Unnamed'), ', ')
            FROM public.order_items oi
            JOIN public.puppies p ON oi.puppy_id = p.id
            WHERE oi.order_id = o.id
        ) AS puppy_names,
        (
            SELECT count(*)
            FROM public.order_items oi
            WHERE oi.order_id = o.id
        ) AS puppy_count
    FROM
        public.orders AS o
    LEFT JOIN
        public.user_profiles AS up ON o.user_id = up.user_id
    WHERE
        EXISTS (
            SELECT 1
            FROM public.order_items oi
            JOIN public.puppies p ON oi.puppy_id = p.id
            JOIN public.litters l ON p.litter_id = l.id
            JOIN public.breeders b ON l.breeder_id = b.id
            WHERE oi.order_id = o.id AND b.user_id = auth.uid()
        ) AND o.status NOT IN ('cancelled', 'archived')
    ORDER BY
        o.created_at DESC;
END;
$function$;

-- Schedule a daily job to clean up archived orders older than 30 days.
-- If a job with the same name exists, it will be updated.
SELECT
  cron.schedule(
    'cleanup-archived-orders',
    '0 2 * * *', -- Runs every day at 2:00 AM UTC
    $$
    DELETE FROM public.orders
    WHERE status = 'archived'
    AND updated_at < now() - interval '30 days';
    $$
  );
