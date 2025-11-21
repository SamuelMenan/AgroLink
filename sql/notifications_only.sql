-- AgroLink consolidated SQL: Notifications only (idempotent)
-- Date: 2025-11-21
-- This script creates/updates:
-- - notifications table + RLS
-- - storage bucket and policies for general attachments
-- - realtime publication entries for notifications

-- Remove messaging tables if they exist
DROP TABLE IF EXISTS public.messages_deleted_by CASCADE;
DROP TABLE IF EXISTS public.message_receipts CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.archived_conversations CASCADE;
DROP TABLE IF EXISTS public.blocked_users CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

-- Remove messaging policies
DO $$
BEGIN
  -- Drop messaging-related policies
  DROP POLICY IF EXISTS conversations_select ON public.conversations;
  DROP POLICY IF EXISTS conversations_insert ON public.conversations;
  DROP POLICY IF EXISTS conversations_delete ON public.conversations;
  DROP POLICY IF EXISTS conversation_participants_select ON public.conversation_participants;
  DROP POLICY IF EXISTS conversation_participants_insert ON public.conversation_participants;
  DROP POLICY IF EXISTS conversation_participants_delete ON public.conversation_participants;
  DROP POLICY IF EXISTS messages_select ON public.messages;
  DROP POLICY IF EXISTS messages_insert ON public.messages;
  DROP POLICY IF EXISTS message_receipts_select ON public.message_receipts;
  DROP POLICY IF EXISTS message_receipts_insert ON public.message_receipts;
  DROP POLICY IF EXISTS message_receipts_update ON public.message_receipts;
  DROP POLICY IF EXISTS messages_deleted_by_select ON public.messages_deleted_by;
  DROP POLICY IF EXISTS messages_deleted_by_insert ON public.messages_deleted_by;
  DROP POLICY IF EXISTS messages_deleted_by_delete ON public.messages_deleted_by;
  DROP POLICY IF EXISTS archived_conversations_select ON public.archived_conversations;
  DROP POLICY IF EXISTS archived_conversations_insert ON public.archived_conversations;
  DROP POLICY IF EXISTS archived_conversations_delete ON public.archived_conversations;
  DROP POLICY IF EXISTS blocked_users_select ON public.blocked_users;
  DROP POLICY IF EXISTS blocked_users_insert ON public.blocked_users;
  DROP POLICY IF EXISTS blocked_users_delete ON public.blocked_users;
END $$;

-- Remove messaging functions
DROP FUNCTION IF EXISTS public.is_conversation_participant(uuid, uuid);
DROP FUNCTION IF EXISTS public.prevent_blocked_messages();
DROP FUNCTION IF EXISTS public.notify_new_message();

-- Remove messaging realtime publications
DELETE FROM realtime.subscription WHERE entity = 'messages';
DELETE FROM realtime.subscription WHERE entity = 'conversation_participants';
DELETE FROM realtime.subscription WHERE entity = 'message_receipts';

-- Remove messaging storage bucket
DELETE FROM storage.objects WHERE bucket_id = 'message-attachments';
DELETE FROM storage.buckets WHERE id = 'message-attachments';

-- Now create notifications only
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
END $$;

-- =========================
-- Storage bucket for general attachments
-- =========================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('general-attachments', 'general-attachments', true, 52428800, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies for general attachments
create policy "Allow authenticated uploads on general-attachments"
  on storage.objects for insert
  with check ( bucket_id = 'general-attachments' and auth.role() = 'authenticated' );

create policy "Allow public read on general-attachments"
  on storage.objects for select
  using ( bucket_id = 'general-attachments' );

create policy "Allow owners to delete from general-attachments"
  on storage.objects for delete
  using (
    bucket_id = 'general-attachments' and
    auth.role() = 'authenticated' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- =========================
-- Realtime publications
-- =========================
delete from realtime.subscription where entity = 'notifications';
insert into realtime.subscription (subscription_id, entity, claims) 
values 
  (gen_random_uuid(), 'notifications', '{"claims":{"role":"authenticated"}}')
on conflict (entity) do nothing;