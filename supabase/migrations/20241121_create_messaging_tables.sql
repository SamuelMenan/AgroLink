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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select') THEN
    CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert') THEN
    CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update') THEN
    CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_delete') THEN
    CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add notifications to realtime (ignore duplicates)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- =========================
-- Messaging: conversations + participants + messages
-- =========================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_product on public.conversations(product_id);
create index if not exists idx_conversations_updated on public.conversations(updated_at desc);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_conv_part_user on public.conversation_participants(user_id);
create index if not exists idx_conv_part_conv on public.conversation_participants(conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  content text not null,
  content_ciphertext text,
  iv text,
  mime_type text default 'text/plain',
  message_type text default 'text',
  created_at timestamptz not null default now(),
  deleted_for_audit boolean default false
);

create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index if not exists idx_messages_sender on public.messages(sender_id);

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

create table if not exists public.messages_deleted_by (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.archived_conversations (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  archived_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.blocked_users (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.messages_deleted_by enable row level security;
alter table public.archived_conversations enable row level security;
alter table public.blocked_users enable row level security;

-- Single definition of helper function
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
grant execute on function public.is_conversation_participant(uuid) to authenticated;

-- Policies
DO $$
DECLARE pol record;
BEGIN
  -- Conversations: drop existing INSERT policies (to guarantee permissive one)
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND cmd='insert' LOOP
    EXECUTE format('drop policy %I on public.conversations', pol.policyname);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_insert') THEN
    CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_select') THEN
    CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_delete') THEN
    CREATE POLICY conversations_delete ON public.conversations FOR DELETE TO authenticated USING (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='conversations_update') THEN
    CREATE POLICY conversations_update ON public.conversations FOR UPDATE TO authenticated USING (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
    );
  END IF;

  -- Participants
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conversation_participants' AND policyname='conv_part_insert') THEN
    CREATE POLICY conv_part_insert ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conversation_participants' AND policyname='conv_part_select_conv_visible') THEN
    CREATE POLICY conv_part_select_conv_visible ON public.conversation_participants FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conversation_participants' AND policyname='conv_part_insert_add_other') THEN
    CREATE POLICY conv_part_insert_add_other ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (
      user_id = auth.uid() OR public.is_conversation_participant(conversation_id)
    );
  END IF;

  -- Messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_select') THEN
    CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid())
      AND NOT EXISTS (SELECT 1 FROM public.messages_deleted_by d WHERE d.message_id = messages.id AND d.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_insert') THEN
    CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK (
      EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid())
    );
  END IF;

  -- Receipts
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_receipts' AND policyname='receipts_select') THEN
    CREATE POLICY receipts_select ON public.message_receipts FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = auth.uid()
        WHERE m.id = message_id
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_receipts' AND policyname='receipts_upsert') THEN
    CREATE POLICY receipts_upsert ON public.message_receipts FOR INSERT TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = auth.uid()
        WHERE m.id = message_id
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_receipts' AND policyname='receipts_update') THEN
    CREATE POLICY receipts_update ON public.message_receipts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  -- Soft deletes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages_deleted_by' AND policyname='msg_deleted_by_insert') THEN
    CREATE POLICY msg_deleted_by_insert ON public.messages_deleted_by FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages_deleted_by' AND policyname='msg_deleted_by_select') THEN
    CREATE POLICY msg_deleted_by_select ON public.messages_deleted_by FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;

  -- Archives
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='archived_conversations' AND policyname='archive_insert') THEN
    CREATE POLICY archive_insert ON public.archived_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='archived_conversations' AND policyname='archive_select') THEN
    CREATE POLICY archive_select ON public.archived_conversations FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='archived_conversations' AND policyname='archive_delete') THEN
    CREATE POLICY archive_delete ON public.archived_conversations FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;

  -- Blocking
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_insert') THEN
    CREATE POLICY blocked_insert ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_select') THEN
    CREATE POLICY blocked_select ON public.blocked_users FOR SELECT TO authenticated USING (blocker_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blocked_users' AND policyname='blocked_delete') THEN
    CREATE POLICY blocked_delete ON public.blocked_users FOR DELETE TO authenticated USING (blocker_id = auth.uid());
  END IF;
END $$;

-- Triggers
create or replace function public.prevent_blocked_messages() returns trigger as $$
begin
  if exists (
    select 1
    from public.conversation_participants cp
    join public.blocked_users b on b.blocker_id = cp.user_id and b.blocked_id = NEW.sender_id
    where cp.conversation_id = NEW.conversation_id and cp.user_id <> NEW.sender_id
  ) then
    raise exception 'No puedes enviar mensajes a este usuario (bloqueado)';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

DROP TRIGGER IF EXISTS trg_messages_blocked ON public.messages;
create trigger trg_messages_blocked before insert on public.messages
for each row execute function public.prevent_blocked_messages();

create or replace function public.notify_new_message() returns trigger as $$
declare rid uuid;
begin
  for rid in select user_id from public.conversation_participants where conversation_id = NEW.conversation_id and user_id <> NEW.sender_id loop
    insert into public.notifications(user_id, type, title, body, url, severity)
      values (rid, 'message', 'Nuevo mensaje', null, '/messages', 'info');
  end loop;
  return NEW;
end;
$$ language plpgsql security definer;

DROP TRIGGER IF EXISTS trg_messages_notify ON public.messages;
create trigger trg_messages_notify after insert on public.messages
for each row execute function public.notify_new_message();

-- Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- Storage bucket and policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments','message-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='message_attachments_read') THEN
    CREATE POLICY message_attachments_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'message-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='message_attachments_insert') THEN
    CREATE POLICY message_attachments_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
      bucket_id = 'message-attachments' AND split_part(name,'/',1) = auth.uid()::text
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='message_attachments_update') THEN
    CREATE POLICY message_attachments_update ON storage.objects FOR UPDATE TO authenticated USING (
      bucket_id = 'message-attachments' AND split_part(name,'/',1) = auth.uid()::text
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='message_attachments_delete') THEN
    CREATE POLICY message_attachments_delete ON storage.objects FOR DELETE TO authenticated USING (
      bucket_id = 'message-attachments' AND split_part(name,'/',1) = auth.uid()::text
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Comentarios
COMMENT ON TABLE public.conversations IS 'Conversaciones entre usuarios';
COMMENT ON TABLE public.conversation_participants IS 'Participantes en cada conversación';
COMMENT ON TABLE public.messages IS 'Mensajes enviados en las conversaciones';
COMMENT ON TABLE public.notifications IS 'Notificaciones para los usuarios';
COMMENT ON COLUMN public.conversations.product_id IS 'ID del producto relacionado (opcional)';
COMMENT ON COLUMN public.messages.content IS 'Contenido del mensaje en texto plano';
COMMENT ON COLUMN public.messages.content_ciphertext IS 'Contenido cifrado del mensaje (opcional)';
COMMENT ON COLUMN public.messages.message_type IS 'Tipo de mensaje: text, image, system, quick_request, quick_response';
