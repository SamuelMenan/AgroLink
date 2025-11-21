-- Fix auth.users access for sender name enrichment
-- This migration ensures the backend can access auth.users for message enrichment

-- Create a view for public user information to avoid direct auth.users access
CREATE OR REPLACE VIEW public.user_public_info AS
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'avatar_url' as avatar_url,
  created_at
FROM auth.users;

-- Grant permissions on the view
GRANT SELECT ON public.user_public_info TO authenticated;
GRANT SELECT ON public.user_public_info TO anon;

-- Alternative: Create a function to get user info safely
CREATE OR REPLACE FUNCTION public.get_user_info(user_id uuid)
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  avatar_url text
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'full_name' as full_name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url
  FROM auth.users u
  WHERE u.id = $1;
$$;

-- Grant permissions on the function
GRANT EXECUTE ON FUNCTION public.get_user_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_info(uuid) TO anon;

-- Check the view and function exist
SELECT 
  'View exists: user_public_info' as status
WHERE EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'user_public_info')
UNION ALL
SELECT 
  'Function exists: get_user_info' as status  
WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_user_info');