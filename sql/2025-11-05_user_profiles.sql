-- HU08 - Configuración de Cuenta y Privacidad
-- Crea perfiles de usuario con niveles de visibilidad y un historial de cambios.

begin;

-- Extensiones requeridas
create extension if not exists pgcrypto;

-- Enumeración para niveles de visibilidad (idempotente)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'visibility_level') then
    create type visibility_level as enum ('public','contacts','private');
  end if;
end $$;

-- Tabla de perfiles
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  address_enc text, -- cifrado en cliente (base64 de iv||cipher)
  name_visibility visibility_level not null default 'contacts',
  email_visibility visibility_level not null default 'contacts',
  phone_visibility visibility_level not null default 'contacts',
  address_visibility visibility_level not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Propietario puede administrar su perfil (evitar IF NOT EXISTS, usar DROP + CREATE)
drop policy if exists up_user_profiles_self on public.user_profiles;
create policy up_user_profiles_self on public.user_profiles
  for select using (auth.uid() = user_id);

drop policy if exists ins_user_profiles_self on public.user_profiles;
create policy ins_user_profiles_self on public.user_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists upd_user_profiles_self on public.user_profiles;
create policy upd_user_profiles_self on public.user_profiles
  for update using (auth.uid() = user_id);

-- Trigger para updated_at
create or replace function public.set_timestamp_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create or replace trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute procedure public.set_timestamp_updated_at();

-- Historial de cambios
create table if not exists public.account_change_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_fields jsonb not null
);

alter table public.account_change_logs enable row level security;
drop policy if exists sel_account_logs_self on public.account_change_logs;
create policy sel_account_logs_self on public.account_change_logs
  for select using (auth.uid() = user_id);
drop policy if exists ins_account_logs_self on public.account_change_logs;
create policy ins_account_logs_self on public.account_change_logs
  for insert with check (auth.uid() = user_id);

-- Función para registrar diferencias entre OLD y NEW (ignorando updated_at)
create or replace function public.log_user_profile_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  dif jsonb := '{}'::jsonb;
  old_row jsonb;
  new_row jsonb;
begin
  if tg_op = 'INSERT' then
    new_row := to_jsonb(new) - 'updated_at' - 'created_at';
    dif := new_row;
  else
    old_row := to_jsonb(old) - 'updated_at' - 'created_at';
    new_row := to_jsonb(new) - 'updated_at' - 'created_at';
    dif := jsonb_strip_nulls((select jsonb_object_agg(k, new_row->k)
                               from jsonb_object_keys(new_row) as k
                               where old_row->k is distinct from new_row->k));
  end if;
  if dif is null then
    return new;
  end if;
  insert into public.account_change_logs(user_id, changed_fields) values (new.user_id, coalesce(dif, '{}'::jsonb));
  return new;
end; $$;

create or replace trigger trg_user_profiles_log
after insert or update on public.user_profiles
for each row execute procedure public.log_user_profile_changes();

commit;
