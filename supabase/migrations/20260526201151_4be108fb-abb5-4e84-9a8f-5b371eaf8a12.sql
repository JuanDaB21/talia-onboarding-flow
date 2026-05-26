
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS propina numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_id_mesa uuid,
  p_metodo metodo_pago,
  p_subtipo text,
  p_voucher text,
  p_url_comprobante text,
  p_item_ids uuid[],
  p_propina numeric DEFAULT 0
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  INTO v_monto
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  v_estado := CASE WHEN p_metodo='TRANSFERENCIA' THEN 'PENDIENTE'::estado_pago ELSE 'CONFIRMADO'::estado_pago END;

  INSERT INTO pagos (id_negocio, id_mesa, id_mesero, metodo, subtipo, monto, propina, voucher, url_comprobante, estado_confirmacion, confirmado_por, confirmado_at)
  VALUES (v_negocio, p_id_mesa, v_uid, p_metodo, NULLIF(trim(p_subtipo),''), v_monto, p_propina, NULLIF(trim(p_voucher),''), NULLIF(trim(p_url_comprobante),''), v_estado,
          CASE WHEN v_estado='CONFIRMADO' THEN v_uid ELSE NULL END,
          CASE WHEN v_estado='CONFIRMADO' THEN now() ELSE NULL END)
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

  RETURN v_id_pago;
END $function$;
