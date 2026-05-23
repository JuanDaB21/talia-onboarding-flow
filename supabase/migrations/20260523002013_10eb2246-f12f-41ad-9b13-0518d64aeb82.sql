
-- 1) Add tiempo_preparacion_min to receta_master
ALTER TABLE public.receta_master
  ADD COLUMN IF NOT EXISTS tiempo_preparacion_min integer NOT NULL DEFAULT 15
  CHECK (tiempo_preparacion_min > 0);

-- 2) Add prep state + timing columns to pedido_items
ALTER TABLE public.pedido_items
  ADD COLUMN IF NOT EXISTS estado_preparacion text NOT NULL DEFAULT 'EN_COLA'
    CHECK (estado_preparacion IN ('EN_COLA','EN_PREPARACION','LISTO','ENTREGADO')),
  ADD COLUMN IF NOT EXISTS tiempo_planeado_min integer,
  ADD COLUMN IF NOT EXISTS iniciado_at timestamptz,
  ADD COLUMN IF NOT EXISTS listo_at timestamptz,
  ADD COLUMN IF NOT EXISTS entregado_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pedido_items_estado_destino
  ON public.pedido_items (estado_preparacion, destino);

-- 3) Update crear_receta to accept tiempo_preparacion_min
CREATE OR REPLACE FUNCTION public.crear_receta(
  p_id_categoria uuid,
  p_id_subcategoria uuid,
  p_nombre text,
  p_descripcion text,
  p_ingredientes jsonb,
  p_tiempo_preparacion_min integer DEFAULT 15
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_id_receta uuid;
  v_item jsonb;
  v_id_insumo uuid;
  v_cantidad numeric;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF coalesce(trim(p_nombre),'') = '' THEN RAISE EXCEPTION 'Nombre requerido' USING ERRCODE='23514'; END IF;
  IF p_ingredientes IS NULL OR jsonb_array_length(p_ingredientes) = 0 THEN
    RAISE EXCEPTION 'Debe agregar al menos un ingrediente' USING ERRCODE='23514';
  END IF;
  IF p_tiempo_preparacion_min IS NULL OR p_tiempo_preparacion_min <= 0 THEN
    RAISE EXCEPTION 'Tiempo de preparación inválido' USING ERRCODE='23514';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categorias WHERE id_categoria = p_id_categoria AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Categoría inválida' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subcategorias WHERE id_subcategoria = p_id_subcategoria AND id_categoria = p_id_categoria AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Subcategoría inválida' USING ERRCODE='42501';
  END IF;

  INSERT INTO receta_master (id_negocio, id_categoria, id_subcategoria, nombre_receta, descripcion, tiempo_preparacion_min)
  VALUES (v_negocio, p_id_categoria, p_id_subcategoria, trim(p_nombre), NULLIF(trim(p_descripcion),''), p_tiempo_preparacion_min)
  RETURNING id_receta INTO v_id_receta;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_ingredientes) LOOP
    v_id_insumo := (v_item->>'id_insumo')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM insumos WHERE id_insumo = v_id_insumo AND id_negocio = v_negocio) THEN
      RAISE EXCEPTION 'Insumo inválido' USING ERRCODE='42501';
    END IF;
    INSERT INTO receta_detalle (id_receta, id_insumo, cantidad) VALUES (v_id_receta, v_id_insumo, v_cantidad);
  END LOOP;

  INSERT INTO productos (id_negocio, id_receta, nombre_producto, activo)
  VALUES (v_negocio, v_id_receta, trim(p_nombre), true);

  RETURN v_id_receta;
END;
$function$;

-- 4) Update actualizar_receta to accept tiempo_preparacion_min
CREATE OR REPLACE FUNCTION public.actualizar_receta(
  p_id_receta uuid,
  p_id_categoria uuid,
  p_id_subcategoria uuid,
  p_nombre text,
  p_descripcion text,
  p_ingredientes jsonb,
  p_tiempo_preparacion_min integer DEFAULT 15
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_item jsonb;
  v_id_insumo uuid;
  v_cantidad numeric;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM receta_master WHERE id_receta = p_id_receta AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Receta no encontrada' USING ERRCODE='P0002';
  END IF;
  IF p_ingredientes IS NULL OR jsonb_array_length(p_ingredientes) = 0 THEN RAISE EXCEPTION 'Debe agregar al menos un ingrediente' USING ERRCODE='23514'; END IF;
  IF p_tiempo_preparacion_min IS NULL OR p_tiempo_preparacion_min <= 0 THEN
    RAISE EXCEPTION 'Tiempo de preparación inválido' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM categorias WHERE id_categoria = p_id_categoria AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Categoría inválida' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subcategorias WHERE id_subcategoria = p_id_subcategoria AND id_categoria = p_id_categoria AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Subcategoría inválida' USING ERRCODE='42501';
  END IF;

  UPDATE receta_master
  SET id_categoria = p_id_categoria,
      id_subcategoria = p_id_subcategoria,
      nombre_receta = trim(p_nombre),
      descripcion = NULLIF(trim(p_descripcion),''),
      tiempo_preparacion_min = p_tiempo_preparacion_min
  WHERE id_receta = p_id_receta AND id_negocio = v_negocio;

  UPDATE productos SET nombre_producto = trim(p_nombre) WHERE id_receta = p_id_receta;

  DELETE FROM receta_detalle WHERE id_receta = p_id_receta;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_ingredientes) LOOP
    v_id_insumo := (v_item->>'id_insumo')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM insumos WHERE id_insumo = v_id_insumo AND id_negocio = v_negocio) THEN
      RAISE EXCEPTION 'Insumo inválido' USING ERRCODE='42501';
    END IF;
    INSERT INTO receta_detalle (id_receta, id_insumo, cantidad) VALUES (p_id_receta, v_id_insumo, v_cantidad);
  END LOOP;

  RETURN p_id_receta;
END;
$function$;

-- 5) Update confirmar_pedido to snapshot destino + tiempo_planeado_min (bebidas = mitad del max comida)
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

  -- Snapshot destino por item
  UPDATE pedido_items i
  SET destino = c.destino
  FROM productos pr
  JOIN receta_master rm ON rm.id_receta = pr.id_receta
  JOIN categorias c ON c.id_categoria = rm.id_categoria
  WHERE i.id_producto = pr.id_producto AND i.id_pedido = p_id_pedido;

  -- Calcular max tiempo de comida en este pedido
  SELECT MAX(rm.tiempo_preparacion_min) INTO v_max_comida
  FROM pedido_items i
  JOIN productos pr ON pr.id_producto = i.id_producto
  JOIN receta_master rm ON rm.id_receta = pr.id_receta
  WHERE i.id_pedido = p_id_pedido AND i.destino = 'COCINA';

  -- Snapshot tiempo planeado por item
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

  UPDATE pedidos SET estado='CONFIRMADO' WHERE id_pedido = p_id_pedido;
END;
$function$;

-- 6) avanzar_estado_item: transición secuencial con validación de rol
CREATE OR REPLACE FUNCTION public.avanzar_estado_item(p_id_item uuid, p_nuevo_estado text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_rol rol_staff;
  v_estado_actual text;
  v_destino text;
  v_id_pedido uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  SELECT rol INTO v_rol FROM usuarios_staff WHERE id_usuario = auth.uid();
  IF v_rol IS NULL THEN RAISE EXCEPTION 'Sin rol' USING ERRCODE='42501'; END IF;

  SELECT i.estado_preparacion, i.destino, i.id_pedido
    INTO v_estado_actual, v_destino, v_id_pedido
  FROM pedido_items i
  JOIN pedidos p ON p.id_pedido = i.id_pedido
  WHERE i.id_item = p_id_item AND p.id_negocio = v_negocio;
  IF v_estado_actual IS NULL THEN RAISE EXCEPTION 'Item no encontrado' USING ERRCODE='P0002'; END IF;

  IF p_nuevo_estado NOT IN ('EN_PREPARACION','LISTO','ENTREGADO') THEN
    RAISE EXCEPTION 'Estado inválido' USING ERRCODE='23514';
  END IF;

  -- Transición secuencial
  IF (v_estado_actual = 'EN_COLA' AND p_nuevo_estado <> 'EN_PREPARACION')
     OR (v_estado_actual = 'EN_PREPARACION' AND p_nuevo_estado <> 'LISTO')
     OR (v_estado_actual = 'LISTO' AND p_nuevo_estado <> 'ENTREGADO')
     OR (v_estado_actual = 'ENTREGADO') THEN
    RAISE EXCEPTION 'Transición no permitida (% -> %)', v_estado_actual, p_nuevo_estado USING ERRCODE='42501';
  END IF;

  -- Validación de rol
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

  UPDATE pedido_items
  SET estado_preparacion = p_nuevo_estado,
      iniciado_at  = CASE WHEN p_nuevo_estado='EN_PREPARACION' THEN now() ELSE iniciado_at END,
      listo_at     = CASE WHEN p_nuevo_estado='LISTO'          THEN now() ELSE listo_at END,
      entregado_at = CASE WHEN p_nuevo_estado='ENTREGADO'      THEN now() ELSE entregado_at END
  WHERE id_item = p_id_item;

  RETURN p_nuevo_estado;
END;
$function$;
