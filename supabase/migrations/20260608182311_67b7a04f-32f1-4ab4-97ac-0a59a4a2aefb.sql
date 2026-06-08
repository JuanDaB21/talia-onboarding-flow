
-- ============================================================
-- Tabla bonos
-- ============================================================
CREATE TABLE public.bonos (
  id_bono uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  nombre text NOT NULL,
  porcentaje numeric(5,2) NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonos_porcentaje_check CHECK (porcentaje > 0 AND porcentaje <= 100),
  CONSTRAINT bonos_nombre_check CHECK (length(trim(nombre)) > 0)
);
CREATE INDEX idx_bonos_negocio ON public.bonos(id_negocio);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonos TO authenticated;
GRANT ALL ON public.bonos TO service_role;

ALTER TABLE public.bonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bonos_select_own" ON public.bonos
  FOR SELECT TO authenticated
  USING (id_negocio = current_user_negocio());

CREATE POLICY "bonos_admin_insert" ON public.bonos
  FOR INSERT TO authenticated
  WITH CHECK (
    id_negocio = current_user_negocio()
    AND EXISTS (
      SELECT 1 FROM public.usuarios_staff
      WHERE id_usuario = auth.uid()
        AND rol IN ('ADMIN','SUPERADMIN')
    )
  );

CREATE POLICY "bonos_admin_update" ON public.bonos
  FOR UPDATE TO authenticated
  USING (
    id_negocio = current_user_negocio()
    AND EXISTS (
      SELECT 1 FROM public.usuarios_staff
      WHERE id_usuario = auth.uid()
        AND rol IN ('ADMIN','SUPERADMIN')
    )
  )
  WITH CHECK (id_negocio = current_user_negocio());

CREATE POLICY "bonos_admin_delete" ON public.bonos
  FOR DELETE TO authenticated
  USING (
    id_negocio = current_user_negocio()
    AND EXISTS (
      SELECT 1 FROM public.usuarios_staff
      WHERE id_usuario = auth.uid()
        AND rol IN ('ADMIN','SUPERADMIN')
    )
  );

CREATE TRIGGER bonos_touch BEFORE UPDATE ON public.bonos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Columnas nuevas en pagos
-- ============================================================
ALTER TABLE public.pagos
  ADD COLUMN id_bono uuid REFERENCES public.bonos(id_bono) ON DELETE SET NULL,
  ADD COLUMN descuento_bono numeric NOT NULL DEFAULT 0,
  ADD COLUMN descuento_neto numeric NOT NULL DEFAULT 0;

-- Relajar check de monto: ahora puede ser 0 si el bono es 100%
ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_monto_check;
ALTER TABLE public.pagos ADD CONSTRAINT pagos_monto_check CHECK (monto >= 0);

-- ============================================================
-- Tabla bono_aplicaciones (historial)
-- ============================================================
CREATE TABLE public.bono_aplicaciones (
  id_aplicacion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  id_bono uuid REFERENCES public.bonos(id_bono) ON DELETE SET NULL,
  id_pago uuid NOT NULL REFERENCES public.pagos(id_pago) ON DELETE CASCADE,
  id_mesa uuid REFERENCES public.mesas(id_mesa) ON DELETE SET NULL,
  id_mesero uuid,
  nombre_bono text NOT NULL,
  porcentaje_aplicado numeric(5,2) NOT NULL,
  subtotal_items numeric NOT NULL,
  monto_descuento numeric NOT NULL,
  monto_descuento_neto numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bono_apl_negocio_created ON public.bono_aplicaciones(id_negocio, created_at DESC);
CREATE INDEX idx_bono_apl_mesero ON public.bono_aplicaciones(id_mesero);
CREATE INDEX idx_bono_apl_bono ON public.bono_aplicaciones(id_bono);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bono_aplicaciones TO authenticated;
GRANT ALL ON public.bono_aplicaciones TO service_role;

ALTER TABLE public.bono_aplicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bono_apl_select_own" ON public.bono_aplicaciones
  FOR SELECT TO authenticated
  USING (id_negocio = current_user_negocio());

-- Escritura solo vía SECURITY DEFINER (registrar_pago). No CREATE POLICY para insert/update/delete.

-- ============================================================
-- Función calcular_costo_items
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_costo_items(p_item_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_costo numeric := 0;
  v_precio numeric := 0;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  -- Precio de los items (incluye extras)
  SELECT COALESCE(SUM(
    i.cantidad * i.precio_unitario
    + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item = i.id_item),0)
  ),0)
  INTO v_precio
  FROM pedido_items i
  JOIN pedidos p ON p.id_pedido = i.id_pedido
  WHERE i.id_item = ANY(p_item_ids) AND p.id_negocio = v_negocio;

  -- Costo estimado por receta: cantidad_item * SUM(rd.cantidad * insumo.costo_promedio)
  SELECT COALESCE(SUM(
    i.cantidad * COALESCE((
      SELECT SUM(rd.cantidad * ins.costo_promedio)
      FROM productos pr
      JOIN receta_detalle rd ON rd.id_receta = pr.id_receta
      JOIN insumos ins ON ins.id_insumo = rd.id_insumo
      WHERE pr.id_producto = i.id_producto
    ), 0)
  ),0)
  INTO v_costo
  FROM pedido_items i
  JOIN pedidos p ON p.id_pedido = i.id_pedido
  WHERE i.id_item = ANY(p_item_ids) AND p.id_negocio = v_negocio;

  RETURN jsonb_build_object('precio_total', v_precio, 'costo_total', v_costo);
END;
$$;

-- ============================================================
-- Reemplazo de registrar_pago con soporte de bono
-- ============================================================
DROP FUNCTION IF EXISTS public.registrar_pago(uuid, metodo_pago, text, text, text, uuid[]);
DROP FUNCTION IF EXISTS public.registrar_pago(uuid, metodo_pago, text, text, text, uuid[], numeric);

CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_id_mesa uuid,
  p_metodo metodo_pago,
  p_subtipo text,
  p_voucher text,
  p_url_comprobante text,
  p_item_ids uuid[],
  p_propina numeric DEFAULT 0,
  p_id_bono uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_uid uuid := auth.uid();
  v_id_pago uuid;
  v_subtotal numeric := 0;
  v_descuento numeric := 0;
  v_descuento_neto numeric := 0;
  v_monto numeric := 0;
  v_estado estado_pago;
  v_bono record;
  v_costos jsonb;
  v_precio_total numeric := 0;
  v_costo_total numeric := 0;
  v_margen numeric := 0;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;
  IF p_item_ids IS NULL OR array_length(p_item_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Sin items' USING ERRCODE='23514';
  END IF;
  IF p_metodo = 'TRANSFERENCIA' AND (p_url_comprobante IS NULL OR length(p_url_comprobante)=0) THEN
    RAISE EXCEPTION 'Comprobante requerido' USING ERRCODE='23514';
  END IF;
  IF p_propina IS NULL OR p_propina < 0 THEN
    RAISE EXCEPTION 'Propina inválida' USING ERRCODE='23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_item_ids) AS x(id_item)
    WHERE NOT EXISTS (
      SELECT 1 FROM pedido_items i
      JOIN pedidos p ON p.id_pedido=i.id_pedido
      WHERE i.id_item=x.id_item AND p.id_negocio=v_negocio AND p.id_mesa=p_id_mesa AND i.pagado_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Items inválidos o ya pagados' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(SUM(
    i.cantidad * i.precio_unitario
    + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item=i.id_item),0)
  ),0)
  INTO v_subtotal
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  -- Bono
  IF p_id_bono IS NOT NULL THEN
    SELECT id_bono, nombre, porcentaje INTO v_bono
    FROM bonos
    WHERE id_bono = p_id_bono AND id_negocio = v_negocio AND activo = true;
    IF v_bono.id_bono IS NULL THEN
      RAISE EXCEPTION 'Bono inválido o inactivo' USING ERRCODE='42501';
    END IF;

    v_descuento := round(v_subtotal * v_bono.porcentaje / 100);
    IF v_descuento > v_subtotal THEN v_descuento := v_subtotal; END IF;

    v_costos := calcular_costo_items(p_item_ids);
    v_precio_total := COALESCE((v_costos->>'precio_total')::numeric, 0);
    v_costo_total := COALESCE((v_costos->>'costo_total')::numeric, 0);
    IF v_precio_total > 0 THEN
      v_margen := GREATEST(0, (v_precio_total - v_costo_total) / v_precio_total);
    ELSE
      v_margen := 0;
    END IF;
    v_descuento_neto := round(v_descuento * v_margen);
  END IF;

  v_monto := v_subtotal - v_descuento;

  v_estado := CASE WHEN p_metodo='TRANSFERENCIA' THEN 'PENDIENTE'::estado_pago ELSE 'CONFIRMADO'::estado_pago END;

  INSERT INTO pagos (
    id_negocio, id_mesa, id_mesero, metodo, subtipo, monto, propina, voucher, url_comprobante,
    estado_confirmacion, confirmado_por, confirmado_at,
    id_bono, descuento_bono, descuento_neto
  )
  VALUES (
    v_negocio, p_id_mesa, v_uid, p_metodo, NULLIF(trim(p_subtipo),''), v_monto, p_propina,
    NULLIF(trim(p_voucher),''), NULLIF(trim(p_url_comprobante),''), v_estado,
    CASE WHEN v_estado='CONFIRMADO' THEN v_uid ELSE NULL END,
    CASE WHEN v_estado='CONFIRMADO' THEN now() ELSE NULL END,
    p_id_bono, v_descuento, v_descuento_neto
  )
  RETURNING id_pago INTO v_id_pago;

  -- Items (monto aquí refleja precio base de cada item; no se prorratea descuento por item)
  INSERT INTO pago_items (id_pago, id_item, monto)
  SELECT v_id_pago, i.id_item,
    i.cantidad * i.precio_unitario + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item=i.id_item),0)
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  UPDATE pedido_items SET pagado_at = now(), id_pago = v_id_pago
   WHERE id_item = ANY(p_item_ids);

  -- PARCIAL
  UPDATE pedidos SET estado='PARCIAL'
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado='CONFIRMADO'
     AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NOT NULL)
     AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NULL);

  -- Bono aplicación
  IF p_id_bono IS NOT NULL THEN
    INSERT INTO bono_aplicaciones (
      id_negocio, id_bono, id_pago, id_mesa, id_mesero,
      nombre_bono, porcentaje_aplicado, subtotal_items, monto_descuento, monto_descuento_neto
    ) VALUES (
      v_negocio, v_bono.id_bono, v_id_pago, p_id_mesa, v_uid,
      v_bono.nombre, v_bono.porcentaje, v_subtotal, v_descuento, v_descuento_neto
    );
  END IF;

  RETURN v_id_pago;
END;
$$;
