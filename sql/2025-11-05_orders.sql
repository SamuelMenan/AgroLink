-- Orders schema for HU06 Gestionar Pedidos (idempotent)
create extension if not exists pgcrypto;

-- 1) orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  seller_id uuid not null,
  buyer_id uuid not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  currency text not null default 'USD',
  status text not null default 'pendiente', -- pendiente | en_proceso | enviado | entregado | rechazado
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_seller_status on public.orders(seller_id, status);
create index if not exists idx_orders_buyer_status on public.orders(buyer_id, status);
create index if not exists idx_orders_created on public.orders(created_at desc);

-- 2) RLS
alter table public.orders enable row level security;
-- Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select_mine') THEN
    CREATE POLICY orders_select_mine ON public.orders FOR SELECT TO authenticated USING (
      seller_id = auth.uid() OR buyer_id = auth.uid()
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_insert_by_buyer') THEN
    CREATE POLICY orders_insert_by_buyer ON public.orders FOR INSERT TO authenticated WITH CHECK (
      buyer_id = auth.uid()
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_update_by_seller') THEN
    CREATE POLICY orders_update_by_seller ON public.orders FOR UPDATE TO authenticated USING (
      seller_id = auth.uid()
    ) WITH CHECK (
      seller_id = auth.uid()
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_delete_owner') THEN
    CREATE POLICY orders_delete_owner ON public.orders FOR DELETE TO authenticated USING (
      seller_id = auth.uid()
    );
  END IF;
END $$;

-- 3) Trigger to keep updated_at
create or replace function public.set_orders_updated_at() returns trigger as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_orders_updated_at();

-- 4) Notifications on status change to buyer
create or replace function public.notify_order_status_change() returns trigger as $$
declare
  title text;
  body text;
begin
  IF TG_OP = 'UPDATE' AND NEW.status is distinct from OLD.status THEN
    title := 'Actualización de pedido';
    body := 'Estado: ' || NEW.status;
    insert into public.notifications(user_id, type, title, body, url, severity)
      values (NEW.buyer_id, 'order_update', title, body, '/dashboard/orders', case when NEW.status='rechazado' then 'warning' else 'info' end);
  END IF;
  return NEW;
end;
$$ language plpgsql security definer;

DROP TRIGGER IF EXISTS trg_orders_notify on public.orders;
create trigger trg_orders_notify after update on public.orders for each row execute function public.notify_order_status_change();

-- 5) Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
