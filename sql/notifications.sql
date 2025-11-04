-- Idempotent setup for notifications table, RLS, triggers, and realtime
-- Creates a notifications system for request events

-- Ensure uuid generation available
create extension if not exists pgcrypto;

-- 1) Table
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

-- 2) Indexes
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id) where read_at is null;

-- 3) RLS
alter table public.notifications enable row level security;
-- Policies (use DO blocks because CREATE POLICY does not support IF NOT EXISTS)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_select'
  ) then
    create policy notifications_select on public.notifications
      for select to authenticated
      using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_update'
  ) then
    create policy notifications_update on public.notifications
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_delete'
  ) then
    create policy notifications_delete on public.notifications
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end$$;

-- Insert policy: allow inserts from authenticated sessions (needed for trigger execution under caller role)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_insert'
  ) then
    create policy notifications_insert on public.notifications
      for insert to authenticated
      with check (true);
  end if;
end$$;

-- 4) Triggers to create notifications for request events
-- Ensure helper function exists
create or replace function public.notify_request_events() returns trigger as $$
declare
  buyer uuid;
  producer uuid;
  ntype text;
  ntitle text;
  nbody text;
  nurl text;
  nseverity text;
begin
  if (TG_OP = 'INSERT') then
    buyer := NEW.buyer_id;
    producer := NEW.producer_id;
    ntype := 'request_new';
    ntitle := 'Nueva solicitud comercial';
    nbody := coalesce('Has recibido una nueva solicitud.', '');
    nurl := '/dashboard/requests/incoming';
    nseverity := 'info';
    insert into public.notifications(user_id, type, title, body, url, severity)
      values (producer, ntype, ntitle, nbody, nurl, nseverity);
    return NEW;
  elsif (TG_OP = 'UPDATE') then
    if (NEW.status is distinct from OLD.status) then
      buyer := NEW.buyer_id;
      ntype := 'request_update';
      ntitle := case NEW.status when 'aceptada' then 'Tu solicitud fue aceptada' when 'rechazada' then 'Tu solicitud fue rechazada' else 'Actualización de solicitud' end;
      nbody := coalesce('Estado: ' || NEW.status, '');
      nurl := '/dashboard/requests/outgoing';
      nseverity := case NEW.status when 'rechazada' then 'warning' else 'success' end;
      insert into public.notifications(user_id, type, title, body, url, severity)
        values (buyer, ntype, ntitle, nbody, nurl, nseverity);
    end if;
    return NEW;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Attach triggers to requests table if exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='requests') then
    -- create trigger if not exists for insert
    if not exists (
      select 1 from pg_trigger where tgname = 'trg_requests_notify_insert'
    ) then
      create trigger trg_requests_notify_insert
      after insert on public.requests
      for each row execute function public.notify_request_events();
    end if;
    -- and for update
    if not exists (
      select 1 from pg_trigger where tgname = 'trg_requests_notify_update'
    ) then
      create trigger trg_requests_notify_update
      after update on public.requests
      for each row execute function public.notify_request_events();
    end if;
  end if;
end$$;

-- 5) Realtime publication
-- Add notifications to realtime publication if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    EXCEPTION WHEN duplicate_object THEN
      -- already present
      NULL;
    END;
  END IF;
END $$;

-- 6) PostgREST reload
NOTIFY pgrst, 'reload schema';
