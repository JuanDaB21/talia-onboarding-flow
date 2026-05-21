-- Tabla PROVEEDORES
CREATE TABLE public.proveedores (
  id_proveedor uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  razon_social varchar NOT NULL,
  documento_tributario varchar NOT NULL,
  nombre_contacto varchar NOT NULL,
  telefono varchar NOT NULL,
  estado boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proveedores_negocio ON public.proveedores(id_negocio);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_select_own_negocio"
  ON public.proveedores FOR SELECT TO authenticated
  USING (id_negocio = public.current_user_negocio());

CREATE POLICY "proveedores_insert_own_negocio"
  ON public.proveedores FOR INSERT TO authenticated
  WITH CHECK (id_negocio = public.current_user_negocio());

CREATE POLICY "proveedores_update_own_negocio"
  ON public.proveedores FOR UPDATE TO authenticated
  USING (id_negocio = public.current_user_negocio())
  WITH CHECK (id_negocio = public.current_user_negocio());

CREATE POLICY "proveedores_delete_own_negocio"
  ON public.proveedores FOR DELETE TO authenticated
  USING (id_negocio = public.current_user_negocio());

-- Tabla INSUMOS (sin FK a proveedores)
CREATE TABLE public.insumos (
  id_insumo uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  nombre_insumo varchar NOT NULL,
  unidad_medida varchar NOT NULL,
  costo_promedio decimal(14,4) NOT NULL DEFAULT 0,
  stock_minimo decimal(14,4) NOT NULL DEFAULT 0,
  unidad_compra varchar NOT NULL,
  unidad_receta varchar NOT NULL,
  factor_conversion decimal(14,4) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_insumos_negocio ON public.insumos(id_negocio);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insumos_select_own_negocio"
  ON public.insumos FOR SELECT TO authenticated
  USING (id_negocio = public.current_user_negocio());

CREATE POLICY "insumos_insert_own_negocio"
  ON public.insumos FOR INSERT TO authenticated
  WITH CHECK (id_negocio = public.current_user_negocio());

CREATE POLICY "insumos_update_own_negocio"
  ON public.insumos FOR UPDATE TO authenticated
  USING (id_negocio = public.current_user_negocio())
  WITH CHECK (id_negocio = public.current_user_negocio());

CREATE POLICY "insumos_delete_own_negocio"
  ON public.insumos FOR DELETE TO authenticated
  USING (id_negocio = public.current_user_negocio());