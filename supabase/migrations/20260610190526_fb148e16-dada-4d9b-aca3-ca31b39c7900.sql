
-- 1) cerrar_mesa: limpiar prepedido al cerrar
CREATE OR REPLACE FUNCTION public.cerrar_mesa(p_id_mesa uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  DELETE FROM prepedido_sesiones WHERE id_mesa = p_id_mesa;
END $function$;

-- 2) cerrar_cuenta_mesa: limpiar prepedido al cerrar
CREATE OR REPLACE FUNCTION public.cerrar_cuenta_mesa(p_id_mesa uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_total numeric := 0;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(SUM(total),0) INTO v_total FROM pedidos
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado IN ('ABIERTO','CONFIRMADO');

  UPDATE pedidos SET estado='PAGADO', pagado_at=now()
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado IN ('ABIERTO','CONFIRMADO');

  UPDATE mesas SET
    estado='LIBRE',
    id_mesero_asignado=NULL,
    asignada_at=NULL,
    liberada_at=now(),
    solicitud_cliente=NULL,
    solicitud_at=NULL
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio;

  DELETE FROM prepedido_sesiones WHERE id_mesa = p_id_mesa;

  RETURN v_total;
END;
$function$;

-- 3) aceptar_prepedido_mesa: limpiar sesiones también
CREATE OR REPLACE FUNCTION public.aceptar_prepedido_mesa(p_id_mesa uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_id_pedido uuid;
  v_mesero uuid;
  v_count int := 0;
  v_rec record;
  v_extra jsonb;
  v_excl jsonb;
  v_id_item uuid;
  v_id_insumo uuid;
  v_cant numeric;
  v_pe numeric;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;

  SELECT id_pedido INTO v_id_pedido FROM pedidos
   WHERE id_mesa=p_id_mesa AND estado='ABIERTO' AND id_negocio=v_negocio;
  IF v_id_pedido IS NULL THEN
    SELECT id_mesero_asignado INTO v_mesero FROM mesas WHERE id_mesa=p_id_mesa;
    INSERT INTO pedidos (id_negocio, id_mesa, id_mesero)
    VALUES (v_negocio, p_id_mesa, v_mesero)
    RETURNING id_pedido INTO v_id_pedido;
  END IF;

  FOR v_rec IN
    SELECT pi.*
    FROM prepedido_items pi
    WHERE pi.id_mesa = p_id_mesa
    ORDER BY pi.created_at ASC
  LOOP
    INSERT INTO pedido_items (
      id_pedido, id_producto, cantidad, precio_unitario, tiene_alergia, nota
    ) VALUES (
      v_id_pedido, v_rec.id_producto, v_rec.cantidad, v_rec.precio_unitario,
      COALESCE(v_rec.tiene_alergia,false), NULLIF(trim(coalesce(v_rec.nota,'')),'')
    )
    RETURNING id_item INTO v_id_item;

    IF v_rec.extras IS NOT NULL THEN
      FOR v_extra IN SELECT * FROM jsonb_array_elements(v_rec.extras) LOOP
        v_id_insumo := (v_extra->>'id_insumo_extra')::uuid;
        SELECT cantidad_porcion, precio_extra INTO v_cant, v_pe
        FROM extras_permitidos
        WHERE id_producto = v_rec.id_producto AND id_insumo_extra = v_id_insumo;
        IF v_cant IS NULL THEN CONTINUE; END IF;
        INSERT INTO pedido_item_extras (id_item, id_insumo_extra, cantidad_porcion, precio_extra)
        VALUES (v_id_item, v_id_insumo, v_cant, v_pe);
      END LOOP;
    END IF;

    IF v_rec.exclusiones IS NOT NULL THEN
      FOR v_excl IN SELECT * FROM jsonb_array_elements(v_rec.exclusiones) LOOP
        v_id_insumo := (v_excl->>'id_insumo')::uuid;
        INSERT INTO pedido_item_exclusiones (id_item, id_insumo)
        VALUES (v_id_item, v_id_insumo)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  DELETE FROM prepedido_sesiones WHERE id_mesa = p_id_mesa;

  PERFORM recalcular_total_pedido(v_id_pedido);
  RETURN v_count;
END;
$function$;

-- 4) Nueva función de purga por inactividad
CREATE OR REPLACE FUNCTION public.purgar_prepedido_inactivo()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  WITH borradas AS (
    DELETE FROM public.prepedido_sesiones
    WHERE last_seen_at < now() - interval '4 hours'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM borradas;
  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.purgar_prepedido_inactivo() TO anon, authenticated, service_role;
