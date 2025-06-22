
-- Create a secure function to get user email by user ID
-- This function uses SECURITY DEFINER to access auth.users table
CREATE OR REPLACE FUNCTION public.get_user_email(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get user email from auth.users table
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_uuid;
  
  RETURN COALESCE(user_email, 'Email not available');
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;
