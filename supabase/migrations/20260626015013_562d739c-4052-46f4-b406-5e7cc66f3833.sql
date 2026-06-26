
CREATE TABLE public.caja_ajuste_tipos (
  id_tipo uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  nombre text NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 60),
  signo text NOT NULL DEFAULT 'NEGATIVO' CHECK (signo IN ('POSITIVO','NEGATIVO')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX caja_ajuste_tipos_negocio_nombre_uniq
  ON public.caja_ajuste_tipos (id_negocio, lower(trim(nombre)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caja_ajuste_tipos TO authenticated;
GRANT ALL ON public.caja_ajuste_tipos TO service_role;
ALTER TABLE public.caja_ajuste_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_select_negocio" ON public.caja_ajuste_tipos
  FOR SELECT TO authenticated
  USING (id_negocio = public.current_user_negocio());

CREATE POLICY "tipos_insert_admin_cajero" ON public.caja_ajuste_tipos
  FOR INSERT TO authenticated
  WITH CHECK (
    id_negocio = public.current_user_negocio()
    AND EXISTS (
      SELECT 1 FROM public.usuarios_staff u
      WHERE u.id_usuario = auth.uid()
        AND u.rol IN ('ADMIN','SUPERADMIN','CAJERO')
    )
  );

CREATE POLICY "tipos_update_admin_cajero" ON public.caja_ajuste_tipos
  FOR UPDATE TO authenticated
  USING (
    id_negocio = public.current_user_negocio()
    AND EXISTS (
      SELECT 1 FROM public.usuarios_staff u
      WHERE u.id_usuario = auth.uid()
        AND u.rol IN ('ADMIN','SUPERADMIN','CAJERO')
    )
  );

CREATE TRIGGER caja_ajuste_tipos_set_updated_at
  BEFORE UPDATE ON public.caja_ajuste_tipos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.caja_ajustes (
  id_ajuste uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_caja uuid NOT NULL REFERENCES public.caja_dia(id_caja) ON DELETE CASCADE,
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  id_tipo uuid NOT NULL REFERENCES public.caja_ajuste_tipos(id_tipo),
  monto numeric NOT NULL CHECK (monto > 0),
  nota text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX caja_ajustes_id_caja_idx ON public.caja_ajustes(id_caja);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caja_ajustes TO authenticated;
GRANT ALL ON public.caja_ajustes TO service_role;
ALTER TABLE public.caja_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ajustes_select_negocio" ON public.caja_ajustes
  FOR SELECT TO authenticated
  USING (id_negocio = public.current_user_negocio());

CREATE POLICY "ajustes_insert_admin_cajero" ON public.caja_ajustes
  FOR INSERT TO authenticated
  WITH CHECK (
    id_negocio = public.current_user_negocio()
    AND EXISTS (
      SELECT 1 FROM public.usuarios_staff u
      WHERE u.id_usuario = auth.uid()
        AND u.rol IN ('ADMIN','SUPERADMIN','CAJERO')
    )
  );

CREATE POLICY "ajustes_delete_admin" ON public.caja_ajustes
  FOR DELETE TO authenticated
  USING (
    id_negocio = public.current_user_negocio()
    AND EXISTS (
      SELECT 1 FROM public.usuarios_staff u
      WHERE u.id_usuario = auth.uid()
        AND u.rol IN ('ADMIN','SUPERADMIN')
    )
  );
