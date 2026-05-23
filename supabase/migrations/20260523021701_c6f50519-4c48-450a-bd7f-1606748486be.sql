
-- Quitar auto-cierre de registrar_pago
CREATE OR REPLACE FUNCTION public.registrar_pago(p_id_mesa uuid, p_metodo metodo_pago, p_subtipo text, p_voucher text, p_url_comprobante text, p_item_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_uid uuid := auth.uid();
  v_id_pago uuid;
  v_monto numeric := 0;
  v_estado estado_pago;
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
  INTO v_monto
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  v_estado := CASE WHEN p_metodo='TRANSFERENCIA' THEN 'PENDIENTE'::estado_pago ELSE 'CONFIRMADO'::estado_pago END;

  INSERT INTO pagos (id_negocio, id_mesa, id_mesero, metodo, subtipo, monto, voucher, url_comprobante, estado_confirmacion, confirmado_por, confirmado_at)
  VALUES (v_negocio, p_id_mesa, v_uid, p_metodo, NULLIF(trim(p_subtipo),''), v_monto, NULLIF(trim(p_voucher),''), NULLIF(trim(p_url_comprobante),''), v_estado,
          CASE WHEN v_estado='CONFIRMADO' THEN v_uid ELSE NULL END,
          CASE WHEN v_estado='CONFIRMADO' THEN now() ELSE NULL END)
  RETURNING id_pago INTO v_id_pago;

  INSERT INTO pago_items (id_pago, id_item, monto)
  SELECT v_id_pago, i.id_item,
    i.cantidad * i.precio_unitario + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item=i.id_item),0)
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  UPDATE pedido_items SET pagado_at = now(), id_pago = v_id_pago
   WHERE id_item = ANY(p_item_ids);

  -- Marcar pedidos como PARCIAL si tiene mezcla pagados/no-pagados
  UPDATE pedidos SET estado='PARCIAL'
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado='CONFIRMADO'
     AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NOT NULL)
     AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NULL);

  RETURN v_id_pago;
END $function$;

-- Quitar auto-cierre de confirmar_pago_transferencia
CREATE OR REPLACE FUNCTION public.confirmar_pago_transferencia(p_id_pago uuid, p_aprobar boolean)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_uid uuid := auth.uid();
  v_rol text;
  v_id_mesa uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT rol::text INTO v_rol FROM usuarios_staff WHERE id_usuario=v_uid AND id_negocio=v_negocio;
  IF v_rol NOT IN ('ADMIN','SUPERADMIN') THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;

  SELECT id_mesa INTO v_id_mesa FROM pagos
   WHERE id_pago=p_id_pago AND id_negocio=v_negocio AND estado_confirmacion='PENDIENTE';
  IF v_id_mesa IS NULL THEN RAISE EXCEPTION 'Pago no encontrado o ya resuelto' USING ERRCODE='P0002'; END IF;

  IF p_aprobar THEN
    UPDATE pagos SET estado_confirmacion='CONFIRMADO', confirmado_por=v_uid, confirmado_at=now()
     WHERE id_pago=p_id_pago;
  ELSE
    UPDATE pedido_items SET pagado_at=NULL, id_pago=NULL WHERE id_pago=p_id_pago;
    UPDATE pagos SET estado_confirmacion='RECHAZADO', confirmado_por=v_uid, confirmado_at=now()
     WHERE id_pago=p_id_pago;
  END IF;
END $function$;

-- Nueva RPC cerrar_mesa
CREATE OR REPLACE FUNCTION public.cerrar_mesa(p_id_mesa uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_items_pend integer;
  v_pagos_pend integer;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_items_pend
  FROM pedido_items i JOIN pedidos p ON p.id_pedido=i.id_pedido
  WHERE p.id_mesa=p_id_mesa AND p.id_negocio=v_negocio AND p.estado <> 'PAGADO' AND i.pagado_at IS NULL;
  IF v_items_pend > 0 THEN
    RAISE EXCEPTION 'Quedan % items sin cobrar', v_items_pend USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_pagos_pend FROM pagos
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado_confirmacion='PENDIENTE';
  IF v_pagos_pend > 0 THEN
    RAISE EXCEPTION 'Hay % transferencias por confirmar', v_pagos_pend USING ERRCODE='42501';
  END IF;

  UPDATE pedidos SET estado='PAGADO', pagado_at=COALESCE(pagado_at, now())
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado <> 'PAGADO';

  UPDATE mesas SET estado='LIBRE', id_mesero_asignado=NULL, asignada_at=NULL, liberada_at=now(),
                   solicitud_cliente=NULL, solicitud_at=NULL
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio;
END $function$;
