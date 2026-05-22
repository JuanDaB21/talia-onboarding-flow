
CREATE OR REPLACE FUNCTION public.registrar_compra(
  p_id_proveedor uuid,
  p_numero_factura text,
  p_observaciones text,
  p_fecha_compra date,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_id_compra uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_id_insumo uuid;
  v_cantidad numeric;
  v_precio numeric;
  v_subtotal numeric;
  v_factor numeric;
  v_anterior numeric;
  v_convertida numeric;
  v_nueva numeric;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_id_proveedor IS NULL THEN
    RAISE EXCEPTION 'Proveedor requerido' USING ERRCODE = '23502';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe registrar al menos un insumo' USING ERRCODE = '23514';
  END IF;

  -- Validar proveedor pertenece al negocio
  IF NOT EXISTS (
    SELECT 1 FROM proveedores
    WHERE id_proveedor = p_id_proveedor AND id_negocio = v_negocio
  ) THEN
    RAISE EXCEPTION 'Proveedor inválido' USING ERRCODE = '42501';
  END IF;

  -- Calcular total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario_compra')::numeric;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE = '23514';
    END IF;
    IF v_precio IS NULL OR v_precio < 0 THEN
      RAISE EXCEPTION 'Precio inválido' USING ERRCODE = '23514';
    END IF;
    v_total := v_total + (v_cantidad * v_precio);
  END LOOP;

  -- Insertar compra
  INSERT INTO compras (
    id_negocio, id_proveedor, numero_factura, fecha_compra, estado, total, observaciones
  ) VALUES (
    v_negocio, p_id_proveedor, NULLIF(trim(p_numero_factura), ''),
    COALESCE(p_fecha_compra, CURRENT_DATE), 'COMPLETADA', v_total,
    NULLIF(trim(p_observaciones), '')
  ) RETURNING id_compra INTO v_id_compra;

  -- Procesar cada ítem
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_id_insumo := (v_item->>'id_insumo')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario_compra')::numeric;
    v_subtotal := v_cantidad * v_precio;

    -- Validar insumo del negocio + obtener factor
    SELECT factor_conversion INTO v_factor
    FROM insumos
    WHERE id_insumo = v_id_insumo AND id_negocio = v_negocio;

    IF v_factor IS NULL THEN
      RAISE EXCEPTION 'Insumo inválido: %', v_id_insumo USING ERRCODE = '42501';
    END IF;

    -- Insertar detalle
    INSERT INTO detalle_compra (
      id_compra, id_insumo, cantidad, precio_unitario_compra, subtotal
    ) VALUES (
      v_id_compra, v_id_insumo, v_cantidad, v_precio, v_subtotal
    );

    -- Cantidad convertida a unidad de receta/inventario
    v_convertida := v_cantidad * v_factor;

    -- Bloquear y obtener stock anterior
    SELECT cantidad_actual INTO v_anterior
    FROM inventario_actual
    WHERE id_insumo = v_id_insumo AND id_negocio = v_negocio
    FOR UPDATE;

    IF v_anterior IS NULL THEN
      -- Crear si no existe (defensa, trigger ya debería haberlo hecho)
      INSERT INTO inventario_actual (id_negocio, id_insumo, cantidad_actual)
      VALUES (v_negocio, v_id_insumo, 0);
      v_anterior := 0;
    END IF;

    v_nueva := v_anterior + v_convertida;

    UPDATE inventario_actual
    SET cantidad_actual = v_nueva, updated_at = now()
    WHERE id_insumo = v_id_insumo AND id_negocio = v_negocio;

    -- Movimiento
    INSERT INTO movimientos_inventario (
      id_negocio, id_insumo, tipo_movimiento, cantidad,
      cantidad_anterior, cantidad_nueva, motivo, referencia_id, id_usuario
    ) VALUES (
      v_negocio, v_id_insumo, 'COMPRA', v_convertida,
      v_anterior, v_nueva,
      'Compra factura ' || COALESCE(NULLIF(trim(p_numero_factura), ''), v_id_compra::text)
        || ' @ ' || v_precio::text,
      v_id_compra, auth.uid()
    );
  END LOOP;

  RETURN v_id_compra;
END;
$$;
