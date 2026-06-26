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

  IF NOT EXISTS (SELECT 1 FROM public.mesas WHERE id_mesa = p_id_mesa) THEN
    RAISE EXCEPTION 'Mesa no encontrada' USING ERRCODE='P0002';
  END IF;

  UPDATE public.mesas
     SET solicitud_cliente = p_tipo,
         solicitud_at = now(),
         estado = CASE
           WHEN p_tipo = 'TOMAR_PEDIDO' AND estado = 'LIBRE' THEN 'OCUPADA'
           ELSE estado
         END,
         asignada_at = CASE
           WHEN p_tipo = 'TOMAR_PEDIDO' AND estado = 'LIBRE' THEN now()
           ELSE asignada_at
         END,
         liberada_at = CASE
           WHEN p_tipo = 'TOMAR_PEDIDO' AND estado = 'LIBRE' THEN NULL
           ELSE liberada_at
         END
   WHERE id_mesa = p_id_mesa;
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_accion_cliente(uuid, text) TO anon, authenticated, service_role;

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
  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mesas WHERE id_mesa = p_id_mesa AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;

  SELECT id_pedido, estado INTO v_id_pedido, v_estado_pedido
    FROM public.pedidos
   WHERE id_mesa = p_id_mesa
     AND id_negocio = v_negocio
     AND estado IN ('ABIERTO','CONFIRMADO')
   ORDER BY (estado = 'ABIERTO') DESC, created_at DESC
   LIMIT 1;

  IF v_id_pedido IS NULL THEN
    SELECT id_mesero_asignado INTO v_mesero
      FROM public.mesas
     WHERE id_mesa = p_id_mesa;

    INSERT INTO public.pedidos (id_negocio, id_mesa, id_mesero)
    VALUES (v_negocio, p_id_mesa, v_mesero)
    RETURNING id_pedido INTO v_id_pedido;

    v_estado_pedido := 'ABIERTO';
  END IF;

  FOR v_rec IN
    SELECT pi.*
      FROM public.prepedido_items pi
     WHERE pi.id_mesa = p_id_mesa
     ORDER BY pi.created_at ASC
  LOOP
    v_destino := NULL;
    v_tiempo := NULL;

    IF v_estado_pedido = 'CONFIRMADO' THEN
      SELECT c.destino, rm.tiempo_preparacion_min INTO v_destino, v_tiempo
        FROM public.productos pr
        JOIN public.receta_master rm ON rm.id_receta = pr.id_receta
        JOIN public.categorias c ON c.id_categoria = rm.id_categoria
       WHERE pr.id_producto = v_rec.id_producto;
    END IF;

    INSERT INTO public.pedido_items (
      id_pedido, id_producto, cantidad, precio_unitario, tiene_alergia, nota,
      destino, tiempo_planeado_min
    ) VALUES (
      v_id_pedido, v_rec.id_producto, v_rec.cantidad, v_rec.precio_unitario,
      COALESCE(v_rec.tiene_alergia, false), NULLIF(trim(coalesce(v_rec.nota, '')), ''),
      v_destino, v_tiempo
    ) RETURNING id_item INTO v_id_item;

    IF v_rec.extras IS NOT NULL THEN
      FOR v_extra IN SELECT * FROM jsonb_array_elements(v_rec.extras) LOOP
        v_id_insumo := (v_extra->>'id_insumo_extra')::uuid;

        SELECT cantidad_porcion, precio_extra INTO v_cant, v_pe
          FROM public.extras_permitidos
         WHERE id_producto = v_rec.id_producto
           AND id_insumo_extra = v_id_insumo;

        IF v_cant IS NULL THEN
          CONTINUE;
        END IF;

        INSERT INTO public.pedido_item_extras (id_item, id_insumo_extra, cantidad_porcion, precio_extra)
        VALUES (v_id_item, v_id_insumo, v_cant, v_pe);
      END LOOP;
    END IF;

    IF v_rec.exclusiones IS NOT NULL THEN
      FOR v_excl IN SELECT * FROM jsonb_array_elements(v_rec.exclusiones) LOOP
        v_id_insumo := (v_excl->>'id_insumo')::uuid;

        INSERT INTO public.pedido_item_exclusiones (id_item, id_insumo)
        VALUES (v_id_item, v_id_insumo)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    IF v_rec.variantes IS NOT NULL THEN
      FOR v_var IN SELECT * FROM jsonb_array_elements(v_rec.variantes) LOOP
        INSERT INTO public.pedido_item_variantes (
          id_item, id_grupo, id_opcion, id_insumo_opcion,
          nombre_grupo, nombre_opcion, precio_delta, cantidad_porcion
        ) VALUES (
          v_id_item,
          NULLIF(v_var->>'id_grupo', '')::uuid,
          NULLIF(v_var->>'id_opcion', '')::uuid,
          NULLIF(v_var->>'id_insumo_opcion', '')::uuid,
          COALESCE(v_var->>'nombre_grupo', ''),
          COALESCE(v_var->>'nombre_opcion', ''),
          COALESCE((v_var->>'precio_delta')::numeric, 0),
          COALESCE((v_var->>'cantidad_porcion')::numeric, 0)
        );
      END LOOP;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.prepedido_sesiones WHERE id_mesa = p_id_mesa;

  PERFORM public.recalcular_total_pedido(v_id_pedido);

  UPDATE public.mesas
     SET estado = 'OCUPADA',
         asignada_at = COALESCE(asignada_at, now()),
         liberada_at = NULL,
         solicitud_cliente = NULL,
         solicitud_at = NULL
   WHERE id_mesa = p_id_mesa
     AND id_negocio = v_negocio
     AND estado = 'LIBRE';

  UPDATE public.mesas
     SET solicitud_cliente = NULL,
         solicitud_at = NULL
   WHERE id_mesa = p_id_mesa
     AND id_negocio = v_negocio
     AND solicitud_cliente = 'TOMAR_PEDIDO';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceptar_prepedido_mesa(uuid) TO authenticated, service_role;