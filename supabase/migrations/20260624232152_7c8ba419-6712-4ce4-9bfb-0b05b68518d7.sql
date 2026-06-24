
-- 1. Recalcular total ahora incluye variantes
CREATE OR REPLACE FUNCTION public.recalcular_total_pedido(p_id_pedido uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE pedidos SET total = COALESCE((
    SELECT SUM(i.cantidad * (
      i.precio_unitario
      + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item = i.id_item), 0)
      + COALESCE((SELECT SUM(v.precio_delta) FROM pedido_item_variantes v WHERE v.id_item = i.id_item), 0)
    ))
    FROM pedido_items i WHERE i.id_pedido = p_id_pedido
  ), 0)
  WHERE id_pedido = p_id_pedido;
END;
$function$;

-- 2. aceptar_prepedido_mesa también copia variantes
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
  v_var jsonb;
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

    IF v_rec.variantes IS NOT NULL THEN
      FOR v_var IN SELECT * FROM jsonb_array_elements(v_rec.variantes) LOOP
        INSERT INTO pedido_item_variantes (
          id_item, id_grupo, id_opcion, id_producto_opcion,
          nombre_grupo, nombre_opcion, precio_delta
        ) VALUES (
          v_id_item,
          NULLIF(v_var->>'id_grupo','')::uuid,
          NULLIF(v_var->>'id_opcion','')::uuid,
          NULLIF(v_var->>'id_producto_opcion','')::uuid,
          COALESCE(v_var->>'nombre_grupo',''),
          COALESCE(v_var->>'nombre_opcion',''),
          COALESCE((v_var->>'precio_delta')::numeric, 0)
        );
      END LOOP;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  DELETE FROM prepedido_sesiones WHERE id_mesa = p_id_mesa;

  PERFORM recalcular_total_pedido(v_id_pedido);
  RETURN v_count;
END;
$function$;

-- 3. Nueva versión de agregar_item_pedido con p_variantes
DROP FUNCTION IF EXISTS public.agregar_item_pedido(uuid, uuid, numeric, boolean, text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.agregar_item_pedido(
  p_id_pedido uuid,
  p_id_producto uuid,
  p_cantidad numeric,
  p_tiene_alergia boolean,
  p_nota text,
  p_extras jsonb,
  p_exclusiones jsonb,
  p_variantes jsonb DEFAULT '[]'::jsonb
)
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
  v_v jsonb;
  v_id_insumo uuid;
  v_id_opcion uuid;
  v_cant numeric;
  v_pe numeric;
  v_g_nombre text;
  v_o_nombre text;
  v_p_opcion uuid;
  v_id_grupo uuid;
  v_delta numeric;
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

    IF p_variantes IS NOT NULL THEN
      FOR v_v IN SELECT * FROM jsonb_array_elements(p_variantes) LOOP
        v_id_opcion := (v_v->>'id_opcion')::uuid;
        SELECT o.id_grupo, g.nombre, p2.nombre_producto, o.id_producto_opcion, o.precio_delta
          INTO v_id_grupo, v_g_nombre, v_o_nombre, v_p_opcion, v_delta
        FROM producto_variante_opciones o
        JOIN producto_variante_grupos g ON g.id_grupo = o.id_grupo
        JOIN productos p2 ON p2.id_producto = o.id_producto_opcion
        WHERE o.id_opcion = v_id_opcion AND g.id_producto = p_id_producto;
        IF v_id_grupo IS NULL THEN RAISE EXCEPTION 'Variante no permitida' USING ERRCODE='42501'; END IF;
        INSERT INTO pedido_item_variantes (
          id_item, id_grupo, id_opcion, id_producto_opcion,
          nombre_grupo, nombre_opcion, precio_delta
        ) VALUES (
          v_id_item, v_id_grupo, v_id_opcion, v_p_opcion,
          v_g_nombre, v_o_nombre, v_delta
        );
      END LOOP;
    END IF;
  END LOOP;

  PERFORM recalcular_total_pedido(p_id_pedido);
  RETURN v_first_id;
END;
$function$;
