-- Fix RLS errors when creating conversations and adding participants
-- Run this in Supabase SQL editor (or psql) on your project

-- 1) Ensure conversation INSERT is allowed for authenticated (bootstrapping)
DO $$
DECLARE pol record;
BEGIN
  -- Drop any existing INSERT policies on conversations to avoid conflicts
  FOR pol IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND cmd='insert' LOOP
    EXECUTE format('drop policy %I on public.conversations', pol.policyname);
  END LOOP;
  -- Create permissive insert policy (row visibility still controlled by SELECT policy)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_insert'
  ) THEN
    CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 2) Allow reading participants for conversations where the user participates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='conv_part_select_conv_visible'
  ) THEN
    CREATE POLICY conv_part_select_conv_visible ON public.conversation_participants
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.conversation_participants me
          WHERE me.conversation_id = conversation_id AND me.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3) Allow a participant to add the other user to the same conversation (insert order-sensitive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversation_participants' AND policyname='conv_part_insert_add_other'
  ) THEN
    CREATE POLICY conv_part_insert_add_other ON public.conversation_participants
      FOR INSERT TO authenticated
      WITH CHECK (
        -- Either I'm inserting myself (covered by existing policy) OR
        user_id = auth.uid()
        OR EXISTS (
          -- I'm already a participant of this conversation, so I can add the other peer
          SELECT 1 FROM public.conversation_participants me
          WHERE me.conversation_id = conversation_id AND me.user_id = auth.uid()
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
