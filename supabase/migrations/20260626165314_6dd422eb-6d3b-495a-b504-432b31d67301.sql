
-- Soporte para bonos por valor fijo además de porcentaje
ALTER TABLE public.bonos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'PORCENTAJE',
  ADD COLUMN IF NOT EXISTS valor numeric NOT NULL DEFAULT 0;

ALTER TABLE public.bonos ALTER COLUMN porcentaje DROP NOT NULL;

ALTER TABLE public.bonos DROP CONSTRAINT IF EXISTS bonos_porcentaje_check;
ALTER TABLE public.bonos DROP CONSTRAINT IF EXISTS bonos_tipo_check;
ALTER TABLE public.bonos DROP CONSTRAINT IF EXISTS bonos_valor_check;
ALTER TABLE public.bonos DROP CONSTRAINT IF EXISTS bonos_tipo_valor_check;

ALTER TABLE public.bonos
  ADD CONSTRAINT bonos_tipo_check CHECK (tipo IN ('PORCENTAJE','VALOR')),
  ADD CONSTRAINT bonos_porcentaje_check CHECK (porcentaje IS NULL OR (porcentaje > 0 AND porcentaje <= 100)),
  ADD CONSTRAINT bonos_valor_check CHECK (valor >= 0),
  ADD CONSTRAINT bonos_tipo_valor_check CHECK (
    (tipo = 'PORCENTAJE' AND porcentaje IS NOT NULL AND porcentaje > 0)
    OR (tipo = 'VALOR' AND valor > 0)
  );

-- RPC registrar_pago: aplicar descuento según tipo de bono
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
  v_pct_aplicado numeric := 0;
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

  IF p_id_bono IS NOT NULL THEN
    SELECT id_bono, nombre, tipo, porcentaje, valor INTO v_bono
    FROM bonos
    WHERE id_bono = p_id_bono AND id_negocio = v_negocio AND activo = true;
    IF v_bono.id_bono IS NULL THEN
      RAISE EXCEPTION 'Bono inválido o inactivo' USING ERRCODE='42501';
    END IF;

    IF v_bono.tipo = 'PORCENTAJE' THEN
      v_descuento := round(v_subtotal * v_bono.porcentaje / 100);
      v_pct_aplicado := v_bono.porcentaje;
    ELSE
      v_descuento := v_bono.valor;
      v_pct_aplicado := CASE WHEN v_subtotal > 0
        THEN round((LEAST(v_descuento, v_subtotal) * 100.0 / v_subtotal)::numeric, 2)
        ELSE 0 END;
    END IF;
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

  INSERT INTO pago_items (id_pago, id_item, monto)
  SELECT v_id_pago, i.id_item,
    i.cantidad * i.precio_unitario + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item=i.id_item),0)
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  UPDATE pedido_items SET pagado_at = now(), id_pago = v_id_pago
   WHERE id_item = ANY(p_item_ids);

  UPDATE pedidos SET estado='PARCIAL'
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado='CONFIRMADO'
     AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NOT NULL)
     AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NULL);

  IF p_id_bono IS NOT NULL THEN
    INSERT INTO bono_aplicaciones (
      id_negocio, id_bono, id_pago, id_mesa, id_mesero,
      nombre_bono, porcentaje_aplicado, subtotal_items, monto_descuento, monto_descuento_neto
    ) VALUES (
      v_negocio, v_bono.id_bono, v_id_pago, p_id_mesa, v_uid,
      v_bono.nombre, v_pct_aplicado, v_subtotal, v_descuento, v_descuento_neto
    );
  END IF;

  RETURN v_id_pago;
END;
$$;
