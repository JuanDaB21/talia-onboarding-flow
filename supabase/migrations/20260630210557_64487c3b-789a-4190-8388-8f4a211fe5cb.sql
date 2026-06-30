
-- =========================================================
-- 1. Nueva tabla: bodegas
-- =========================================================
CREATE TABLE public.bodegas (
  id_bodega uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  nombre text NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_negocio, nombre)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bodegas TO authenticated;
GRANT ALL ON public.bodegas TO service_role;
ALTER TABLE public.bodegas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bodegas_select_own" ON public.bodegas
  FOR SELECT TO authenticated USING (id_negocio = public.current_user_negocio());
CREATE POLICY "bodegas_admin_write" ON public.bodegas
  FOR ALL TO authenticated
  USING (id_negocio = public.current_user_negocio() AND public.is_admin_actual())
  WITH CHECK (id_negocio = public.current_user_negocio() AND public.is_admin_actual());
CREATE TRIGGER bodegas_updated_at BEFORE UPDATE ON public.bodegas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 2. Nueva tabla: espacio_bodega_principal (1:1)
-- =========================================================
CREATE TABLE public.espacio_bodega_principal (
  id_espacio uuid PRIMARY KEY REFERENCES public.espacios_trabajo(id_espacio) ON DELETE CASCADE,
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  id_bodega uuid NOT NULL REFERENCES public.bodegas(id_bodega) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.espacio_bodega_principal TO authenticated;
GRANT ALL ON public.espacio_bodega_principal TO service_role;
ALTER TABLE public.espacio_bodega_principal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ebp_select_own" ON public.espacio_bodega_principal
  FOR SELECT TO authenticated USING (id_negocio = public.current_user_negocio());
CREATE POLICY "ebp_admin_write" ON public.espacio_bodega_principal
  FOR ALL TO authenticated
  USING (id_negocio = public.current_user_negocio() AND public.is_admin_actual())
  WITH CHECK (id_negocio = public.current_user_negocio() AND public.is_admin_actual());
CREATE TRIGGER ebp_updated_at BEFORE UPDATE ON public.espacio_bodega_principal
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 3. Renombrar inventario_actual -> inventario_bodega y añadir id_bodega
--    Se elimina del publication para poder modificar la columna.
-- =========================================================
ALTER PUBLICATION supabase_realtime DROP TABLE public.inventario_actual;
ALTER TABLE public.inventario_actual RENAME TO inventario_bodega;
ALTER TABLE public.inventario_bodega RENAME COLUMN id_inventario TO id_inv_bodega;
ALTER TABLE public.inventario_bodega ADD COLUMN id_bodega uuid REFERENCES public.bodegas(id_bodega) ON DELETE CASCADE;
ALTER TABLE public.inventario_bodega DROP CONSTRAINT inventario_actual_id_insumo_key;
-- Renombrar políticas viejas (mismo objeto, nuevos nombres)
DROP POLICY IF EXISTS "inv_select_own" ON public.inventario_bodega;
DROP POLICY IF EXISTS "inv_insert_own" ON public.inventario_bodega;
DROP POLICY IF EXISTS "inv_update_own" ON public.inventario_bodega;
DROP POLICY IF EXISTS "inv_delete_own" ON public.inventario_bodega;
CREATE POLICY "inv_bodega_select" ON public.inventario_bodega
  FOR SELECT TO authenticated USING (id_negocio = public.current_user_negocio());
CREATE POLICY "inv_bodega_insert" ON public.inventario_bodega
  FOR INSERT TO authenticated WITH CHECK (id_negocio = public.current_user_negocio());
CREATE POLICY "inv_bodega_update" ON public.inventario_bodega
  FOR UPDATE TO authenticated USING (id_negocio = public.current_user_negocio())
  WITH CHECK (id_negocio = public.current_user_negocio());
CREATE POLICY "inv_bodega_delete" ON public.inventario_bodega
  FOR DELETE TO authenticated USING (id_negocio = public.current_user_negocio());

-- =========================================================
-- 4. Migrar datos: crear bodega por cada espacio activo y asignar stock
-- =========================================================
DO $$
DECLARE
  r record;
  v_first_bodega uuid;
  v_esp record;
  v_new_bodega uuid;
  v_orden int;
BEGIN
  FOR r IN SELECT id_negocio FROM public.negocio LOOP
    v_first_bodega := NULL;
    v_orden := 0;
    FOR v_esp IN
      SELECT id_espacio, nombre
      FROM public.espacios_trabajo
      WHERE id_negocio = r.id_negocio AND activo = true
      ORDER BY orden, created_at
    LOOP
      INSERT INTO public.bodegas (id_negocio, nombre, orden)
      VALUES (r.id_negocio, 'Bodega ' || v_esp.nombre, v_orden)
      ON CONFLICT (id_negocio, nombre) DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING id_bodega INTO v_new_bodega;
      v_orden := v_orden + 1;
      INSERT INTO public.espacio_bodega_principal (id_espacio, id_negocio, id_bodega)
      VALUES (v_esp.id_espacio, r.id_negocio, v_new_bodega)
      ON CONFLICT (id_espacio) DO NOTHING;
      IF v_first_bodega IS NULL THEN v_first_bodega := v_new_bodega; END IF;
    END LOOP;
    IF v_first_bodega IS NULL THEN
      INSERT INTO public.bodegas (id_negocio, nombre, orden)
      VALUES (r.id_negocio, 'Bodega Principal', 0)
      RETURNING id_bodega INTO v_first_bodega;
    END IF;
    UPDATE public.inventario_bodega
       SET id_bodega = v_first_bodega
     WHERE id_negocio = r.id_negocio AND id_bodega IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.inventario_bodega ALTER COLUMN id_bodega SET NOT NULL;
ALTER TABLE public.inventario_bodega ADD CONSTRAINT inv_bodega_unique UNIQUE (id_bodega, id_insumo);
CREATE INDEX IF NOT EXISTS idx_inv_bodega_insumo ON public.inventario_bodega(id_insumo);
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventario_bodega;

-- =========================================================
-- 5. Vista agregada inventario_actual (compatibilidad)
-- =========================================================
CREATE OR REPLACE VIEW public.inventario_actual AS
SELECT
  ib.id_negocio,
  ib.id_insumo,
  SUM(ib.cantidad_actual)::numeric AS cantidad_actual,
  MAX(ib.updated_at) AS updated_at
FROM public.inventario_bodega ib
GROUP BY ib.id_negocio, ib.id_insumo;
GRANT SELECT ON public.inventario_actual TO authenticated;
ALTER VIEW public.inventario_actual SET (security_invoker = on);

-- =========================================================
-- 6. movimientos_inventario: bodega origen/destino
-- =========================================================
ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS id_bodega_origen uuid REFERENCES public.bodegas(id_bodega) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS id_bodega_destino uuid REFERENCES public.bodegas(id_bodega) ON DELETE SET NULL;

-- =========================================================
-- 7. detalle_compra: id_bodega_destino
-- =========================================================
ALTER TABLE public.detalle_compra
  ADD COLUMN IF NOT EXISTS id_bodega_destino uuid REFERENCES public.bodegas(id_bodega) ON DELETE SET NULL;

-- =========================================================
-- 8. Reemplazar trigger crear_inventario_para_insumo (ahora por bodega)
-- =========================================================
CREATE OR REPLACE FUNCTION public.crear_inventario_para_insumo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.inventario_bodega (id_negocio, id_bodega, id_insumo, cantidad_actual)
  SELECT NEW.id_negocio, b.id_bodega, NEW.id_insumo, 0
    FROM public.bodegas b
   WHERE b.id_negocio = NEW.id_negocio AND b.activa = true
  ON CONFLICT (id_bodega, id_insumo) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Nuevo trigger: al crear una bodega, inicializa stock 0 para todos los insumos
CREATE OR REPLACE FUNCTION public.crear_inventario_para_bodega()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.inventario_bodega (id_negocio, id_bodega, id_insumo, cantidad_actual)
  SELECT NEW.id_negocio, NEW.id_bodega, i.id_insumo, 0
    FROM public.insumos i
   WHERE i.id_negocio = NEW.id_negocio
  ON CONFLICT (id_bodega, id_insumo) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bodegas_inicializar_inventario ON public.bodegas;
CREATE TRIGGER bodegas_inicializar_inventario AFTER INSERT ON public.bodegas
  FOR EACH ROW EXECUTE FUNCTION public.crear_inventario_para_bodega();

-- =========================================================
-- 9. RPC: trasladar inventario entre bodegas
-- =========================================================
CREATE OR REPLACE FUNCTION public.trasladar_inventario(
  p_id_insumo uuid,
  p_id_bodega_origen uuid,
  p_id_bodega_destino uuid,
  p_cantidad numeric,
  p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_negocio uuid;
  v_origen numeric;
  v_destino numeric;
  v_uid uuid := auth.uid();
BEGIN
  v_negocio := public.current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='23514'; END IF;
  IF p_id_bodega_origen = p_id_bodega_destino THEN RAISE EXCEPTION 'Origen y destino deben ser distintos' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id_bodega=p_id_bodega_origen AND id_negocio=v_negocio AND activa)
     OR NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id_bodega=p_id_bodega_destino AND id_negocio=v_negocio AND activa) THEN
    RAISE EXCEPTION 'Bodega inválida o inactiva' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.insumos WHERE id_insumo=p_id_insumo AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Insumo inválido' USING ERRCODE='42501';
  END IF;

  SELECT cantidad_actual INTO v_origen FROM public.inventario_bodega
   WHERE id_bodega=p_id_bodega_origen AND id_insumo=p_id_insumo FOR UPDATE;
  IF v_origen IS NULL THEN v_origen := 0; END IF;
  IF v_origen < p_cantidad THEN RAISE EXCEPTION 'Stock insuficiente en bodega origen' USING ERRCODE='23514'; END IF;

  INSERT INTO public.inventario_bodega (id_negocio, id_bodega, id_insumo, cantidad_actual)
  VALUES (v_negocio, p_id_bodega_destino, p_id_insumo, 0)
  ON CONFLICT (id_bodega, id_insumo) DO NOTHING;
  SELECT cantidad_actual INTO v_destino FROM public.inventario_bodega
   WHERE id_bodega=p_id_bodega_destino AND id_insumo=p_id_insumo FOR UPDATE;

  UPDATE public.inventario_bodega SET cantidad_actual = v_origen - p_cantidad, updated_at=now()
    WHERE id_bodega=p_id_bodega_origen AND id_insumo=p_id_insumo;
  UPDATE public.inventario_bodega SET cantidad_actual = v_destino + p_cantidad, updated_at=now()
    WHERE id_bodega=p_id_bodega_destino AND id_insumo=p_id_insumo;

  INSERT INTO public.movimientos_inventario (
    id_negocio, id_insumo, tipo_movimiento, cantidad, cantidad_anterior, cantidad_nueva, motivo, id_usuario,
    id_bodega_origen, id_bodega_destino
  ) VALUES (
    v_negocio, p_id_insumo, 'TRASLADO_SALIDA', -p_cantidad, v_origen, v_origen - p_cantidad, p_motivo, v_uid,
    p_id_bodega_origen, p_id_bodega_destino
  );
  INSERT INTO public.movimientos_inventario (
    id_negocio, id_insumo, tipo_movimiento, cantidad, cantidad_anterior, cantidad_nueva, motivo, id_usuario,
    id_bodega_origen, id_bodega_destino
  ) VALUES (
    v_negocio, p_id_insumo, 'TRASLADO_ENTRADA', p_cantidad, v_destino, v_destino + p_cantidad, p_motivo, v_uid,
    p_id_bodega_origen, p_id_bodega_destino
  );
END;
$$;
REVOKE ALL ON FUNCTION public.trasladar_inventario(uuid, uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trasladar_inventario(uuid, uuid, uuid, numeric, text) TO authenticated;

-- =========================================================
-- 10. RPC: asignar bodega principal a un espacio (bidireccional)
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_bodega_principal_espacio(p_id_espacio uuid, p_id_bodega uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_negocio uuid;
BEGIN
  IF NOT public.is_admin_actual() THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
  v_negocio := public.current_user_negocio();
  IF NOT EXISTS (SELECT 1 FROM public.espacios_trabajo WHERE id_espacio=p_id_espacio AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Espacio inválido' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id_bodega=p_id_bodega AND id_negocio=v_negocio AND activa) THEN
    RAISE EXCEPTION 'Bodega inválida o inactiva' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.espacio_bodega_principal (id_espacio, id_negocio, id_bodega)
  VALUES (p_id_espacio, v_negocio, p_id_bodega)
  ON CONFLICT (id_espacio) DO UPDATE SET id_bodega = EXCLUDED.id_bodega, updated_at=now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_bodega_principal_espacio(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_bodega_principal_espacio(uuid, uuid) TO authenticated;

-- =========================================================
-- 11. RPC: eliminar bodega (solo si stock = 0 y no es principal de espacio)
-- =========================================================
CREATE OR REPLACE FUNCTION public.eliminar_bodega(p_id_bodega uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_negocio uuid; v_total numeric;
BEGIN
  IF NOT public.is_admin_actual() THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
  v_negocio := public.current_user_negocio();
  IF NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id_bodega=p_id_bodega AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Bodega inválida' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.espacio_bodega_principal WHERE id_bodega=p_id_bodega) THEN
    RAISE EXCEPTION 'No puedes eliminar una bodega asignada como principal de un espacio' USING ERRCODE='42501';
  END IF;
  SELECT COALESCE(SUM(cantidad_actual),0) INTO v_total FROM public.inventario_bodega WHERE id_bodega=p_id_bodega;
  IF v_total > 0 THEN
    RAISE EXCEPTION 'La bodega tiene stock. Trasládalo antes de eliminar.' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.inventario_bodega WHERE id_bodega=p_id_bodega;
  DELETE FROM public.bodegas WHERE id_bodega=p_id_bodega;
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_bodega(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eliminar_bodega(uuid) TO authenticated;

-- =========================================================
-- 12. Actualizar ajustar_stock_manual: ahora recibe bodega (compat: si NULL usa la principal del espacio del usuario)
-- =========================================================
DROP FUNCTION IF EXISTS public.ajustar_stock_manual(uuid, numeric, text);
CREATE OR REPLACE FUNCTION public.ajustar_stock_manual(
  p_id_insumo uuid,
  p_nueva_cantidad numeric,
  p_motivo text,
  p_id_bodega uuid DEFAULT NULL
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_negocio uuid;
  v_anterior numeric;
  v_diff numeric;
  v_bodega uuid := p_id_bodega;
BEGIN
  v_negocio := public.current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF p_nueva_cantidad < 0 THEN RAISE EXCEPTION 'La cantidad no puede ser negativa' USING ERRCODE='23514'; END IF;

  IF v_bodega IS NULL THEN
    -- Default: bodega principal del espacio del usuario actual
    SELECT ebp.id_bodega INTO v_bodega
      FROM public.usuarios_staff u
      JOIN public.espacio_bodega_principal ebp ON ebp.id_espacio = u.id_espacio_asignado
     WHERE u.id_usuario = auth.uid() AND u.id_negocio = v_negocio;
    IF v_bodega IS NULL THEN
      -- Fallback: primera bodega activa del negocio
      SELECT id_bodega INTO v_bodega FROM public.bodegas
       WHERE id_negocio=v_negocio AND activa ORDER BY orden, created_at LIMIT 1;
    END IF;
    IF v_bodega IS NULL THEN RAISE EXCEPTION 'No hay bodegas configuradas' USING ERRCODE='42501'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id_bodega=v_bodega AND id_negocio=v_negocio) THEN
      RAISE EXCEPTION 'Bodega inválida' USING ERRCODE='42501';
    END IF;
  END IF;

  INSERT INTO public.inventario_bodega (id_negocio, id_bodega, id_insumo, cantidad_actual)
  VALUES (v_negocio, v_bodega, p_id_insumo, 0)
  ON CONFLICT (id_bodega, id_insumo) DO NOTHING;

  SELECT cantidad_actual INTO v_anterior FROM public.inventario_bodega
   WHERE id_bodega=v_bodega AND id_insumo=p_id_insumo FOR UPDATE;

  v_diff := p_nueva_cantidad - v_anterior;
  UPDATE public.inventario_bodega SET cantidad_actual=p_nueva_cantidad, updated_at=now()
   WHERE id_bodega=v_bodega AND id_insumo=p_id_insumo;

  INSERT INTO public.movimientos_inventario (
    id_negocio, id_insumo, tipo_movimiento, cantidad,
    cantidad_anterior, cantidad_nueva, motivo, id_usuario, id_bodega_destino
  ) VALUES (
    v_negocio, p_id_insumo, 'AJUSTE_MANUAL', v_diff,
    v_anterior, p_nueva_cantidad, p_motivo, auth.uid(), v_bodega
  );
  RETURN p_nueva_cantidad;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ajustar_stock_manual(uuid, numeric, text, uuid) TO authenticated;

-- =========================================================
-- 13. Actualizar registrar_compra: bodega default + override por línea
-- =========================================================
DROP FUNCTION IF EXISTS public.registrar_compra(uuid, text, text, date, jsonb);
CREATE OR REPLACE FUNCTION public.registrar_compra(
  p_id_proveedor uuid,
  p_numero_factura text,
  p_observaciones text,
  p_fecha_compra date,
  p_items jsonb,
  p_id_bodega_default uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  v_default_bodega uuid := p_id_bodega_default;
  v_bodega_item uuid;
BEGIN
  v_negocio := public.current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF p_id_proveedor IS NULL THEN RAISE EXCEPTION 'Proveedor requerido' USING ERRCODE='23502'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items)=0 THEN
    RAISE EXCEPTION 'Debe registrar al menos un insumo' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proveedores WHERE id_proveedor=p_id_proveedor AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Proveedor inválido' USING ERRCODE='42501';
  END IF;

  -- Default bodega si no se especificó: principal del espacio del usuario, sino primera activa
  IF v_default_bodega IS NULL THEN
    SELECT ebp.id_bodega INTO v_default_bodega
      FROM public.usuarios_staff u
      JOIN public.espacio_bodega_principal ebp ON ebp.id_espacio = u.id_espacio_asignado
     WHERE u.id_usuario = auth.uid() AND u.id_negocio = v_negocio;
    IF v_default_bodega IS NULL THEN
      SELECT id_bodega INTO v_default_bodega FROM public.bodegas
       WHERE id_negocio=v_negocio AND activa ORDER BY orden, created_at LIMIT 1;
    END IF;
    IF v_default_bodega IS NULL THEN RAISE EXCEPTION 'No hay bodegas configuradas' USING ERRCODE='42501'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id_bodega=v_default_bodega AND id_negocio=v_negocio AND activa) THEN
      RAISE EXCEPTION 'Bodega destino inválida' USING ERRCODE='42501';
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario_compra')::numeric;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='23514'; END IF;
    IF v_precio IS NULL OR v_precio < 0 THEN RAISE EXCEPTION 'Precio inválido' USING ERRCODE='23514'; END IF;
    v_total := v_total + (v_cantidad * v_precio);
  END LOOP;

  INSERT INTO public.compras (
    id_negocio, id_proveedor, numero_factura, fecha_compra, estado, total, observaciones
  ) VALUES (
    v_negocio, p_id_proveedor, NULLIF(trim(p_numero_factura),''),
    COALESCE(p_fecha_compra, CURRENT_DATE), 'COMPLETADA', v_total,
    NULLIF(trim(p_observaciones),'')
  ) RETURNING id_compra INTO v_id_compra;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_id_insumo := (v_item->>'id_insumo')::uuid;
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario_compra')::numeric;
    v_subtotal := v_cantidad * v_precio;

    -- Bodega de la línea: override del item o default
    v_bodega_item := NULLIF(v_item->>'id_bodega_destino','')::uuid;
    IF v_bodega_item IS NULL THEN
      v_bodega_item := v_default_bodega;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.bodegas WHERE id_bodega=v_bodega_item AND id_negocio=v_negocio AND activa) THEN
        RAISE EXCEPTION 'Bodega de línea inválida' USING ERRCODE='42501';
      END IF;
    END IF;

    SELECT factor_conversion INTO v_factor FROM public.insumos
     WHERE id_insumo=v_id_insumo AND id_negocio=v_negocio;
    IF v_factor IS NULL THEN RAISE EXCEPTION 'Insumo inválido: %', v_id_insumo USING ERRCODE='42501'; END IF;

    INSERT INTO public.detalle_compra (
      id_compra, id_insumo, cantidad, precio_unitario_compra, subtotal, id_bodega_destino
    ) VALUES (
      v_id_compra, v_id_insumo, v_cantidad, v_precio, v_subtotal, v_bodega_item
    );

    v_convertida := v_cantidad * v_factor;

    INSERT INTO public.inventario_bodega (id_negocio, id_bodega, id_insumo, cantidad_actual)
    VALUES (v_negocio, v_bodega_item, v_id_insumo, 0)
    ON CONFLICT (id_bodega, id_insumo) DO NOTHING;

    SELECT cantidad_actual INTO v_anterior FROM public.inventario_bodega
     WHERE id_bodega=v_bodega_item AND id_insumo=v_id_insumo FOR UPDATE;
    v_nueva := v_anterior + v_convertida;
    UPDATE public.inventario_bodega SET cantidad_actual=v_nueva, updated_at=now()
     WHERE id_bodega=v_bodega_item AND id_insumo=v_id_insumo;

    INSERT INTO public.movimientos_inventario (
      id_negocio, id_insumo, tipo_movimiento, cantidad,
      cantidad_anterior, cantidad_nueva, motivo, referencia_id, id_usuario, id_bodega_destino
    ) VALUES (
      v_negocio, v_id_insumo, 'COMPRA', v_convertida,
      v_anterior, v_nueva,
      'Compra factura ' || COALESCE(NULLIF(trim(p_numero_factura),''), v_id_compra::text) || ' @ ' || v_precio::text,
      v_id_compra, auth.uid(), v_bodega_item
    );
  END LOOP;
  RETURN v_id_compra;
END;
$$;
GRANT EXECUTE ON FUNCTION public.registrar_compra(uuid, text, text, date, jsonb, uuid) TO authenticated;

-- =========================================================
-- 14. Actualizar descontar_inventario_item: descuenta de la bodega principal del espacio (destino del item)
-- =========================================================
CREATE OR REPLACE FUNCTION public.descontar_inventario_item(p_id_item uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_negocio uuid;
  v_id_producto uuid;
  v_id_receta uuid;
  v_cant_item numeric;
  v_destino text;
  v_id_espacio uuid;
  v_id_bodega uuid;
  v_rec record;
  v_consumo numeric;
  v_anterior numeric;
  v_nueva numeric;
BEGIN
  SELECT p.id_negocio, i.id_producto, i.cantidad, i.destino
    INTO v_negocio, v_id_producto, v_cant_item, v_destino
  FROM public.pedido_items i
  JOIN public.pedidos p ON p.id_pedido = i.id_pedido
  WHERE i.id_item = p_id_item;
  IF v_negocio IS NULL THEN RETURN; END IF;

  SELECT id_receta INTO v_id_receta FROM public.productos WHERE id_producto=v_id_producto;
  IF v_id_receta IS NULL THEN RETURN; END IF;

  -- Resolver bodega de descuento por espacio (destino del item)
  IF v_destino IS NOT NULL AND length(v_destino) > 0 THEN
    SELECT id_espacio INTO v_id_espacio FROM public.espacios_trabajo
     WHERE id_negocio=v_negocio AND slug=upper(v_destino) AND activo;
  END IF;
  IF v_id_espacio IS NOT NULL THEN
    SELECT id_bodega INTO v_id_bodega FROM public.espacio_bodega_principal WHERE id_espacio=v_id_espacio;
  END IF;
  IF v_id_bodega IS NULL THEN
    -- Fallback: primera bodega activa del negocio
    SELECT id_bodega INTO v_id_bodega FROM public.bodegas
     WHERE id_negocio=v_negocio AND activa ORDER BY orden, created_at LIMIT 1;
  END IF;
  IF v_id_bodega IS NULL THEN
    RAISE EXCEPTION 'No hay bodega configurada para descontar' USING ERRCODE='42501';
  END IF;

  FOR v_rec IN
    WITH receta AS (
      SELECT rd.id_insumo, rd.cantidad AS cantidad
      FROM public.receta_detalle rd
      WHERE rd.id_receta = v_id_receta
        AND NOT EXISTS (
          SELECT 1 FROM public.pedido_item_exclusiones x
          WHERE x.id_item = p_id_item AND x.id_insumo = rd.id_insumo
        )
    ),
    extras AS (
      SELECT e.id_insumo_extra AS id_insumo, e.cantidad_porcion AS cantidad
      FROM public.pedido_item_extras e WHERE e.id_item = p_id_item
    ),
    variantes AS (
      SELECT v.id_insumo_opcion AS id_insumo, v.cantidad_porcion AS cantidad
      FROM public.pedido_item_variantes v
      WHERE v.id_item = p_id_item AND v.id_insumo_opcion IS NOT NULL AND v.cantidad_porcion > 0
    ),
    todo AS (
      SELECT id_insumo, cantidad FROM receta
      UNION ALL SELECT id_insumo, cantidad FROM extras
      UNION ALL SELECT id_insumo, cantidad FROM variantes
    )
    SELECT id_insumo, SUM(cantidad) AS total FROM todo GROUP BY id_insumo
  LOOP
    v_consumo := v_rec.total * COALESCE(v_cant_item,1);
    IF v_consumo IS NULL OR v_consumo <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.inventario_bodega (id_negocio, id_bodega, id_insumo, cantidad_actual)
    VALUES (v_negocio, v_id_bodega, v_rec.id_insumo, 0)
    ON CONFLICT (id_bodega, id_insumo) DO NOTHING;

    SELECT cantidad_actual INTO v_anterior FROM public.inventario_bodega
     WHERE id_bodega=v_id_bodega AND id_insumo=v_rec.id_insumo FOR UPDATE;
    v_nueva := v_anterior - v_consumo;

    UPDATE public.inventario_bodega SET cantidad_actual=v_nueva, updated_at=now()
     WHERE id_bodega=v_id_bodega AND id_insumo=v_rec.id_insumo;

    INSERT INTO public.movimientos_inventario (
      id_negocio, id_insumo, tipo_movimiento, cantidad,
      cantidad_anterior, cantidad_nueva, motivo, referencia_id, id_usuario, id_bodega_origen
    ) VALUES (
      v_negocio, v_rec.id_insumo, 'CONSUMO_PREPARACION', -v_consumo,
      v_anterior, v_nueva,
      'Consumo por preparación item ' || p_id_item::text,
      p_id_item, auth.uid(), v_id_bodega
    );
  END LOOP;
END;
$$;
