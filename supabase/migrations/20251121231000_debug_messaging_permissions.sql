-- Check current permissions and diagnose messaging issues

-- Check permissions on conversation_participants table
SELECT 
  table_name,
  grantee,
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'conversation_participants'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee;

-- Check if RLS is enabled and what policies exist
SELECT 
  n.nspname as schemaname,
  c.relname as tablename,
  c.relrowsecurity as rowsecurity,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = n.nspname AND tablename = c.relname) as policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'conversation_participants'
  AND n.nspname = 'public';

-- Check existing policies for conversation_participants
SELECT 
  policyname as policy_name,
  cmd as command,
  roles::regrole[] as roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'conversation_participants';

-- Test if the functions exist and work
SELECT 
  'Function exists: is_conversation_participant' as status
WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'is_conversation_participant')
UNION ALL
SELECT 
  'Function exists: get_user_info' as status  
WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_user_info');

-- Check if we can query conversation_participants directly
SELECT COUNT(*) as total_participants FROM public.conversation_participants;
SET ROLE postgres;
RESET ROLE;