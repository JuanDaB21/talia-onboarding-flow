
-- ============================================================
-- Pre-pedido colaborativo por mesa
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prepedido_sesiones (
  id_sesion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mesa uuid NOT NULL REFERENCES public.mesas(id_mesa) ON DELETE CASCADE,
  id_cliente uuid NOT NULL,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_mesa, id_cliente)
);

GRANT SELECT ON public.prepedido_sesiones TO anon, authenticated;
GRANT ALL ON public.prepedido_sesiones TO service_role;
ALTER TABLE public.prepedido_sesiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lectura publica prepedido_sesiones"
  ON public.prepedido_sesiones FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_prepedido_sesiones_mesa
  ON public.prepedido_sesiones(id_mesa);

CREATE TABLE IF NOT EXISTS public.prepedido_items (
  id_prepedido_item uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_mesa uuid NOT NULL REFERENCES public.mesas(id_mesa) ON DELETE CASCADE,
  id_sesion uuid NOT NULL REFERENCES public.prepedido_sesiones(id_sesion) ON DELETE CASCADE,
  id_producto uuid NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0),
  tiene_alergia boolean NOT NULL DEFAULT false,
  nota text,
  extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusiones jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prepedido_items TO anon, authenticated;
GRANT ALL ON public.prepedido_items TO service_role;
ALTER TABLE public.prepedido_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lectura publica prepedido_items"
  ON public.prepedido_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_prepedido_items_mesa
  ON public.prepedido_items(id_mesa);
CREATE INDEX IF NOT EXISTS idx_prepedido_items_sesion
  ON public.prepedido_items(id_sesion);

CREATE TRIGGER trg_prepedido_items_updated
  BEFORE UPDATE ON public.prepedido_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.prepedido_sesiones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prepedido_items;

-- ============================================================
-- Aceptar pre-pedido: mueve items al pedido ABIERTO de la mesa
-- ============================================================
CREATE OR REPLACE FUNCTION public.aceptar_prepedido_mesa(p_id_mesa uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Obtener / crear pedido ABIERTO
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

  DELETE FROM prepedido_items WHERE id_mesa = p_id_mesa;

  PERFORM recalcular_total_pedido(v_id_pedido);
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceptar_prepedido_mesa(uuid) TO authenticated;
