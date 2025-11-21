-- Remove messaging tables safely with IF EXISTS
-- This migration removes all messaging-related tables while preserving notifications

-- Drop dependent tables first (tables with foreign keys)
DROP TABLE IF EXISTS public.message_receipts CASCADE;
DROP TABLE IF EXISTS public.messages_deleted_by CASCADE;
DROP TABLE IF EXISTS public.archived_conversations CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;

-- Drop main messaging tables
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.blocked_users CASCADE;

-- Clean up any remaining references
DELETE FROM public.notifications WHERE type = 'message';

-- Update notification types to remove message reference
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('request_new', 'request_update', 'system'));

-- Grant permissions for remaining tables
GRANT SELECT ON public.notifications TO anon;
GRANT ALL ON public.notifications TO authenticated;