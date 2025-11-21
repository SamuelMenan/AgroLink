-- 0) Extensión para UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Tabla products (idempotente)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL CHECK (char_length(description) <= 200),
  price numeric NOT NULL CHECK (price > 0),
  quantity integer NOT NULL CHECK (quantity >= 0),
  category text NOT NULL,
  image_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'activo', -- 'activo' | 'inactivo'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- 1.1) Campos de ubicación (idempotente)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lng double precision;

-- 1.2) Índices sugeridos (mejoran rendimiento de HU04)
CREATE INDEX IF NOT EXISTS products_status_category_idx ON public.products (status, category);
CREATE INDEX IF NOT EXISTS products_location_idx ON public.products (location);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON public.products (created_at DESC);

-- 2) Activar RLS (seguro si ya estaba)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3) Policies products (crear si no existen; si existen, ajustar)
-- Select: cualquiera lee 'activo'; dueño siempre
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='Public read active or own'
  ) THEN
    EXECUTE $SQL$
      ALTER POLICY "Public read active or own"
      ON public.products
      TO anon, authenticated
      USING (status = 'activo' OR user_id = auth.uid());
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE POLICY "Public read active or own"
      ON public.products
      FOR SELECT
      TO anon, authenticated
      USING (status = 'activo' OR user_id = auth.uid());
    $SQL$;
  END IF;
END
$$;

-- Insert: solo dueño (autenticados)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='Users can insert own products'
  ) THEN
    EXECUTE $SQL$
      ALTER POLICY "Users can insert own products"
      ON public.products
      TO authenticated
      WITH CHECK (user_id = auth.uid());
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE POLICY "Users can insert own products"
      ON public.products
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
    $SQL$;
  END IF;
END
$$;

-- Update: solo dueño (autenticados)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='Users can update own products'
  ) THEN
    EXECUTE $SQL$
      ALTER POLICY "Users can update own products"
      ON public.products
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE POLICY "Users can update own products"
      ON public.products
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
    $SQL$;
  END IF;
END
$$;

-- Delete: solo dueño (autenticados)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='products' AND policyname='Users can delete own products'
  ) THEN
    EXECUTE $SQL$
      ALTER POLICY "Users can delete own products"
      ON public.products
      TO authenticated
      USING (user_id = auth.uid());
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE POLICY "Users can delete own products"
      ON public.products
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
    $SQL$;
  END IF;
END
$$;

-- 4) Storage: asegurar bucket 'product-images' público SIN usar create_bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- 5) Policies de Storage (storage.objects) para el bucket 'product-images'
-- Select: público puede leer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read product images'
  ) THEN
    EXECUTE $SQL$
      ALTER POLICY "Public read product images"
      ON storage.objects
      USING (bucket_id = 'product-images');
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE POLICY "Public read product images"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'product-images');
    $SQL$;
  END IF;
END
$$;

-- Insert: autenticados, solo a su carpeta user_id/*
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Users upload to their own folder'
  ) THEN
    EXECUTE $SQL$
      ALTER POLICY "Users upload to their own folder"
      ON storage.objects
      TO authenticated
      WITH CHECK (
        bucket_id = 'product-images'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE POLICY "Users upload to their own folder"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'product-images'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
    $SQL$;
  END IF;
END
$$;

-- Update: autenticados, solo sus objetos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Users update own objects'
  ) THEN
    EXECUTE $SQL$
      ALTER POLICY "Users update own objects"
      ON storage.objects
      TO authenticated
      USING (
        bucket_id = 'product-images'
        AND split_part(name, '/', 1) = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'product-images'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE POLICY "Users update own objects"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'product-images'
        AND split_part(name, '/', 1) = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'product-images'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
    $SQL$;
  END IF;
END
$$;

-- Delete: autenticados, solo sus objetos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Users delete own objects'
  ) THEN
    EXECUTE $SQL$
      ALTER POLICY "Users delete own objects"
      ON storage.objects
      TO authenticated
      USING (
        bucket_id = 'product-images'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
    $SQL$;
  ELSE
    EXECUTE $SQL$
      CREATE POLICY "Users delete own objects"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'product-images'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
    $SQL$;
  END IF;
END
$$;

-- 5.1) Incluir tabla de imágenes en publicación realtime si aplica (opcional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='storage' AND tablename='objects'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE storage.objects';
    END IF;
  END IF;
END
$$;

-- 8) HU05: Solicitudes comerciales
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  message text,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aceptada','rechazada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- Índices
CREATE INDEX IF NOT EXISTS requests_buyer_idx ON public.requests (buyer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS requests_producer_idx ON public.requests (producer_id, status, created_at DESC);

-- updated_at auto
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_set_updated_at ON public.requests;
CREATE TRIGGER trg_requests_set_updated_at
BEFORE UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Límite de 10 solicitudes 'pendiente' por comprador
CREATE OR REPLACE FUNCTION public.enforce_active_requests_limit()
RETURNS trigger AS $$
DECLARE
  active_count integer;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM public.requests
  WHERE buyer_id = NEW.buyer_id AND status = 'pendiente';

  IF active_count >= 10 THEN
    RAISE EXCEPTION 'Has alcanzado el límite de 10 solicitudes activas.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_limit ON public.requests;
CREATE TRIGGER trg_requests_limit
BEFORE INSERT ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_active_requests_limit();

-- RLS para requests
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Buyer: lee sus solicitudes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='requests' AND policyname='Buyer select own requests'
  ) THEN
    CREATE POLICY "Buyer select own requests"
    ON public.requests
    FOR SELECT
    USING (buyer_id = auth.uid());
  END IF;

  -- Producer: lee solicitudes que recibe
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='requests' AND policyname='Producer select incoming'
  ) THEN
    CREATE POLICY "Producer select incoming"
    ON public.requests
    FOR SELECT
    USING (producer_id = auth.uid());
  END IF;

  -- Buyer: inserta solo si él es el buyer
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='requests' AND policyname='Buyer insert own request'
  ) THEN
    CREATE POLICY "Buyer insert own request"
    ON public.requests
    FOR INSERT
    TO authenticated
    WITH CHECK (buyer_id = auth.uid());
  END IF;

  -- Producer: actualiza estado solo de solicitudes que recibe (aceptar/rechazar)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='requests' AND policyname='Producer update incoming'
  ) THEN
    CREATE POLICY "Producer update incoming"
    ON public.requests
    FOR UPDATE
    TO authenticated
    USING (producer_id = auth.uid())
    WITH CHECK (producer_id = auth.uid());
  END IF;
END
$$;

-- Realtime: incluir tabla requests en publicación realtime si existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='requests'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.requests';
    END IF;
  END IF;
END
$$;

-- 9) Recargar caché de esquema de la API (productos y requests)
NOTIFY pgrst, 'reload schema';

-- 10) Verificaciones rápidas
-- Columns de ubicación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='products' AND column_name IN ('location','lat','lng')
ORDER BY column_name;

-- Policies en public.products
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname='public' AND tablename='products'
ORDER BY policyname;

-- Bucket product-images
SELECT id, name, public
FROM storage.buckets
WHERE id = 'product-images';

-- Policies en storage.objects para product-images
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname IN (
    'Public read product images',
    'Users upload to their own folder',
    'Users update own objects',
    'Users delete own objects'
  )
ORDER BY policyname;

-- Requests: columns y policies
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='requests'
ORDER BY column_name;

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname='public' AND tablename='requests'
ORDER BY policyname;