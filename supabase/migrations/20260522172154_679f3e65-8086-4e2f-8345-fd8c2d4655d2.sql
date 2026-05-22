
-- ===== CATEGORIAS =====
CREATE TABLE public.categorias (
  id_categoria uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_negocio, nombre)
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY categorias_select_own ON public.categorias FOR SELECT TO authenticated USING (id_negocio = current_user_negocio());
CREATE POLICY categorias_insert_own ON public.categorias FOR INSERT TO authenticated WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY categorias_update_own ON public.categorias FOR UPDATE TO authenticated USING (id_negocio = current_user_negocio()) WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY categorias_delete_own ON public.categorias FOR DELETE TO authenticated USING (id_negocio = current_user_negocio());

-- ===== SUBCATEGORIAS =====
CREATE TABLE public.subcategorias (
  id_subcategoria uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_categoria uuid NOT NULL REFERENCES public.categorias(id_categoria) ON DELETE RESTRICT,
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_categoria, nombre)
);
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY subcategorias_select_own ON public.subcategorias FOR SELECT TO authenticated USING (id_negocio = current_user_negocio());
CREATE POLICY subcategorias_insert_own ON public.subcategorias FOR INSERT TO authenticated WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY subcategorias_update_own ON public.subcategorias FOR UPDATE TO authenticated USING (id_negocio = current_user_negocio()) WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY subcategorias_delete_own ON public.subcategorias FOR DELETE TO authenticated USING (id_negocio = current_user_negocio());

-- ===== RECETA_MASTER =====
CREATE TABLE public.receta_master (
  id_receta uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  id_categoria uuid NOT NULL REFERENCES public.categorias(id_categoria) ON DELETE RESTRICT,
  id_subcategoria uuid NOT NULL REFERENCES public.subcategorias(id_subcategoria) ON DELETE RESTRICT,
  nombre_receta text NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_negocio, nombre_receta)
);
ALTER TABLE public.receta_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY receta_select_own ON public.receta_master FOR SELECT TO authenticated USING (id_negocio = current_user_negocio());
CREATE POLICY receta_insert_own ON public.receta_master FOR INSERT TO authenticated WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY receta_update_own ON public.receta_master FOR UPDATE TO authenticated USING (id_negocio = current_user_negocio()) WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY receta_delete_own ON public.receta_master FOR DELETE TO authenticated USING (id_negocio = current_user_negocio());

-- ===== RECETA_DETALLE =====
CREATE TABLE public.receta_detalle (
  id_detalle uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_receta uuid NOT NULL REFERENCES public.receta_master(id_receta) ON DELETE CASCADE,
  id_insumo uuid NOT NULL REFERENCES public.insumos(id_insumo) ON DELETE RESTRICT,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_receta, id_insumo)
);
ALTER TABLE public.receta_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY recdet_select_own ON public.receta_detalle FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.receta_master r WHERE r.id_receta = receta_detalle.id_receta AND r.id_negocio = current_user_negocio()));
CREATE POLICY recdet_insert_own ON public.receta_detalle FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.receta_master r WHERE r.id_receta = receta_detalle.id_receta AND r.id_negocio = current_user_negocio()));
CREATE POLICY recdet_update_own ON public.receta_detalle FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.receta_master r WHERE r.id_receta = receta_detalle.id_receta AND r.id_negocio = current_user_negocio()));
CREATE POLICY recdet_delete_own ON public.receta_detalle FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.receta_master r WHERE r.id_receta = receta_detalle.id_receta AND r.id_negocio = current_user_negocio()));

-- ===== PRODUCTOS =====
CREATE TABLE public.productos (
  id_producto uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  id_receta uuid NOT NULL UNIQUE REFERENCES public.receta_master(id_receta) ON DELETE CASCADE,
  nombre_producto text NOT NULL,
  descripcion_producto text,
  precio_venta numeric NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  url_imagen text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY productos_select_own ON public.productos FOR SELECT TO authenticated USING (id_negocio = current_user_negocio());
CREATE POLICY productos_insert_own ON public.productos FOR INSERT TO authenticated WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY productos_update_own ON public.productos FOR UPDATE TO authenticated USING (id_negocio = current_user_negocio()) WITH CHECK (id_negocio = current_user_negocio());
CREATE POLICY productos_delete_own ON public.productos FOR DELETE TO authenticated USING (id_negocio = current_user_negocio());

-- ===== EXTRAS_PERMITIDOS =====
CREATE TABLE public.extras_permitidos (
  id_extra uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_producto uuid NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE,
  id_insumo_extra uuid NOT NULL REFERENCES public.insumos(id_insumo) ON DELETE RESTRICT,
  cantidad_porcion numeric NOT NULL CHECK (cantidad_porcion > 0),
  precio_extra numeric NOT NULL DEFAULT 0 CHECK (precio_extra >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_producto, id_insumo_extra)
);
ALTER TABLE public.extras_permitidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY extras_select_own ON public.extras_permitidos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.productos p WHERE p.id_producto = extras_permitidos.id_producto AND p.id_negocio = current_user_negocio()));
CREATE POLICY extras_insert_own ON public.extras_permitidos FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.productos p WHERE p.id_producto = extras_permitidos.id_producto AND p.id_negocio = current_user_negocio()));
CREATE POLICY extras_update_own ON public.extras_permitidos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.productos p WHERE p.id_producto = extras_permitidos.id_producto AND p.id_negocio = current_user_negocio()));
CREATE POLICY extras_delete_own ON public.extras_permitidos FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.productos p WHERE p.id_producto = extras_permitidos.id_producto AND p.id_negocio = current_user_negocio()));

-- updated_at triggers helper (idempotent)
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER receta_master_touch BEFORE UPDATE ON public.receta_master FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER productos_touch BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== RPC: crear_receta =====
CREATE OR REPLACE FUNCTION public.crear_receta(
  p_id_categoria uuid,
  p_id_subcategoria uuid,
  p_nombre text,
  p_descripcion text,
  p_ingredientes jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF p_ingredientes IS NULL OR jsonb_array_length(p_ingredientes) = 0 THEN RAISE EXCEPTION 'Debe agregar al menos un ingrediente' USING ERRCODE='23514'; END IF;

  IF NOT EXISTS (SELECT 1 FROM categorias WHERE id_categoria = p_id_categoria AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Categoría inválida' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subcategorias WHERE id_subcategoria = p_id_subcategoria AND id_categoria = p_id_categoria AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Subcategoría inválida' USING ERRCODE='42501';
  END IF;

  INSERT INTO receta_master (id_negocio, id_categoria, id_subcategoria, nombre_receta, descripcion)
  VALUES (v_negocio, p_id_categoria, p_id_subcategoria, trim(p_nombre), NULLIF(trim(p_descripcion),''))
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
END;$$;

-- ===== RPC: actualizar_receta =====
CREATE OR REPLACE FUNCTION public.actualizar_receta(
  p_id_receta uuid,
  p_id_categoria uuid,
  p_id_subcategoria uuid,
  p_nombre text,
  p_descripcion text,
  p_ingredientes jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      descripcion = NULLIF(trim(p_descripcion),'')
  WHERE id_receta = p_id_receta AND id_negocio = v_negocio;

  -- Propagar nombre al producto
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
END;$$;

-- ===== RPC: duplicar_receta =====
CREATE OR REPLACE FUNCTION public.duplicar_receta(p_id_receta uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_negocio uuid;
  v_new_id uuid;
  v_nombre text;
  v_candidato text;
  v_i int := 0;
  v_src record;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_src FROM receta_master WHERE id_receta = p_id_receta AND id_negocio = v_negocio;
  IF v_src IS NULL THEN RAISE EXCEPTION 'Receta no encontrada' USING ERRCODE='P0002'; END IF;

  v_candidato := v_src.nombre_receta || ' (copia)';
  WHILE EXISTS (SELECT 1 FROM receta_master WHERE id_negocio = v_negocio AND nombre_receta = v_candidato) LOOP
    v_i := v_i + 1;
    v_candidato := v_src.nombre_receta || ' (copia ' || v_i || ')';
  END LOOP;
  v_nombre := v_candidato;

  INSERT INTO receta_master (id_negocio, id_categoria, id_subcategoria, nombre_receta, descripcion)
  VALUES (v_negocio, v_src.id_categoria, v_src.id_subcategoria, v_nombre, v_src.descripcion)
  RETURNING id_receta INTO v_new_id;

  INSERT INTO receta_detalle (id_receta, id_insumo, cantidad)
  SELECT v_new_id, id_insumo, cantidad FROM receta_detalle WHERE id_receta = p_id_receta;

  INSERT INTO productos (id_negocio, id_receta, nombre_producto, activo)
  VALUES (v_negocio, v_new_id, v_nombre, true);

  RETURN v_new_id;
END;$$;

-- ===== RPC: eliminar_receta =====
CREATE OR REPLACE FUNCTION public.eliminar_receta(p_id_receta uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_negocio uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  DELETE FROM receta_master WHERE id_receta = p_id_receta AND id_negocio = v_negocio;
END;$$;

-- ===== RPC: guardar_extras_producto =====
CREATE OR REPLACE FUNCTION public.guardar_extras_producto(
  p_id_producto uuid,
  p_extras jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_negocio uuid;
  v_item jsonb;
  v_id_insumo uuid;
  v_cant numeric;
  v_precio numeric;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM productos WHERE id_producto = p_id_producto AND id_negocio = v_negocio) THEN
    RAISE EXCEPTION 'Producto no encontrado' USING ERRCODE='P0002';
  END IF;

  DELETE FROM extras_permitidos WHERE id_producto = p_id_producto;

  IF p_extras IS NULL OR jsonb_array_length(p_extras) = 0 THEN RETURN; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_extras) LOOP
    v_id_insumo := (v_item->>'id_insumo_extra')::uuid;
    v_cant := (v_item->>'cantidad_porcion')::numeric;
    v_precio := COALESCE((v_item->>'precio_extra')::numeric, 0);
    IF v_cant IS NULL OR v_cant <= 0 THEN RAISE EXCEPTION 'Cantidad de porción inválida' USING ERRCODE='23514'; END IF;
    IF v_precio < 0 THEN RAISE EXCEPTION 'Precio inválido' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM insumos WHERE id_insumo = v_id_insumo AND id_negocio = v_negocio) THEN
      RAISE EXCEPTION 'Insumo inválido' USING ERRCODE='42501';
    END IF;
    INSERT INTO extras_permitidos (id_producto, id_insumo_extra, cantidad_porcion, precio_extra)
    VALUES (p_id_producto, v_id_insumo, v_cant, v_precio);
  END LOOP;
END;$$;
