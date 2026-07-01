CREATE TABLE IF NOT EXISTS public.espacio_impresora (
  id_espacio uuid PRIMARY KEY REFERENCES public.espacios_trabajo(id_espacio) ON DELETE CASCADE,
  requiere_impresora boolean NOT NULL DEFAULT true,
  ancho_papel_mm smallint NOT NULL DEFAULT 80 CHECK (ancho_papel_mm IN (58, 80)),
  codepage text NOT NULL DEFAULT 'CP437',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.espacio_impresora TO authenticated;
GRANT ALL ON public.espacio_impresora TO service_role;

ALTER TABLE public.espacio_impresora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lee config impresora de su negocio"
  ON public.espacio_impresora FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.espacios_trabajo e
      WHERE e.id_espacio = espacio_impresora.id_espacio
        AND e.id_negocio = public.current_user_negocio()
    )
  );

CREATE POLICY "Admin gestiona config impresora de su negocio"
  ON public.espacio_impresora FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.espacios_trabajo e
      WHERE e.id_espacio = espacio_impresora.id_espacio
        AND e.id_negocio = public.current_user_negocio()
    )
    AND public.is_admin_actual()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.espacios_trabajo e
      WHERE e.id_espacio = espacio_impresora.id_espacio
        AND e.id_negocio = public.current_user_negocio()
    )
    AND public.is_admin_actual()
  );

CREATE OR REPLACE FUNCTION public.tg_espacio_impresora_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_espacio_impresora_touch ON public.espacio_impresora;
CREATE TRIGGER trg_espacio_impresora_touch
  BEFORE UPDATE ON public.espacio_impresora
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_espacio_impresora_touch();