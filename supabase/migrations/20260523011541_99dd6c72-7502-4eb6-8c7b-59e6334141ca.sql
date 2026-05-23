
-- 1) Añadir PAGADO al enum estado_pedido
ALTER TYPE estado_pedido ADD VALUE IF NOT EXISTS 'PAGADO';

-- 2) Timestamps en pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS confirmado_at timestamptz,
  ADD COLUMN IF NOT EXISTS entregado_at timestamptz,
  ADD COLUMN IF NOT EXISTS pagado_at timestamptz,
  ADD COLUMN IF NOT EXISTS seguimiento_visto_at timestamptz;

-- 3) Mesa: solicitud cliente + liberada
ALTER TABLE public.mesas
  ADD COLUMN IF NOT EXISTS liberada_at timestamptz,
  ADD COLUMN IF NOT EXISTS solicitud_cliente text,
  ADD COLUMN IF NOT EXISTS solicitud_at timestamptz;

-- 4) Actualizar confirmar_pedido para registrar confirmado_at
CREATE OR REPLACE FUNCTION public.confirmar_pedido(p_id_pedido uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_max_comida integer;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE id_pedido=p_id_pedido AND id_negocio=v_negocio AND estado='ABIERTO') THEN
    RAISE EXCEPTION 'Pedido inválido' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pedido_items WHERE id_pedido=p_id_pedido) THEN
    RAISE EXCEPTION 'El pedido no tiene items' USING ERRCODE='23514';
  END IF;

  UPDATE pedido_items i
  SET destino = c.destino
  FROM productos pr
  JOIN receta_master rm ON rm.id_receta = pr.id_receta
  JOIN categorias c ON c.id_categoria = rm.id_categoria
  WHERE i.id_producto = pr.id_producto AND i.id_pedido = p_id_pedido;

  SELECT MAX(rm.tiempo_preparacion_min) INTO v_max_comida
  FROM pedido_items i
  JOIN productos pr ON pr.id_producto = i.id_producto
  JOIN receta_master rm ON rm.id_receta = pr.id_receta
  WHERE i.id_pedido = p_id_pedido AND i.destino = 'COCINA';

  UPDATE pedido_items i
  SET tiempo_planeado_min = CASE
    WHEN i.destino = 'COCINA' THEN rm.tiempo_preparacion_min
    WHEN i.destino = 'BARRA' AND v_max_comida IS NOT NULL
      THEN GREATEST(1, CEIL(v_max_comida::numeric / 2)::integer)
    ELSE rm.tiempo_preparacion_min
  END
  FROM productos pr
  JOIN receta_master rm ON rm.id_receta = pr.id_receta
  WHERE i.id_producto = pr.id_producto AND i.id_pedido = p_id_pedido;

  UPDATE pedidos SET estado='CONFIRMADO', confirmado_at = now() WHERE id_pedido = p_id_pedido;
END;
$function$;

-- 5) Permitir eliminar items EN_COLA aunque el pedido esté CONFIRMADO
CREATE OR REPLACE FUNCTION public.eliminar_item_pedido(p_id_item uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_id_pedido uuid;
  v_estado_item text;
  v_estado_pedido estado_pedido;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.id_pedido, i.estado_preparacion, p.estado
    INTO v_id_pedido, v_estado_item, v_estado_pedido
  FROM pedido_items i JOIN pedidos p ON p.id_pedido=i.id_pedido
  WHERE i.id_item=p_id_item AND p.id_negocio=v_negocio;
  IF v_id_pedido IS NULL THEN RAISE EXCEPTION 'Item no encontrado' USING ERRCODE='P0002'; END IF;
  IF v_estado_pedido NOT IN ('ABIERTO','CONFIRMADO') THEN
    RAISE EXCEPTION 'Pedido cerrado' USING ERRCODE='42501';
  END IF;
  IF v_estado_item <> 'EN_COLA' THEN
    RAISE EXCEPTION 'No se puede eliminar un item que ya está en preparación' USING ERRCODE='42501';
  END IF;
  DELETE FROM pedido_items WHERE id_item=p_id_item;
  PERFORM recalcular_total_pedido(v_id_pedido);
END;
$function$;

-- 6) Editar un item (solo EN_COLA)
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
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='23514'; END IF;

  SELECT i.id_pedido, i.estado_preparacion
    INTO v_id_pedido, v_estado_item
  FROM pedido_items i JOIN pedidos p ON p.id_pedido=i.id_pedido
  WHERE i.id_item=p_id_item AND p.id_negocio=v_negocio;
  IF v_id_pedido IS NULL THEN RAISE EXCEPTION 'Item no encontrado' USING ERRCODE='P0002'; END IF;
  IF v_estado_item <> 'EN_COLA' THEN
    RAISE EXCEPTION 'No se puede editar un item que ya está en preparación' USING ERRCODE='42501';
  END IF;

  UPDATE pedido_items
  SET cantidad = p_cantidad,
      tiene_alergia = COALESCE(p_tiene_alergia, false),
      nota = NULLIF(trim(p_nota), '')
  WHERE id_item = p_id_item;

  PERFORM recalcular_total_pedido(v_id_pedido);
END;
$function$;

-- 7) Permitir agregar items en pedido ABIERTO o CONFIRMADO
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
  v_e jsonb;
  v_x jsonb;
  v_id_insumo uuid;
  v_cant numeric;
  v_pe numeric;
  v_estado_pedido estado_pedido;
  v_destino text;
  v_tiempo integer;
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

  -- Si el pedido ya está CONFIRMADO snapshot inmediato de destino y tiempo
  IF v_estado_pedido = 'CONFIRMADO' THEN
    SELECT c.destino, rm.tiempo_preparacion_min INTO v_destino, v_tiempo
    FROM productos pr
    JOIN receta_master rm ON rm.id_receta = pr.id_receta
    JOIN categorias c ON c.id_categoria = rm.id_categoria
    WHERE pr.id_producto = p_id_producto;
  END IF;

  INSERT INTO pedido_items (id_pedido, id_producto, cantidad, precio_unitario, tiene_alergia, nota, destino, tiempo_planeado_min)
  VALUES (p_id_pedido, p_id_producto, p_cantidad, v_precio, COALESCE(p_tiene_alergia,false), NULLIF(trim(p_nota),''), v_destino, v_tiempo)
  RETURNING id_item INTO v_id_item;

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

  PERFORM recalcular_total_pedido(p_id_pedido);
  RETURN v_id_item;
END;
$function$;

-- 8) Marcar pedido como entregado: mueve todos los items LISTO a ENTREGADO y setea entregado_at si todos los items lo están
CREATE OR REPLACE FUNCTION public.marcar_pedido_entregado(p_id_pedido uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_count integer;
  v_pendientes integer;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE id_pedido=p_id_pedido AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Pedido inválido' USING ERRCODE='42501';
  END IF;

  UPDATE pedido_items
  SET estado_preparacion='ENTREGADO', entregado_at=now()
  WHERE id_pedido=p_id_pedido AND estado_preparacion='LISTO';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT count(*) INTO v_pendientes FROM pedido_items
   WHERE id_pedido=p_id_pedido AND estado_preparacion <> 'ENTREGADO';
  IF v_pendientes = 0 THEN
    UPDATE pedidos SET entregado_at = COALESCE(entregado_at, now()) WHERE id_pedido=p_id_pedido;
  END IF;

  RETURN v_count;
END;
$function$;

-- 9) Cerrar cuenta de la mesa
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

  RETURN v_total;
END;
$function$;

-- 10) Solicitud del cliente (PEDIR_MAS | CUENTA) desde el QR. Sin auth (público).
CREATE OR REPLACE FUNCTION public.solicitar_accion_cliente(p_id_mesa uuid, p_tipo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_tipo NOT IN ('PEDIR_MAS','CUENTA') THEN
    RAISE EXCEPTION 'Tipo inválido' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa) THEN
    RAISE EXCEPTION 'Mesa no encontrada' USING ERRCODE='P0002';
  END IF;
  UPDATE mesas SET solicitud_cliente=p_tipo, solicitud_at=now() WHERE id_mesa=p_id_mesa;
END;
$function$;

-- Exponer a anon (cliente público escanea QR)
GRANT EXECUTE ON FUNCTION public.solicitar_accion_cliente(uuid, text) TO anon, authenticated;

-- 11) Marcar seguimiento como visto
CREATE OR REPLACE FUNCTION public.marcar_seguimiento_visto(p_id_pedido uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  UPDATE pedidos SET seguimiento_visto_at = now()
   WHERE id_pedido=p_id_pedido AND id_negocio=v_negocio;
END;
$function$;

-- 12) Limpiar solicitud cliente cuando el mesero atiende
CREATE OR REPLACE FUNCTION public.limpiar_solicitud_cliente(p_id_mesa uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  UPDATE mesas SET solicitud_cliente=NULL, solicitud_at=NULL
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio;
END;
$function$;

-- 13) Realtime publication
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
