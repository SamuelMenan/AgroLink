-- Agregar nuevos campos a la tabla products
-- Migración para agregar columnas de producto faltantes

-- Agregar columnas si no existen
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_per_unit numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_per_kilo numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS municipality text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS detailed_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_available boolean DEFAULT true;

-- Eliminar restricciones CHECK que puedan existir en quantity
DO $$ 
DECLARE 
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.products'::regclass 
        AND contype = 'c' 
        AND pg_get_constraintdef(oid) LIKE '%quantity%'
    LOOP
        EXECUTE 'ALTER TABLE public.products DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;

-- Cambiar tipo de columna quantity para soportar unidades de medida
ALTER TABLE public.products ALTER COLUMN quantity TYPE text USING quantity::text;

-- Agregar índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_products_department ON public.products(department);
CREATE INDEX IF NOT EXISTS idx_products_municipality ON public.products(municipality);
CREATE INDEX IF NOT EXISTS idx_products_condition ON public.products(condition);
CREATE INDEX IF NOT EXISTS idx_products_stock_available ON public.products(stock_available);

-- Agregar comentarios a las columnas
COMMENT ON COLUMN public.products.condition IS 'Tipo de cultivo: fresh, organic, conventional';
COMMENT ON COLUMN public.products.price_per_unit IS 'Precio por unidad del producto';
COMMENT ON COLUMN public.products.price_per_kilo IS 'Precio por kilogramo del producto';
COMMENT ON COLUMN public.products.department IS 'Departamento de Colombia donde se encuentra el producto';
COMMENT ON COLUMN public.products.municipality IS 'Municipio donde se encuentra el producto';
COMMENT ON COLUMN public.products.detailed_description IS 'Descripción detallada del producto';
COMMENT ON COLUMN public.products.stock_available IS 'Indica si el producto está disponible en stock';
