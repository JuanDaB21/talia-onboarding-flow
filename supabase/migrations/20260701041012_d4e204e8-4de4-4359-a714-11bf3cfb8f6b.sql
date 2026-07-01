ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS facturable boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.productos.facturable IS
  'Si es true, el producto puede ser agregado/facturado por mesero o administrador aunque activo=false lo oculte del menú público.';