-- HU10 - Reseñas y Calificaciones
-- Permite a compradores calificar productos que han comprado.

begin;

-- Tabla de reseñas
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid,
  rating integer not null check (rating between 1 and 5),
  comment text,
  is_hidden boolean not null default false,
  flagged_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comment_length check (comment is null or (char_length(comment) between 10 and 300)),
  constraint one_review_per_buyer unique (product_id, buyer_id)
);

alter table public.product_reviews enable row level security;

-- Solo el comprador que compró el producto puede insertar
-- y cualquiera puede ver reseñas no ocultas

-- Ver reseñas visibles
drop policy if exists sel_reviews_public on public.product_reviews;
create policy sel_reviews_public on public.product_reviews
  for select using (is_hidden = false);

-- Insertar reseñas: debe existir una orden del comprador para ese producto y estado 'entregado'
-- Usamos una función helper para evaluar bajo SECURITY DEFINER y evitar problemas de RLS en orders
create or replace function public.has_delivered_order(p_product uuid, p_buyer uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  ok boolean;
begin
  select exists (
    select 1 from public.orders o
    where o.product_id = p_product and o.buyer_id = p_buyer and o.status = 'entregado'
  ) into ok;
  return coalesce(ok, false);
end; $$;

drop policy if exists ins_reviews_buyer on public.product_reviews;
create policy ins_reviews_buyer on public.product_reviews
  for insert with check (
    auth.uid() = buyer_id
    and public.has_delivered_order(product_id, buyer_id)
  );

-- El comprador puede actualizar o borrar su propia reseña (p.ej., corregir comentario), pero no cambiar rating fuera de rango
drop policy if exists upd_reviews_self on public.product_reviews;
create policy upd_reviews_self on public.product_reviews
  for update using (auth.uid() = buyer_id);

drop policy if exists del_reviews_self on public.product_reviews;
create policy del_reviews_self on public.product_reviews
  for delete using (auth.uid() = buyer_id);

-- Trigger updated_at
create or replace function public.set_review_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create or replace trigger trg_product_reviews_updated_at
before update on public.product_reviews
for each row execute procedure public.set_review_updated_at();

-- Moderación simple: marcar como oculto si contiene lenguaje inapropiado
create or replace function public.contains_bad_words(txt text)
returns boolean language plpgsql as $$
begin
  if txt is null then return false; end if;
  return (
    txt ~* '(\yputa\y|\ypendej|\yimbecil\y|\yidiota\y|\yestupido\y|\ycabr[oó]n\y)'
  );
end; $$;

create or replace function public.moderate_review()
returns trigger language plpgsql as $$
begin
  if public.contains_bad_words(new.comment) then
    new.is_hidden := true;
    new.flagged_reason := 'inappropriate_language';
  end if;
  return new;
end; $$;

create or replace trigger trg_product_reviews_moderate
before insert or update on public.product_reviews
for each row execute procedure public.moderate_review();

-- Agregados en productos: promedio y conteo de calificaciones visibles
-- Añadir columnas si no existen
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='avg_rating') then
    alter table public.products add column avg_rating numeric(3,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='ratings_count') then
    alter table public.products add column ratings_count integer not null default 0;
  end if;
end $$;

create or replace function public.recalc_product_rating(p_product uuid)
returns void language plpgsql as $$
declare
  v_avg numeric(10,5);
  v_cnt integer;
begin
  select avg(r.rating)::numeric(10,5), count(1)
  into v_avg, v_cnt
  from public.product_reviews r
  where r.product_id = p_product and r.is_hidden = false;

  update public.products
  set avg_rating = coalesce(round(v_avg::numeric, 2), null),
      ratings_count = coalesce(v_cnt, 0)
  where id = p_product;
end; $$;

create or replace function public.on_review_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalc_product_rating(new.product_id);
  elsif tg_op = 'UPDATE' then
    perform public.recalc_product_rating(new.product_id);
  elsif tg_op = 'DELETE' then
    perform public.recalc_product_rating(old.product_id);
  end if;
  return null;
end; $$;

-- Statement-level ensures recalc after DML
drop trigger if exists trg_reviews_after on public.product_reviews;
create trigger trg_reviews_after
after insert or update or delete on public.product_reviews
for each row execute procedure public.on_review_change();

commit;
