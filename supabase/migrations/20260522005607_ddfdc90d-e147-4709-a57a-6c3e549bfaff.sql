
-- =====================================================
-- INVENTARIO_ACTUAL
-- =====================================================
CREATE TABLE public.inventario_actual (
  id_inventario uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL,
  id_insumo uuid NOT NULL UNIQUE,
  cantidad_actual numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventario_actual ENABLE ROW LEVEL SECURITY;

CREATE POLICY inv_select_own ON public.inventario_actual
  FOR SELECT TO authenticated USING (id_negocio = current_user_negocio());
CREATE POLICY inv_insert_own ON public.inventario_actual
  FOR INSERT TO authenticated WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY inv_update_own ON public.inventario_actual
  FOR UPDATE TO authenticated USING (id_negocio = current_user_negocio())
  WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY inv_delete_own ON public.inventario_actual
  FOR DELETE TO authenticated USING (id_negocio = current_user_negocio());

CREATE INDEX idx_inv_negocio ON public.inventario_actual(id_negocio);

-- =====================================================
-- COMPRAS
-- =====================================================
CREATE TABLE public.compras (
  id_compra uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL,
  id_proveedor uuid NOT NULL,
  numero_factura varchar(100),
  fecha_compra date NOT NULL DEFAULT CURRENT_DATE,
  estado varchar(30) NOT NULL DEFAULT 'REGISTRADA',
  total numeric NOT NULL DEFAULT 0,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY compras_select_own ON public.compras
  FOR SELECT TO authenticated USING (id_negocio = current_user_negocio());
CREATE POLICY compras_insert_own ON public.compras
  FOR INSERT TO authenticated WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY compras_update_own ON public.compras
  FOR UPDATE TO authenticated USING (id_negocio = current_user_negocio())
  WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY compras_delete_own ON public.compras
  FOR DELETE TO authenticated USING (id_negocio = current_user_negocio());

CREATE INDEX idx_compras_negocio_fecha ON public.compras(id_negocio, fecha_compra DESC);
CREATE INDEX idx_compras_proveedor ON public.compras(id_proveedor);

-- =====================================================
-- DETALLE_COMPRA
-- =====================================================
CREATE TABLE public.detalle_compra (
  id_detalle uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_compra uuid NOT NULL REFERENCES public.compras(id_compra) ON DELETE CASCADE,
  id_insumo uuid NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  precio_unitario_compra numeric NOT NULL CHECK (precio_unitario_compra >= 0),
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.detalle_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY detcompra_select_own ON public.detalle_compra
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.compras c WHERE c.id_compra = detalle_compra.id_compra AND c.id_negocio = current_user_negocio())
  );
CREATE POLICY detcompra_insert_own ON public.detalle_compra
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.compras c WHERE c.id_compra = detalle_compra.id_compra AND c.id_negocio = current_user_negocio())
  );
CREATE POLICY detcompra_update_own ON public.detalle_compra
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.compras c WHERE c.id_compra = detalle_compra.id_compra AND c.id_negocio = current_user_negocio())
  );
CREATE POLICY detcompra_delete_own ON public.detalle_compra
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.compras c WHERE c.id_compra = detalle_compra.id_compra AND c.id_negocio = current_user_negocio())
  );

CREATE INDEX idx_detcompra_insumo ON public.detalle_compra(id_insumo);
CREATE INDEX idx_detcompra_compra ON public.detalle_compra(id_compra);

-- =====================================================
-- MOVIMIENTOS_INVENTARIO
-- =====================================================
CREATE TABLE public.movimientos_inventario (
  id_movimiento uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL,
  id_insumo uuid NOT NULL,
  tipo_movimiento varchar(40) NOT NULL,
  cantidad numeric NOT NULL,
  cantidad_anterior numeric NOT NULL,
  cantidad_nueva numeric NOT NULL,
  motivo text,
  id_usuario uuid,
  referencia_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY mov_select_own ON public.movimientos_inventario
  FOR SELECT TO authenticated USING (id_negocio = current_user_negocio());
CREATE POLICY mov_insert_own ON public.movimientos_inventario
  FOR INSERT TO authenticated WITH CHECK (id_negocio = current_user_negocio());

CREATE INDEX idx_mov_insumo_fecha ON public.movimientos_inventario(id_insumo, created_at DESC);

-- =====================================================
-- TRIGGER: auto-crear inventario_actual al crear insumo
-- =====================================================
CREATE OR REPLACE FUNCTION public.crear_inventario_para_insumo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventario_actual (id_negocio, id_insumo, cantidad_actual)
  VALUES (NEW.id_negocio, NEW.id_insumo, 0)
  ON CONFLICT (id_insumo) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_insumo_inventario
AFTER INSERT ON public.insumos
FOR EACH ROW EXECUTE FUNCTION public.crear_inventario_para_insumo();

-- Backfill: crear inventarios para insumos existentes
INSERT INTO public.inventario_actual (id_negocio, id_insumo, cantidad_actual)
SELECT id_negocio, id_insumo, 0 FROM public.insumos
ON CONFLICT (id_insumo) DO NOTHING;

-- =====================================================
-- RPC: ajustar_stock_manual
-- =====================================================
CREATE OR REPLACE FUNCTION public.ajustar_stock_manual(
  p_id_insumo uuid,
  p_nueva_cantidad numeric,
  p_motivo text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_anterior numeric;
  v_diff numeric;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT cantidad_actual INTO v_anterior
  FROM public.inventario_actual
  WHERE id_insumo = p_id_insumo AND id_negocio = v_negocio
  FOR UPDATE;

  IF v_anterior IS NULL THEN
    RAISE EXCEPTION 'Inventario no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_nueva_cantidad < 0 THEN
    RAISE EXCEPTION 'La cantidad no puede ser negativa' USING ERRCODE = '23514';
  END IF;

  v_diff := p_nueva_cantidad - v_anterior;

  UPDATE public.inventario_actual
  SET cantidad_actual = p_nueva_cantidad,
      updated_at = now()
  WHERE id_insumo = p_id_insumo AND id_negocio = v_negocio;

  INSERT INTO public.movimientos_inventario (
    id_negocio, id_insumo, tipo_movimiento, cantidad,
    cantidad_anterior, cantidad_nueva, motivo, id_usuario
  ) VALUES (
    v_negocio, p_id_insumo, 'AJUSTE_MANUAL', v_diff,
    v_anterior, p_nueva_cantidad, p_motivo, auth.uid()
  );

  RETURN p_nueva_cantidad;
END;
$$;
