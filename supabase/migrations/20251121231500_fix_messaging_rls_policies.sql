-- Fix RLS policies for messaging system to allow proper participant verification

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Allow participants to view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Allow users to insert their own participation" ON public.conversation_participants;
DROP POLICY IF EXISTS "Allow users to view their own participation" ON public.conversation_participants;

-- Create new, more permissive policies for conversation_participants
-- Policy 1: Allow anyone to see who is in a conversation (needed for verification)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='Allow viewing conversation participants'
  ) THEN
    CREATE POLICY "Allow viewing conversation participants" ON public.conversation_participants
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Policy 2: Allow users to insert themselves as participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='Allow inserting conversation participants'
  ) THEN
    CREATE POLICY "Allow inserting conversation participants" ON public.conversation_participants
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Policy 3: Allow users to update their own participation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='Allow updating own participation'
  ) THEN
    CREATE POLICY "Allow updating own participation" ON public.conversation_participants
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policy 4: Allow users to delete their own participation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='Allow deleting own participation'
  ) THEN
    CREATE POLICY "Allow deleting own participation" ON public.conversation_participants
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Also fix policies for messages table to ensure proper access
DROP POLICY IF EXISTS "Allow participants to view messages" ON public.messages;
DROP POLICY IF EXISTS "Allow participants to insert messages" ON public.messages;

-- Create new policies for messages
-- Policy 1: Allow participants to view messages in conversations they belong to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='messages' AND policyname='Allow viewing messages as participant'
  ) THEN
    CREATE POLICY "Allow viewing messages as participant" ON public.messages
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.conversation_participants 
          WHERE conversation_participants.conversation_id = messages.conversation_id 
          AND conversation_participants.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Policy 2: Allow participants to send messages in conversations they belong to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='messages' AND policyname='Allow sending messages as participant'
  ) THEN
    CREATE POLICY "Allow sending messages as participant" ON public.messages
      FOR INSERT
      WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.conversation_participants 
          WHERE conversation_participants.conversation_id = messages.conversation_id 
          AND conversation_participants.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Grant additional permissions to ensure access
GRANT SELECT ON public.conversation_participants TO authenticated;
GRANT SELECT ON public.conversation_participants TO anon;
GRANT INSERT ON public.conversation_participants TO authenticated;
GRANT INSERT ON public.conversation_participants TO anon;
GRANT UPDATE ON public.conversation_participants TO authenticated;
GRANT DELETE ON public.conversation_participants TO authenticated;

GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.messages TO anon;
GRANT INSERT ON public.messages TO authenticated;
GRANT INSERT ON public.messages TO anon;
GRANT UPDATE ON public.messages TO authenticated;
GRANT DELETE ON public.messages TO authenticated;

-- Verify the changes
SELECT 
  'RLS enabled on conversation_participants:' || relrowsecurity::text as status
FROM pg_class 
WHERE relname = 'conversation_participants'
UNION ALL
SELECT 
  'Policy count on conversation_participants:' || (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'conversation_participants')::text
UNION ALL
SELECT 
  'RLS enabled on messages:' || relrowsecurity::text as status
FROM pg_class 
WHERE relname = 'messages';