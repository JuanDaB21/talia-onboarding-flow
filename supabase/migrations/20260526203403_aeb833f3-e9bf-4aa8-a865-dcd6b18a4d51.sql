
CREATE OR REPLACE FUNCTION public.descontar_inventario_item(p_id_item uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_id_producto uuid;
  v_id_receta uuid;
  v_cant_item numeric;
  v_rec record;
  v_consumo numeric;
  v_anterior numeric;
  v_nueva numeric;
BEGIN
  SELECT p.id_negocio, i.id_producto, i.cantidad
    INTO v_negocio, v_id_producto, v_cant_item
  FROM pedido_items i
  JOIN pedidos p ON p.id_pedido = i.id_pedido
  WHERE i.id_item = p_id_item;

  IF v_negocio IS NULL THEN RETURN; END IF;

  SELECT id_receta INTO v_id_receta FROM productos WHERE id_producto = v_id_producto;
  IF v_id_receta IS NULL THEN RETURN; END IF;

  FOR v_rec IN
    WITH receta AS (
      SELECT rd.id_insumo, rd.cantidad AS cantidad
      FROM receta_detalle rd
      WHERE rd.id_receta = v_id_receta
        AND NOT EXISTS (
          SELECT 1 FROM pedido_item_exclusiones x
          WHERE x.id_item = p_id_item AND x.id_insumo = rd.id_insumo
        )
    ),
    extras AS (
      SELECT e.id_insumo_extra AS id_insumo, e.cantidad_porcion AS cantidad
      FROM pedido_item_extras e
      WHERE e.id_item = p_id_item
    ),
    todo AS (
      SELECT id_insumo, cantidad FROM receta
      UNION ALL
      SELECT id_insumo, cantidad FROM extras
    )
    SELECT id_insumo, SUM(cantidad) AS total FROM todo GROUP BY id_insumo
  LOOP
    v_consumo := v_rec.total * COALESCE(v_cant_item, 1);
    IF v_consumo IS NULL OR v_consumo <= 0 THEN CONTINUE; END IF;

    SELECT cantidad_actual INTO v_anterior
    FROM inventario_actual
    WHERE id_insumo = v_rec.id_insumo AND id_negocio = v_negocio
    FOR UPDATE;

    IF v_anterior IS NULL THEN
      INSERT INTO inventario_actual (id_negocio, id_insumo, cantidad_actual)
      VALUES (v_negocio, v_rec.id_insumo, 0);
      v_anterior := 0;
    END IF;

    v_nueva := v_anterior - v_consumo;

    UPDATE inventario_actual
       SET cantidad_actual = v_nueva, updated_at = now()
     WHERE id_insumo = v_rec.id_insumo AND id_negocio = v_negocio;

    INSERT INTO movimientos_inventario (
      id_negocio, id_insumo, tipo_movimiento, cantidad,
      cantidad_anterior, cantidad_nueva, motivo, referencia_id, id_usuario
    ) VALUES (
      v_negocio, v_rec.id_insumo, 'CONSUMO_PREPARACION', -v_consumo,
      v_anterior, v_nueva,
      'Consumo por preparación item ' || p_id_item::text,
      p_id_item, auth.uid()
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.avanzar_estado_item(p_id_item uuid, p_nuevo_estado text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_rol rol_staff;
  v_estado_actual text;
  v_destino text;
  v_id_pedido uuid;
  v_iniciado timestamptz;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  SELECT rol INTO v_rol FROM usuarios_staff WHERE id_usuario = auth.uid();
  IF v_rol IS NULL THEN RAISE EXCEPTION 'Sin rol' USING ERRCODE='42501'; END IF;

  SELECT i.estado_preparacion, i.destino, i.id_pedido, i.iniciado_at
    INTO v_estado_actual, v_destino, v_id_pedido, v_iniciado
  FROM pedido_items i
  JOIN pedidos p ON p.id_pedido = i.id_pedido
  WHERE i.id_item = p_id_item AND p.id_negocio = v_negocio;
  IF v_estado_actual IS NULL THEN RAISE EXCEPTION 'Item no encontrado' USING ERRCODE='P0002'; END IF;

  IF p_nuevo_estado NOT IN ('EN_PREPARACION','LISTO','ENTREGADO') THEN
    RAISE EXCEPTION 'Estado inválido' USING ERRCODE='23514';
  END IF;

  IF (v_estado_actual = 'EN_COLA' AND p_nuevo_estado <> 'EN_PREPARACION')
     OR (v_estado_actual = 'EN_PREPARACION' AND p_nuevo_estado <> 'LISTO')
     OR (v_estado_actual = 'LISTO' AND p_nuevo_estado <> 'ENTREGADO')
     OR (v_estado_actual = 'ENTREGADO') THEN
    RAISE EXCEPTION 'Transición no permitida (% -> %)', v_estado_actual, p_nuevo_estado USING ERRCODE='42501';
  END IF;

  IF p_nuevo_estado IN ('EN_PREPARACION','LISTO') THEN
    IF v_destino = 'COCINA' AND v_rol NOT IN ('COCINA','ADMIN','SUPERADMIN') THEN
      RAISE EXCEPTION 'Solo cocina puede avanzar este item' USING ERRCODE='42501';
    END IF;
    IF v_destino = 'BARRA' AND v_rol NOT IN ('BARRA','ADMIN','SUPERADMIN') THEN
      RAISE EXCEPTION 'Solo barra puede avanzar este item' USING ERRCODE='42501';
    END IF;
  ELSIF p_nuevo_estado = 'ENTREGADO' THEN
    IF v_rol NOT IN ('MESERO','COCINA','BARRA','ADMIN','SUPERADMIN') THEN
      RAISE EXCEPTION 'No autorizado a entregar' USING ERRCODE='42501';
    END IF;
  END IF;

  IF p_nuevo_estado = 'EN_PREPARACION' AND v_iniciado IS NULL THEN
    PERFORM public.descontar_inventario_item(p_id_item);
  END IF;

  UPDATE pedido_items
  SET estado_preparacion = p_nuevo_estado,
      iniciado_at  = CASE WHEN p_nuevo_estado='EN_PREPARACION' THEN now() ELSE iniciado_at END,
      listo_at     = CASE WHEN p_nuevo_estado='LISTO'          THEN now() ELSE listo_at END,
      entregado_at = CASE WHEN p_nuevo_estado='ENTREGADO'      THEN now() ELSE entregado_at END
  WHERE id_item = p_id_item;

  RETURN p_nuevo_estado;
END;
$$;

CREATE OR REPLACE FUNCTION public.iniciar_comanda_estacion(p_id_pedido uuid, p_destino text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_rol rol_staff;
  v_count integer := 0;
  v_id uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT rol INTO v_rol FROM usuarios_staff WHERE id_usuario = auth.uid();
  IF v_rol IS NULL THEN RAISE EXCEPTION 'Sin rol' USING ERRCODE='42501'; END IF;

  IF p_destino NOT IN ('COCINA','BARRA') THEN
    RAISE EXCEPTION 'Destino inválido' USING ERRCODE='23514';
  END IF;
  IF p_destino = 'COCINA' AND v_rol NOT IN ('COCINA','ADMIN','SUPERADMIN') THEN
    RAISE EXCEPTION 'Solo cocina puede iniciar' USING ERRCODE='42501';
  END IF;
  IF p_destino = 'BARRA' AND v_rol NOT IN ('BARRA','ADMIN','SUPERADMIN') THEN
    RAISE EXCEPTION 'Solo barra puede iniciar' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pedidos WHERE id_pedido = p_id_pedido AND id_negocio = v_negocio AND estado = 'CONFIRMADO'
  ) THEN
    RAISE EXCEPTION 'Pedido inválido' USING ERRCODE='42501';
  END IF;

  FOR v_id IN
    SELECT id_item FROM pedido_items
    WHERE id_pedido = p_id_pedido
      AND destino = p_destino
      AND estado_preparacion = 'EN_COLA'
      AND iniciado_at IS NULL
  LOOP
    PERFORM public.descontar_inventario_item(v_id);
    v_count := v_count + 1;
  END LOOP;

  UPDATE pedido_items
  SET estado_preparacion = 'EN_PREPARACION',
      iniciado_at = COALESCE(iniciado_at, now())
  WHERE id_pedido = p_id_pedido
    AND destino = p_destino
    AND estado_preparacion = 'EN_COLA';

  RETURN v_count;
END;
$$;
