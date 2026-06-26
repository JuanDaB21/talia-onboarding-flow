DROP FUNCTION IF EXISTS public.registrar_pago(uuid, metodo_pago, text, text, text, uuid[], numeric, uuid);
DROP FUNCTION IF EXISTS public.registrar_pago(uuid, metodo_pago, text, text, text, uuid[], numeric, uuid, uuid);

CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_id_mesa uuid,
  p_metodo metodo_pago,
  p_subtipo text,
  p_voucher text,
  p_url_comprobante text,
  p_item_ids uuid[],
  p_propina numeric DEFAULT 0,
  p_id_bono uuid DEFAULT NULL::uuid,
  p_id_reserva uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_negocio uuid;
  v_uid uuid := auth.uid();
  v_id_pago uuid;
  v_subtotal numeric := 0;
  v_descuento numeric := 0;
  v_descuento_neto numeric := 0;
  v_descuento_reserva numeric := 0;
  v_monto numeric := 0;
  v_estado estado_pago;
  v_bono record;
  v_reserva record;
  v_id_pedido uuid;
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
  IF p_id_bono IS NOT NULL AND p_id_reserva IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede combinar bono y abono de reserva' USING ERRCODE='23514';
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

  SELECT id_pedido INTO v_id_pedido FROM pedido_items WHERE id_item = p_item_ids[1];

  IF p_id_bono IS NOT NULL THEN
    SELECT id_bono, nombre, tipo, porcentaje, valor INTO v_bono
    FROM bonos WHERE id_bono = p_id_bono AND id_negocio = v_negocio AND activo = true;
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

  IF p_id_reserva IS NOT NULL THEN
    SELECT * INTO v_reserva FROM public.reservas
     WHERE id_reserva = p_id_reserva AND id_negocio = v_negocio
     FOR UPDATE;
    IF v_reserva.id_reserva IS NULL THEN
      RAISE EXCEPTION 'Reserva no encontrada' USING ERRCODE='P0002';
    END IF;
    IF v_reserva.estado NOT IN ('abonado','asistida') OR v_reserva.id_pedido_aplicado IS NOT NULL THEN
      RAISE EXCEPTION 'La reserva no tiene abono disponible' USING ERRCODE='42501';
    END IF;
    IF v_reserva.fecha_reserva <> CURRENT_DATE THEN
      RAISE EXCEPTION 'El abono solo aplica el mismo día de la reserva' USING ERRCODE='42501';
    END IF;
    IF v_reserva.monto_abonado <= 0 THEN
      RAISE EXCEPTION 'La reserva no tiene monto abonado' USING ERRCODE='42501';
    END IF;
    v_descuento_reserva := LEAST(v_subtotal, v_reserva.monto_abonado);
  END IF;

  v_monto := v_subtotal - v_descuento - v_descuento_reserva;
  IF v_monto < 0 THEN v_monto := 0; END IF;
  v_estado := CASE WHEN p_metodo='TRANSFERENCIA' THEN 'PENDIENTE'::estado_pago ELSE 'CONFIRMADO'::estado_pago END;

  INSERT INTO pagos (
    id_negocio, id_mesa, id_mesero, metodo, subtipo, monto, propina, voucher, url_comprobante,
    estado_confirmacion, confirmado_por, confirmado_at,
    id_bono, descuento_bono, descuento_neto
  ) VALUES (
    v_negocio, p_id_mesa, v_uid, p_metodo,
    CASE WHEN p_id_reserva IS NOT NULL
      THEN trim(concat(NULLIF(trim(p_subtipo),''), ' Reserva ', v_reserva.codigo_reserva))
      ELSE NULLIF(trim(p_subtipo),'') END,
    v_monto, p_propina,
    NULLIF(trim(p_voucher),''), NULLIF(trim(p_url_comprobante),''), v_estado,
    CASE WHEN v_estado='CONFIRMADO' THEN v_uid ELSE NULL END,
    CASE WHEN v_estado='CONFIRMADO' THEN now() ELSE NULL END,
    p_id_bono, v_descuento + v_descuento_reserva, v_descuento_neto
  ) RETURNING id_pago INTO v_id_pago;

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

  IF p_id_reserva IS NOT NULL THEN
    UPDATE public.reservas
       SET estado = 'asistida',
           id_pedido_aplicado = v_id_pedido,
           updated_at = now()
     WHERE id_reserva = p_id_reserva;
  END IF;

  PERFORM public.intentar_liberar_mesa_si_pagada(p_id_mesa);

  RETURN v_id_pago;
END;
$$;

CREATE OR REPLACE FUNCTION public.pagar_con_abono_reserva(
  p_id_reserva uuid,
  p_id_mesa uuid,
  p_item_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_negocio uuid := current_user_negocio();
  v_uid uuid := auth.uid();
  v_reserva record;
  v_subtotal numeric := 0;
  v_id_pago uuid;
  v_id_pedido uuid;
BEGIN
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF p_item_ids IS NULL OR array_length(p_item_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Selecciona al menos un item' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_reserva FROM public.reservas
   WHERE id_reserva = p_id_reserva AND id_negocio = v_negocio
   FOR UPDATE;
  IF v_reserva.id_reserva IS NULL THEN
    RAISE EXCEPTION 'Reserva no encontrada' USING ERRCODE='P0002';
  END IF;
  IF v_reserva.estado NOT IN ('abonado','asistida') OR v_reserva.id_pedido_aplicado IS NOT NULL THEN
    RAISE EXCEPTION 'La reserva no tiene abono disponible' USING ERRCODE='42501';
  END IF;
  IF v_reserva.fecha_reserva <> CURRENT_DATE THEN
    RAISE EXCEPTION 'El abono solo aplica el mismo día de la reserva' USING ERRCODE='42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_item_ids) AS x(id_item)
    WHERE NOT EXISTS (
      SELECT 1 FROM pedido_items i
      JOIN pedidos p ON p.id_pedido=i.id_pedido
      WHERE i.id_item=x.id_item AND p.id_negocio=v_negocio
        AND p.id_mesa=p_id_mesa AND i.pagado_at IS NULL
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

  IF v_subtotal > v_reserva.monto_abonado THEN
    RAISE EXCEPTION 'El abono no cubre el total seleccionado. Continúa con método de pago para cobrar el saldo.' USING ERRCODE='42501';
  END IF;

  SELECT id_pedido INTO v_id_pedido FROM pedido_items
   WHERE id_item = p_item_ids[1];

  INSERT INTO pagos (
    id_negocio, id_mesa, id_mesero, metodo, subtipo, monto, propina,
    estado_confirmacion, confirmado_por, confirmado_at,
    descuento_bono
  ) VALUES (
    v_negocio, p_id_mesa, v_uid, 'ABONO_RESERVA',
    'Reserva ' || v_reserva.codigo_reserva,
    v_subtotal, 0, 'CONFIRMADO', v_uid, now(), v_subtotal
  ) RETURNING id_pago INTO v_id_pago;

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

  UPDATE public.reservas
     SET estado = 'asistida',
         id_pedido_aplicado = v_id_pedido,
         updated_at = now()
   WHERE id_reserva = p_id_reserva;

  PERFORM public.intentar_liberar_mesa_si_pagada(p_id_mesa);

  RETURN v_id_pago;
END;
$$;