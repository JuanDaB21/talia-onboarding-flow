
UPDATE public.insumos
SET unidad_receta = unidad_medida
WHERE coalesce(trim(unidad_receta), '') = ''
  AND coalesce(trim(unidad_medida), '') <> '';

ALTER TABLE public.insumos DROP COLUMN IF EXISTS unidad_medida;
