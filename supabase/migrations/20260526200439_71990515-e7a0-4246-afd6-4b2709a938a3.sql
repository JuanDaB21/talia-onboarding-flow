CREATE OR REPLACE FUNCTION public.agregar_item_pedido(p_id_pedido uuid, p_id_producto uuid, p_cantidad numeric, p_tiene_alergia boolean, p_nota text, p_extras jsonb, p_exclusiones jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_precio numeric;
  v_id_receta uuid;
  v_id_item uuid;
  v_first_id uuid;
  v_e jsonb;
  v_x jsonb;
  v_id_insumo uuid;
  v_cant numeric;
  v_pe numeric;
  v_estado_pedido estado_pedido;
  v_destino text;
  v_tiempo integer;
  v_n integer;
  v_i integer;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT estado INTO v_estado_pedido FROM pedidos WHERE id_pedido=p_id_pedido AND id_negocio=v_negocio;
  IF v_estado_pedido IS NULL OR v_estado_pedido NOT IN ('ABIERTO','CONFIRMADO') THEN
    RAISE EXCEPTION 'Pedido inválido o cerrado' USING ERRCODE='42501';
  END IF;

  SELECT precio_venta, id_receta INTO v_precio, v_id_receta
  FROM productos WHERE id_producto=p_id_producto AND id_negocio=v_negocio AND activo=true;
  IF v_precio IS NULL THEN RAISE EXCEPTION 'Producto inválido' USING ERRCODE='42501'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='23514'; END IF;

  v_n := GREATEST(1, floor(p_cantidad)::int);

  IF v_estado_pedido = 'CONFIRMADO' THEN
    SELECT c.destino, rm.tiempo_preparacion_min INTO v_destino, v_tiempo
    FROM productos pr
    JOIN receta_master rm ON rm.id_receta = pr.id_receta
    JOIN categorias c ON c.id_categoria = rm.id_categoria
    WHERE pr.id_producto = p_id_producto;
  END IF;

  FOR v_i IN 1..v_n LOOP
    INSERT INTO pedido_items (id_pedido, id_producto, cantidad, precio_unitario, tiene_alergia, nota, destino, tiempo_planeado_min)
    VALUES (p_id_pedido, p_id_producto, 1, v_precio, COALESCE(p_tiene_alergia,false), NULLIF(trim(p_nota),''), v_destino, v_tiempo)
    RETURNING id_item INTO v_id_item;

    IF v_first_id IS NULL THEN v_first_id := v_id_item; END IF;

    IF p_extras IS NOT NULL THEN
      FOR v_e IN SELECT * FROM jsonb_array_elements(p_extras) LOOP
        v_id_insumo := (v_e->>'id_insumo_extra')::uuid;
        SELECT cantidad_porcion, precio_extra INTO v_cant, v_pe
        FROM extras_permitidos WHERE id_producto = p_id_producto AND id_insumo_extra = v_id_insumo;
        IF v_cant IS NULL THEN RAISE EXCEPTION 'Extra no permitido' USING ERRCODE='42501'; END IF;
        INSERT INTO pedido_item_extras (id_item, id_insumo_extra, cantidad_porcion, precio_extra)
        VALUES (v_id_item, v_id_insumo, v_cant, v_pe);
      END LOOP;
    END IF;

    IF p_exclusiones IS NOT NULL THEN
      FOR v_x IN SELECT * FROM jsonb_array_elements(p_exclusiones) LOOP
        v_id_insumo := (v_x->>'id_insumo')::uuid;
        IF NOT EXISTS (SELECT 1 FROM receta_detalle WHERE id_receta=v_id_receta AND id_insumo=v_id_insumo) THEN
          RAISE EXCEPTION 'Exclusión no válida' USING ERRCODE='42501';
        END IF;
        INSERT INTO pedido_item_exclusiones (id_item, id_insumo) VALUES (v_id_item, v_id_insumo);
      END LOOP;
    END IF;
  END LOOP;

  PERFORM recalcular_total_pedido(p_id_pedido);
  RETURN v_first_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.editar_item_pedido(
  p_id_item uuid,
  p_cantidad numeric,
  p_tiene_alergia boolean,
  p_nota text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_id_pedido uuid;
  v_estado_item text;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  SELECT i.id_pedido, i.estado_preparacion
    INTO v_id_pedido, v_estado_item
  FROM pedido_items i JOIN pedidos p ON p.id_pedido=i.id_pedido
  WHERE i.id_item=p_id_item AND p.id_negocio=v_negocio;
  IF v_id_pedido IS NULL THEN RAISE EXCEPTION 'Item no encontrado' USING ERRCODE='P0002'; END IF;
  IF v_estado_item <> 'EN_COLA' THEN
    RAISE EXCEPTION 'No se puede editar un item que ya está en preparación' USING ERRCODE='42501';
  END IF;

  UPDATE pedido_items
  SET tiene_alergia = COALESCE(p_tiene_alergia, false),
      nota = NULLIF(trim(p_nota), '')
  WHERE id_item = p_id_item;

  PERFORM recalcular_total_pedido(v_id_pedido);
END;
$function$;