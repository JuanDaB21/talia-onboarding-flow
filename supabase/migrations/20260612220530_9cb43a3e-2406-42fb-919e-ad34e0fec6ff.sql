
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;
ALTER TABLE public.subcategorias ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id_categoria, ROW_NUMBER() OVER (PARTITION BY id_negocio ORDER BY created_at) - 1 AS rn
  FROM public.categorias
)
UPDATE public.categorias c SET orden = r.rn FROM ranked r WHERE r.id_categoria = c.id_categoria AND c.orden = 0;

WITH ranked AS (
  SELECT id_subcategoria, ROW_NUMBER() OVER (PARTITION BY id_categoria ORDER BY created_at) - 1 AS rn
  FROM public.subcategorias
)
UPDATE public.subcategorias s SET orden = r.rn FROM ranked r WHERE r.id_subcategoria = s.id_subcategoria AND s.orden = 0;

CREATE INDEX IF NOT EXISTS idx_categorias_orden ON public.categorias(id_negocio, orden);
CREATE INDEX IF NOT EXISTS idx_subcategorias_orden ON public.subcategorias(id_categoria, orden);
