-- Fix messaging permissions for proper conversation access
-- This migration ensures users can access conversations they participate in

-- Grant select permissions on conversation_participants for authenticated users
GRANT SELECT ON public.conversation_participants TO authenticated;
GRANT SELECT ON public.conversation_participants TO anon;

-- Grant select permissions on conversations for authenticated users  
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversations TO anon;

-- Grant select permissions on messages for authenticated users
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.messages TO anon;

-- Grant select permissions on message_read_receipts for authenticated users
GRANT SELECT ON public.message_read_receipts TO authenticated;
GRANT SELECT ON public.message_read_receipts TO anon;

-- Ensure the is_conversation_participant function has proper permissions
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO anon;

-- Check current permissions
SELECT 
  table_name,
  grantee,
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name IN ('conversations', 'conversation_participants', 'messages', 'message_read_receipts')
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee;