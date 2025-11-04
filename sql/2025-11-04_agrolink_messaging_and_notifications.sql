-- AgroLink consolidated SQL: Notifications + Messaging (idempotent)
-- Date: 2025-11-04
-- This script creates/updates:
-- - notifications table + RLS
-- - messaging schema (conversations, participants, messages, receipts, soft-deletes, archives, blocked)
-- - RLS policies including sequential participant add and broader participant select
-- - triggers: prevent_blocked_messages, notify_new_message
-- - storage bucket and policies for message attachments
-- - realtime publication entries

create extension if not exists pgcrypto;

-- =========================
-- Notifications
-- =========================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  url text,
  severity text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Policies for notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select'
  ) THEN
    CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update'
  ) THEN
    CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_delete'
  ) THEN
    CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert'
  ) THEN
    CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Add notifications to realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- =========================
-- Messaging schema
-- =========================
-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Participants
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_conv_part_user on public.conversation_participants(user_id);

-- Messages (ciphertext)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  content_ciphertext text not null,
  iv text not null,
  mime_type text default 'text/plain',
  created_at timestamptz not null default now(),
  deleted_for_audit boolean default false
);
create index if not exists idx_messages_conv_created on public.messages(conversation_id, created_at);

-- Message receipts: delivered/read per user
create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

-- Per-user soft deletes
create table if not exists public.messages_deleted_by (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- Archives per user
create table if not exists public.archived_conversations (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  archived_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- Blocking (mutual check on send)
create table if not exists public.blocked_users (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
  VALUES ('message-attachments','message-attachments', true)
  ON CONFLICT (id) DO NOTHING;

-- Enable RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.messages_deleted_by enable row level security;
alter table public.archived_conversations enable row level security;
alter table public.blocked_users enable row level security;

-- Helper to avoid self-referential recursion in policies on conversation_participants
-- SECURITY DEFINER ensures this check bypasses RLS on the same table
create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conv_id and cp.user_id = auth.uid()
  );
$$;
Este es tu producto.
grant execute on function public.is_conversation_participant(uuid) to authenticated;

-- Participants policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='conv_part_select' AND tablename='conversation_participants'
  ) THEN
    CREATE POLICY conv_part_select ON public.conversation_participants FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='conv_part_insert' AND tablename='conversation_participants'
  ) THEN
    CREATE POLICY conv_part_insert ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='conv_part_delete' AND tablename='conversation_participants'
  ) THEN
    CREATE POLICY conv_part_delete ON public.conversation_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Recreate policies that previously referenced the same table and caused recursive evaluation
DROP POLICY IF EXISTS conv_part_select_conv_visible ON public.conversation_participants;
CREATE POLICY conv_part_select_conv_visible ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS conv_part_insert_add_other ON public.conversation_participants;
CREATE POLICY conv_part_insert_add_other ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR public.is_conversation_participant(conversation_id)
  );

-- Conversations policies
DO $$ BEGIN
  -- drop any conflicting INSERT policies and recreate permissive one
  PERFORM 1;
END $$;
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND cmd='insert' LOOP
    EXECUTE format('drop policy %I on public.conversations', pol.policyname);
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_insert'
  ) THEN
    CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='conversations_select' AND tablename='conversations'
  ) THEN
    CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='conversations_delete' AND tablename='conversations'
  ) THEN
    CREATE POLICY conversations_delete ON public.conversations FOR DELETE TO authenticated USING (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
    );
  END IF;
END $$;

-- Messages policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='messages_select' AND tablename='messages'
  ) THEN
    CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid())
      AND NOT EXISTS (SELECT 1 FROM public.messages_deleted_by d WHERE d.message_id = messages.id AND d.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='messages_insert' AND tablename='messages'
  ) THEN
    CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid())
    );
  END IF;
END $$;

-- Receipts policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='receipts_select' AND tablename='message_receipts'
  ) THEN
    CREATE POLICY receipts_select ON public.message_receipts FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = auth.uid()
        WHERE m.id = message_id
      )
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='receipts_upsert' AND tablename='message_receipts'
  ) THEN
    CREATE POLICY receipts_upsert ON public.message_receipts FOR INSERT TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = auth.uid()
        WHERE m.id = message_id
      )
    );
    CREATE POLICY receipts_update ON public.message_receipts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Soft deletes policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='msg_deleted_by_insert' AND tablename='messages_deleted_by'
  ) THEN
    CREATE POLICY msg_deleted_by_insert ON public.messages_deleted_by FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    CREATE POLICY msg_deleted_by_select ON public.messages_deleted_by FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Archive policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='archive_insert' AND tablename='archived_conversations'
  ) THEN
    CREATE POLICY archive_insert ON public.archived_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    CREATE POLICY archive_select ON public.archived_conversations FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY archive_delete ON public.archived_conversations FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Blocking policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='blocked_insert' AND tablename='blocked_users'
  ) THEN
    CREATE POLICY blocked_insert ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
    CREATE POLICY blocked_select ON public.blocked_users FOR SELECT TO authenticated USING (blocker_id = auth.uid());
    CREATE POLICY blocked_delete ON public.blocked_users FOR DELETE TO authenticated USING (blocker_id = auth.uid());
  END IF;
END $$;

-- Prevent sending messages when blocked
create or replace function public.prevent_blocked_messages() returns trigger as $$
begin
  if exists (
    select 1 from public.conversation_participants cp
    join public.blocked_users b on b.blocker_id = cp.user_id and b.blocked_id = NEW.sender_id
    where cp.conversation_id = NEW.conversation_id and cp.user_id <> NEW.sender_id
  ) then
    raise exception 'No puedes enviar mensajes a este usuario (bloqueado)';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

DROP TRIGGER IF EXISTS trg_messages_blocked ON public.messages;
create trigger trg_messages_blocked
before insert on public.messages
for each row execute function public.prevent_blocked_messages();

-- On new messages, insert notifications for other participants
create or replace function public.notify_new_message() returns trigger as $$
declare
  rid uuid;
begin
  for rid in select user_id from public.conversation_participants where conversation_id = NEW.conversation_id and user_id <> NEW.sender_id loop
    insert into public.notifications(user_id, type, title, body, url, severity)
      values (rid, 'message', 'Nuevo mensaje', null, '/messages', 'info');
  end loop;
  return NEW;
end;
$$ language plpgsql security definer;

DROP TRIGGER IF EXISTS trg_messages_notify ON public.messages;
create trigger trg_messages_notify
after insert on public.messages
for each row execute function public.notify_new_message();

-- Add messaging tables to realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- Storage policies for attachments: public read; authenticated can write own folder
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname='storage' AND policyname = 'message_attachments_read') THEN
    CREATE POLICY message_attachments_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'message-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname='storage' AND policyname = 'message_attachments_insert') THEN
    CREATE POLICY message_attachments_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
      bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname='storage' AND policyname = 'message_attachments_update') THEN
    CREATE POLICY message_attachments_update ON storage.objects FOR UPDATE TO authenticated USING (
      bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname='storage' AND policyname = 'message_attachments_delete') THEN
    CREATE POLICY message_attachments_delete ON storage.objects FOR DELETE TO authenticated USING (
      bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
