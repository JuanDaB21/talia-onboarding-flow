
-- Helper interna: libera la mesa si ya no quedan items ni pagos pendientes.
CREATE OR REPLACE FUNCTION public.intentar_liberar_mesa_si_pagada(p_id_mesa uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_negocio uuid;
  v_items_pend int;
  v_pagos_pend int;
BEGIN
  SELECT id_negocio INTO v_negocio FROM mesas WHERE id_mesa = p_id_mesa;
  IF v_negocio IS NULL THEN RETURN false; END IF;

  SELECT count(*) INTO v_items_pend
    FROM pedido_items i JOIN pedidos p ON p.id_pedido = i.id_pedido
   WHERE p.id_mesa = p_id_mesa AND p.id_negocio = v_negocio
     AND p.estado <> 'PAGADO' AND i.pagado_at IS NULL;
  IF v_items_pend > 0 THEN RETURN false; END IF;

  SELECT count(*) INTO v_pagos_pend FROM pagos
   WHERE id_mesa = p_id_mesa AND id_negocio = v_negocio
     AND estado_confirmacion = 'PENDIENTE';
  IF v_pagos_pend > 0 THEN RETURN false; END IF;

  -- Si no hay pedidos del todo, no liberar automáticamente (mesa nunca tuvo cuenta).
  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE id_mesa = p_id_mesa AND id_negocio = v_negocio) THEN
    RETURN false;
  END IF;

  UPDATE pedidos SET estado='PAGADO', pagado_at = COALESCE(pagado_at, now())
   WHERE id_mesa = p_id_mesa AND id_negocio = v_negocio AND estado <> 'PAGADO';

  UPDATE mesas SET estado='LIBRE', id_mesero_asignado=NULL, asignada_at=NULL,
                   liberada_at=now(), solicitud_cliente=NULL, solicitud_at=NULL
   WHERE id_mesa = p_id_mesa AND id_negocio = v_negocio;

  DELETE FROM prepedido_sesiones WHERE id_mesa = p_id_mesa;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.intentar_liberar_mesa_si_pagada(uuid) TO authenticated, service_role;

-- 1) solicitar_accion_cliente: al confirmar pedido, marcar OCUPADA.
CREATE OR REPLACE FUNCTION public.solicitar_accion_cliente(p_id_mesa uuid, p_tipo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_tipo NOT IN ('PEDIR_MAS','CUENTA','TOMAR_PEDIDO') THEN
    RAISE EXCEPTION 'Tipo inválido' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa) THEN
    RAISE EXCEPTION 'Mesa no encontrada' USING ERRCODE='P0002';
  END IF;

  UPDATE mesas
     SET solicitud_cliente = p_tipo,
         solicitud_at = now(),
         estado = CASE WHEN p_tipo = 'TOMAR_PEDIDO' AND estado = 'LIBRE'
                       THEN 'OCUPADA'::estado_mesa ELSE estado END,
         asignada_at = CASE WHEN p_tipo = 'TOMAR_PEDIDO' AND estado = 'LIBRE'
                            THEN now() ELSE asignada_at END
   WHERE id_mesa = p_id_mesa;
END;
$$;

-- 2) aceptar_prepedido_mesa: garantizar OCUPADA al final.
CREATE OR REPLACE FUNCTION public.aceptar_prepedido_mesa(p_id_mesa uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_negocio uuid;
  v_id_pedido uuid;
  v_estado_pedido estado_pedido;
  v_mesero uuid;
  v_count int := 0;
  v_rec record;
  v_extra jsonb;
  v_excl jsonb;
  v_var jsonb;
  v_id_item uuid;
  v_id_insumo uuid;
  v_cant numeric;
  v_pe numeric;
  v_destino text;
  v_tiempo integer;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;

  SELECT id_pedido, estado INTO v_id_pedido, v_estado_pedido
  FROM pedidos
   WHERE id_mesa = p_id_mesa
     AND id_negocio = v_negocio
     AND estado IN ('ABIERTO','CONFIRMADO')
   ORDER BY (estado = 'ABIERTO') DESC, created_at DESC
   LIMIT 1;

  IF v_id_pedido IS NULL THEN
    SELECT id_mesero_asignado INTO v_mesero FROM mesas WHERE id_mesa=p_id_mesa;
    INSERT INTO pedidos (id_negocio, id_mesa, id_mesero)
    VALUES (v_negocio, p_id_mesa, v_mesero)
    RETURNING id_pedido INTO v_id_pedido;
    v_estado_pedido := 'ABIERTO';
  END IF;

  FOR v_rec IN
    SELECT pi.* FROM prepedido_items pi
     WHERE pi.id_mesa = p_id_mesa
     ORDER BY pi.created_at ASC
  LOOP
    v_destino := NULL;
    v_tiempo := NULL;
    IF v_estado_pedido = 'CONFIRMADO' THEN
      SELECT c.destino, rm.tiempo_preparacion_min INTO v_destino, v_tiempo
      FROM productos pr
      JOIN receta_master rm ON rm.id_receta = pr.id_receta
      JOIN categorias c ON c.id_categoria = rm.id_categoria
      WHERE pr.id_producto = v_rec.id_producto;
    END IF;

    INSERT INTO pedido_items (
      id_pedido, id_producto, cantidad, precio_unitario, tiene_alergia, nota,
      destino, tiempo_planeado_min
    ) VALUES (
      v_id_pedido, v_rec.id_producto, v_rec.cantidad, v_rec.precio_unitario,
      COALESCE(v_rec.tiene_alergia,false), NULLIF(trim(coalesce(v_rec.nota,'')),''),
      v_destino, v_tiempo
    ) RETURNING id_item INTO v_id_item;

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
        VALUES (v_id_item, v_id_insumo) ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    IF v_rec.variantes IS NOT NULL THEN
      FOR v_var IN SELECT * FROM jsonb_array_elements(v_rec.variantes) LOOP
        INSERT INTO pedido_item_variantes (
          id_item, id_grupo, id_opcion, id_insumo_opcion,
          nombre_grupo, nombre_opcion, precio_delta, cantidad_porcion
        ) VALUES (
          v_id_item,
          NULLIF(v_var->>'id_grupo','')::uuid,
          NULLIF(v_var->>'id_opcion','')::uuid,
          NULLIF(v_var->>'id_insumo_opcion','')::uuid,
          COALESCE(v_var->>'nombre_grupo',''),
          COALESCE(v_var->>'nombre_opcion',''),
          COALESCE((v_var->>'precio_delta')::numeric, 0),
          COALESCE((v_var->>'cantidad_porcion')::numeric, 0)
        );
      END LOOP;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  DELETE FROM prepedido_sesiones WHERE id_mesa = p_id_mesa;

  PERFORM recalcular_total_pedido(v_id_pedido);

  -- Garantizar OCUPADA al confirmar prepedido.
  UPDATE mesas
     SET estado='OCUPADA'::estado_mesa,
         asignada_at = COALESCE(asignada_at, now()),
         solicitud_cliente = NULL,
         solicitud_at = NULL
   WHERE id_mesa = p_id_mesa AND id_negocio = v_negocio AND estado = 'LIBRE';

  -- Si seguía OCUPADA pero con solicitud TOMAR_PEDIDO, limpiarla porque ya se atendió.
  UPDATE mesas
     SET solicitud_cliente = NULL, solicitud_at = NULL
   WHERE id_mesa = p_id_mesa AND id_negocio = v_negocio
     AND solicitud_cliente = 'TOMAR_PEDIDO';

  RETURN v_count;
END;
$$;

-- 3) registrar_pago: liberar la mesa al final si ya no hay pendientes.
CREATE OR REPLACE FUNCTION public.registrar_pago(p_id_mesa uuid, p_metodo metodo_pago, p_subtipo text, p_voucher text, p_url_comprobante text, p_item_ids uuid[], p_propina numeric DEFAULT 0, p_id_bono uuid DEFAULT NULL::uuid)
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

  v_monto := v_subtotal - v_descuento;
  v_estado := CASE WHEN p_metodo='TRANSFERENCIA' THEN 'PENDIENTE'::estado_pago ELSE 'CONFIRMADO'::estado_pago END;

  INSERT INTO pagos (
    id_negocio, id_mesa, id_mesero, metodo, subtipo, monto, propina, voucher, url_comprobante,
    estado_confirmacion, confirmado_por, confirmado_at,
    id_bono, descuento_bono, descuento_neto
  ) VALUES (
    v_negocio, p_id_mesa, v_uid, p_metodo, NULLIF(trim(p_subtipo),''), v_monto, p_propina,
    NULLIF(trim(p_voucher),''), NULLIF(trim(p_url_comprobante),''), v_estado,
    CASE WHEN v_estado='CONFIRMADO' THEN v_uid ELSE NULL END,
    CASE WHEN v_estado='CONFIRMADO' THEN now() ELSE NULL END,
    p_id_bono, v_descuento, v_descuento_neto
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

  -- Liberar la mesa automáticamente si ya no quedan items ni pagos pendientes.
  PERFORM public.intentar_liberar_mesa_si_pagada(p_id_mesa);

  RETURN v_id_pago;
END;
$$;

-- 4) confirmar_pago_transferencia: al aprobar, intentar liberar mesa.
CREATE OR REPLACE FUNCTION public.confirmar_pago_transferencia(p_id_pago uuid, p_aprobar boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    PERFORM public.intentar_liberar_mesa_si_pagada(v_id_mesa);
  ELSE
    UPDATE pedido_items SET pagado_at=NULL, id_pago=NULL WHERE id_pago=p_id_pago;
    UPDATE pagos SET estado_confirmacion='RECHAZADO', confirmado_por=v_uid, confirmado_at=now()
     WHERE id_pago=p_id_pago;
  END IF;
END;
$$;
