-- Fix user_profiles permissions for sender name enrichment
-- This migration ensures the API can access user profiles for message enrichment

-- Grant select permissions on user_profiles for authenticated users
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;

-- Grant select permissions on auth.users for authenticated users (for fallback)
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON auth.users TO anon;

-- Check current permissions
SELECT 
  table_name,
  grantee,
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema IN ('public', 'auth') 
  AND table_name IN ('user_profiles', 'users')
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_schema, table_name, grantee;