-- Messaging schema: conversations, participants, messages, receipts, archives, blocking, storage bucket
-- E2EE note: messages.content stores ciphertext; clients handle encryption/decryption

create extension if not exists pgcrypto;

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
insert into storage.buckets (id, name, public) values ('message-attachments','message-attachments', true)
  on conflict (id) do nothing;

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.messages_deleted_by enable row level security;
alter table public.archived_conversations enable row level security;
alter table public.blocked_users enable row level security;

-- Policies for participants
do $$ begin
  if not exists (select 1 from pg_policies where policyname='conv_part_select' and tablename='conversation_participants') then
    create policy conv_part_select on public.conversation_participants for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='conv_part_insert' and tablename='conversation_participants') then
    create policy conv_part_insert on public.conversation_participants for insert to authenticated with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname='conv_part_delete' and tablename='conversation_participants') then
    create policy conv_part_delete on public.conversation_participants for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Conversations: visible if participant
do $$ begin
  if not exists (select 1 from pg_policies where policyname='conversations_select' and tablename='conversations') then
    create policy conversations_select on public.conversations for select to authenticated using (
      exists (select 1 from public.conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='conversations_insert' and tablename='conversations') then
    create policy conversations_insert on public.conversations for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='conversations_delete' and tablename='conversations') then
    create policy conversations_delete on public.conversations for delete to authenticated using (
      exists (select 1 from public.conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid())
    );
  end if;
end $$;

-- Messages: only participants can see/insert
do $$ begin
  if not exists (select 1 from pg_policies where policyname='messages_select' and tablename='messages') then
    create policy messages_select on public.messages for select to authenticated using (
      exists (select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid())
      and not exists (select 1 from public.messages_deleted_by d where d.message_id = messages.id and d.user_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='messages_insert' and tablename='messages') then
    create policy messages_insert on public.messages for insert to authenticated with check (
      exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversation_id and cp.user_id = auth.uid())
    );
  end if;
end $$;

-- Receipts: only participants rows
do $$ begin
  if not exists (select 1 from pg_policies where policyname='receipts_select' and tablename='message_receipts') then
    create policy receipts_select on public.message_receipts for select to authenticated using (
      exists (
        select 1 from public.messages m
        join public.conversation_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
        where m.id = message_id
      )
    );
  end if;
  if not exists (select 1 from pg_policies where policyname='receipts_upsert' and tablename='message_receipts') then
    create policy receipts_upsert on public.message_receipts for insert to authenticated with check (
      exists (
        select 1 from public.messages m
        join public.conversation_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
        where m.id = message_id
      )
    );
    create policy receipts_update on public.message_receipts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Soft deletes
do $$ begin
  if not exists (select 1 from pg_policies where policyname='msg_deleted_by_insert' and tablename='messages_deleted_by') then
    create policy msg_deleted_by_insert on public.messages_deleted_by for insert to authenticated with check (user_id = auth.uid());
    create policy msg_deleted_by_select on public.messages_deleted_by for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- Archive policy
do $$ begin
  if not exists (select 1 from pg_policies where policyname='archive_insert' and tablename='archived_conversations') then
    create policy archive_insert on public.archived_conversations for insert to authenticated with check (user_id = auth.uid());
    create policy archive_select on public.archived_conversations for select to authenticated using (user_id = auth.uid());
    create policy archive_delete on public.archived_conversations for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- Blocking policy
do $$ begin
  if not exists (select 1 from pg_policies where policyname='blocked_insert' and tablename='blocked_users') then
    create policy blocked_insert on public.blocked_users for insert to authenticated with check (blocker_id = auth.uid());
    create policy blocked_select on public.blocked_users for select to authenticated using (blocker_id = auth.uid());
    create policy blocked_delete on public.blocked_users for delete to authenticated using (blocker_id = auth.uid());
  end if;
end $$;

-- Constraint: prevent sending if blocked (via trigger check)
create or replace function public.prevent_blocked_messages() returns trigger as $$
begin
  -- block if sender is blocked by any recipient in conversation
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

create trigger trg_messages_blocked
before insert on public.messages
for each row execute function public.prevent_blocked_messages();

-- Notifications on new messages
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

create trigger trg_messages_notify
after insert on public.messages
for each row execute function public.notify_new_message();

-- Add tables to realtime publication
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
-- Note: Client should upload under path `${auth.uid()}/...`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname='storage' AND policyname = 'message_attachments_read'
  ) THEN
    CREATE POLICY message_attachments_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'message-attachments');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname='storage' AND policyname = 'message_attachments_insert'
  ) THEN
    CREATE POLICY message_attachments_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
      bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname='storage' AND policyname = 'message_attachments_update'
  ) THEN
    CREATE POLICY message_attachments_update ON storage.objects FOR UPDATE TO authenticated USING (
      bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname='storage' AND policyname = 'message_attachments_delete'
  ) THEN
    CREATE POLICY message_attachments_delete ON storage.objects FOR DELETE TO authenticated USING (
      bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
