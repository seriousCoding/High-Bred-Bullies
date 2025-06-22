
-- Create a function to get archived orders for the admin view
CREATE OR REPLACE FUNCTION public.get_admin_archived_orders()
 RETURNS TABLE(id uuid, status text, total_amount integer, delivery_type text, created_at timestamp with time zone, updated_at timestamp with time zone, customer_name text, puppy_names text, puppy_count bigint)
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
        o.updated_at,
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
        ) AND o.status = 'archived'
    ORDER BY
        o.updated_at DESC;
END;
$function$;
