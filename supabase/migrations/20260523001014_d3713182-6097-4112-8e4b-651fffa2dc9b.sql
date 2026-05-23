
-- ============= Paso 6.2: Asignación de mesero, ruteo cocina/barra, persistencia de pedidos =============

-- 1. Asignación de mesero en mesas
ALTER TABLE public.mesas
  ADD COLUMN IF NOT EXISTS id_mesero_asignado uuid NULL,
  ADD COLUMN IF NOT EXISTS asignada_at timestamptz NULL;

-- 2. Destino de ruteo en categorias
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='categorias' AND column_name='destino') THEN
    ALTER TABLE public.categorias
      ADD COLUMN destino text NOT NULL DEFAULT 'COCINA' CHECK (destino IN ('COCINA','BARRA'));
  END IF;
END $$;

-- 3. Estado de pedido enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='estado_pedido') THEN
    CREATE TYPE public.estado_pedido AS ENUM ('ABIERTO','CONFIRMADO','CERRADO','CANCELADO');
  END IF;
END $$;

-- 4. Tablas de pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id_pedido uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL,
  id_mesa uuid NOT NULL,
  id_mesero uuid NULL,
  estado public.estado_pedido NOT NULL DEFAULT 'ABIERTO',
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_mesa_abierto_uniq
  ON public.pedidos (id_mesa) WHERE estado = 'ABIERTO';

CREATE TABLE IF NOT EXISTS public.pedido_items (
  id_item uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido uuid NOT NULL REFERENCES public.pedidos(id_pedido) ON DELETE CASCADE,
  id_producto uuid NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL DEFAULT 0,
  tiene_alergia boolean NOT NULL DEFAULT false,
  nota text NULL,
  destino text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pedido_items_pedido_idx ON public.pedido_items(id_pedido);

CREATE TABLE IF NOT EXISTS public.pedido_item_extras (
  id_pie uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_item uuid NOT NULL REFERENCES public.pedido_items(id_item) ON DELETE CASCADE,
  id_insumo_extra uuid NOT NULL,
  cantidad_porcion numeric NOT NULL,
  precio_extra numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pie_item_idx ON public.pedido_item_extras(id_item);

CREATE TABLE IF NOT EXISTS public.pedido_item_exclusiones (
  id_pix uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_item uuid NOT NULL REFERENCES public.pedido_items(id_item) ON DELETE CASCADE,
  id_insumo uuid NOT NULL
);
CREATE INDEX IF NOT EXISTS pix_item_idx ON public.pedido_item_exclusiones(id_item);

-- 5. RLS
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_item_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_item_exclusiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_all_own ON public.pedidos;
CREATE POLICY pedidos_all_own ON public.pedidos FOR ALL TO authenticated
  USING (id_negocio = current_user_negocio())
  WITH CHECK (id_negocio = current_user_negocio());

DROP POLICY IF EXISTS pedido_items_all_own ON public.pedido_items;
CREATE POLICY pedido_items_all_own ON public.pedido_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id_pedido = pedido_items.id_pedido AND p.id_negocio = current_user_negocio()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id_pedido = pedido_items.id_pedido AND p.id_negocio = current_user_negocio()));

DROP POLICY IF EXISTS pie_all_own ON public.pedido_item_extras;
CREATE POLICY pie_all_own ON public.pedido_item_extras FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido_items i JOIN public.pedidos p ON p.id_pedido=i.id_pedido WHERE i.id_item = pedido_item_extras.id_item AND p.id_negocio = current_user_negocio()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedido_items i JOIN public.pedidos p ON p.id_pedido=i.id_pedido WHERE i.id_item = pedido_item_extras.id_item AND p.id_negocio = current_user_negocio()));

DROP POLICY IF EXISTS pix_all_own ON public.pedido_item_exclusiones;
CREATE POLICY pix_all_own ON public.pedido_item_exclusiones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedido_items i JOIN public.pedidos p ON p.id_pedido=i.id_pedido WHERE i.id_item = pedido_item_exclusiones.id_item AND p.id_negocio = current_user_negocio()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pedido_items i JOIN public.pedidos p ON p.id_pedido=i.id_pedido WHERE i.id_item = pedido_item_exclusiones.id_item AND p.id_negocio = current_user_negocio()));

-- 6. updated_at triggers
DROP TRIGGER IF EXISTS pedidos_touch_updated_at ON public.pedidos;
CREATE TRIGGER pedidos_touch_updated_at BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Función round-robin para asignar mesero
CREATE OR REPLACE FUNCTION public.asignar_mesero_a_mesa(p_id_mesa uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_mesero uuid;
BEGIN
  SELECT id_negocio INTO v_negocio FROM mesas WHERE id_mesa = p_id_mesa;
  IF v_negocio IS NULL THEN RETURN NULL; END IF;

  SELECT s.id_usuario INTO v_mesero
  FROM usuarios_staff s
  LEFT JOIN (
    SELECT id_mesero_asignado, COUNT(*) AS carga
    FROM mesas
    WHERE id_negocio = v_negocio AND estado = 'OCUPADA' AND id_mesero_asignado IS NOT NULL
    GROUP BY id_mesero_asignado
  ) c ON c.id_mesero_asignado = s.id_usuario
  WHERE s.id_negocio = v_negocio
    AND s.rol = 'MESERO'
    AND s.estado = 'ACTIVO'
    AND s.esta_en_turno = true
  ORDER BY COALESCE(c.carga, 0) ASC, s.created_at ASC
  LIMIT 1;

  IF v_mesero IS NULL THEN RETURN NULL; END IF;

  UPDATE mesas
  SET id_mesero_asignado = v_mesero,
      asignada_at = now()
  WHERE id_mesa = p_id_mesa;

  RETURN v_mesero;
END;
$$;

-- 8. Crear/recuperar pedido abierto para mesa
CREATE OR REPLACE FUNCTION public.crear_pedido_para_mesa(p_id_mesa uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_mesero uuid;
  v_id_pedido uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  SELECT id_mesero_asignado INTO v_mesero FROM mesas
  WHERE id_mesa = p_id_mesa AND id_negocio = v_negocio;

  SELECT id_pedido INTO v_id_pedido FROM pedidos
  WHERE id_mesa = p_id_mesa AND estado='ABIERTO' AND id_negocio = v_negocio;

  IF v_id_pedido IS NOT NULL THEN RETURN v_id_pedido; END IF;

  INSERT INTO pedidos (id_negocio, id_mesa, id_mesero)
  VALUES (v_negocio, p_id_mesa, v_mesero)
  RETURNING id_pedido INTO v_id_pedido;

  RETURN v_id_pedido;
END;
$$;

-- 9. Recalcular total
CREATE OR REPLACE FUNCTION public.recalcular_total_pedido(p_id_pedido uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pedidos SET total = COALESCE((
    SELECT SUM(i.cantidad * (i.precio_unitario + COALESCE((
      SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item = i.id_item
    ), 0)))
    FROM pedido_items i WHERE i.id_pedido = p_id_pedido
  ), 0)
  WHERE id_pedido = p_id_pedido;
END;
$$;

-- 10. Agregar item
CREATE OR REPLACE FUNCTION public.agregar_item_pedido(
  p_id_pedido uuid,
  p_id_producto uuid,
  p_cantidad numeric,
  p_tiene_alergia boolean,
  p_nota text,
  p_extras jsonb,
  p_exclusiones jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pedidos WHERE id_pedido=p_id_pedido AND id_negocio=v_negocio AND estado='ABIERTO') THEN
    RAISE EXCEPTION 'Pedido inválido o cerrado' USING ERRCODE='42501';
  END IF;
  SELECT precio_venta, id_receta INTO v_precio, v_id_receta
  FROM productos WHERE id_producto=p_id_producto AND id_negocio=v_negocio AND activo=true;
  IF v_precio IS NULL THEN RAISE EXCEPTION 'Producto inválido' USING ERRCODE='42501'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='23514'; END IF;

  INSERT INTO pedido_items (id_pedido, id_producto, cantidad, precio_unitario, tiene_alergia, nota)
  VALUES (p_id_pedido, p_id_producto, p_cantidad, v_precio, COALESCE(p_tiene_alergia,false), NULLIF(trim(p_nota),''))
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
$$;

-- 11. Eliminar item
CREATE OR REPLACE FUNCTION public.eliminar_item_pedido(p_id_item uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_id_pedido uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT i.id_pedido INTO v_id_pedido
  FROM pedido_items i JOIN pedidos p ON p.id_pedido=i.id_pedido
  WHERE i.id_item=p_id_item AND p.id_negocio=v_negocio AND p.estado='ABIERTO';
  IF v_id_pedido IS NULL THEN RAISE EXCEPTION 'Item no encontrado' USING ERRCODE='P0002'; END IF;
  DELETE FROM pedido_items WHERE id_item=p_id_item;
  PERFORM recalcular_total_pedido(v_id_pedido);
END;
$$;

-- 12. Confirmar pedido (snapshot destino)
CREATE OR REPLACE FUNCTION public.confirmar_pedido(p_id_pedido uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
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

  UPDATE pedidos SET estado='CONFIRMADO' WHERE id_pedido = p_id_pedido;
END;
$$;

-- 13. Revocar anon, conceder authenticated
REVOKE EXECUTE ON FUNCTION public.asignar_mesero_a_mesa(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crear_pedido_para_mesa(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_pedido(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.agregar_item_pedido(uuid,uuid,numeric,boolean,text,jsonb,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.eliminar_item_pedido(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirmar_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_pedido_para_mesa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agregar_item_pedido(uuid,uuid,numeric,boolean,text,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_item_pedido(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pedido(uuid) TO authenticated;
-- asignar_mesero_a_mesa solo se invoca desde el server (supabaseAdmin) en llamarMesero

-- 14. Realtime
ALTER TABLE public.mesas REPLICA IDENTITY FULL;
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.pedido_items REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
