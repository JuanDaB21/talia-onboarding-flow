
-- 1. Tabla espacios_trabajo
CREATE TABLE public.espacios_trabajo (
  id_espacio uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  nombre text NOT NULL,
  slug text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  es_sistema boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_negocio, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.espacios_trabajo TO authenticated;
GRANT ALL ON public.espacios_trabajo TO service_role;

ALTER TABLE public.espacios_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lee espacios de su negocio"
ON public.espacios_trabajo FOR SELECT
TO authenticated
USING (id_negocio = public.current_user_negocio());

CREATE POLICY "Admin gestiona espacios de su negocio"
ON public.espacios_trabajo FOR ALL
TO authenticated
USING (id_negocio = public.current_user_negocio() AND public.is_admin_actual())
WITH CHECK (id_negocio = public.current_user_negocio() AND public.is_admin_actual());

CREATE TRIGGER espacios_trabajo_updated_at
BEFORE UPDATE ON public.espacios_trabajo
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Validación: al menos un espacio activo
CREATE OR REPLACE FUNCTION public.validar_al_menos_un_espacio_activo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.es_sistema THEN
      RAISE EXCEPTION 'No se puede eliminar un espacio del sistema (%, %). Desactívalo si no lo usas.', OLD.nombre, OLD.slug;
    END IF;
    SELECT count(*) INTO v_count FROM public.espacios_trabajo
     WHERE id_negocio = OLD.id_negocio AND activo = true AND id_espacio <> OLD.id_espacio;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'Debe quedar al menos un espacio de trabajo activo en el negocio';
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.activo = false THEN
      SELECT count(*) INTO v_count FROM public.espacios_trabajo
       WHERE id_negocio = NEW.id_negocio AND activo = true AND id_espacio <> NEW.id_espacio;
      IF v_count = 0 THEN
        RAISE EXCEPTION 'Debe quedar al menos un espacio de trabajo activo en el negocio';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER espacios_trabajo_min_activo
BEFORE UPDATE OR DELETE ON public.espacios_trabajo
FOR EACH ROW EXECUTE FUNCTION public.validar_al_menos_un_espacio_activo();

-- 3. Seed para negocios existentes
INSERT INTO public.espacios_trabajo (id_negocio, nombre, slug, activo, es_sistema, orden)
SELECT n.id_negocio, 'Cocina', 'COCINA', true, true, 0
FROM public.negocio n
ON CONFLICT (id_negocio, slug) DO NOTHING;

INSERT INTO public.espacios_trabajo (id_negocio, nombre, slug, activo, es_sistema, orden)
SELECT n.id_negocio, 'Barra', 'BARRA', true, true, 1
FROM public.negocio n
ON CONFLICT (id_negocio, slug) DO NOTHING;

-- 4. Trigger: seed automático para nuevos negocios
CREATE OR REPLACE FUNCTION public.seed_espacios_negocio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.espacios_trabajo (id_negocio, nombre, slug, activo, es_sistema, orden)
  VALUES
    (NEW.id_negocio, 'Cocina', 'COCINA', true, true, 0),
    (NEW.id_negocio, 'Barra',  'BARRA',  true, true, 1)
  ON CONFLICT (id_negocio, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER negocio_seed_espacios
AFTER INSERT ON public.negocio
FOR EACH ROW EXECUTE FUNCTION public.seed_espacios_negocio();

-- 5. Agregar ESTACION al enum rol_staff
ALTER TYPE public.rol_staff ADD VALUE IF NOT EXISTS 'ESTACION';

-- 6. Columna id_espacio_asignado en usuarios_staff
ALTER TABLE public.usuarios_staff
  ADD COLUMN IF NOT EXISTS id_espacio_asignado uuid REFERENCES public.espacios_trabajo(id_espacio) ON DELETE SET NULL;

-- 7. Backfill: usuarios COCINA/BARRA reciben su espacio
UPDATE public.usuarios_staff u
SET id_espacio_asignado = e.id_espacio
FROM public.espacios_trabajo e
WHERE e.id_negocio = u.id_negocio
  AND e.slug = u.rol::text
  AND u.rol::text IN ('COCINA','BARRA')
  AND u.id_espacio_asignado IS NULL;

-- 8. Reemplazar iniciar_comanda_estacion para aceptar cualquier slug de espacio activo
CREATE OR REPLACE FUNCTION public.iniciar_comanda_estacion(p_id_pedido uuid, p_destino text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_rol rol_staff;
  v_id_espacio_usuario uuid;
  v_id_espacio uuid;
  v_count integer := 0;
  v_id uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  SELECT rol, id_espacio_asignado INTO v_rol, v_id_espacio_usuario
  FROM usuarios_staff WHERE id_usuario = auth.uid();
  IF v_rol IS NULL THEN RAISE EXCEPTION 'Sin rol' USING ERRCODE='42501'; END IF;

  SELECT id_espacio INTO v_id_espacio
  FROM espacios_trabajo
  WHERE id_negocio = v_negocio AND slug = upper(p_destino) AND activo = true;
  IF v_id_espacio IS NULL THEN
    RAISE EXCEPTION 'Espacio de trabajo inválido o inactivo: %', p_destino USING ERRCODE='23514';
  END IF;

  IF v_rol NOT IN ('ADMIN','SUPERADMIN') THEN
    IF v_rol NOT IN ('COCINA','BARRA','ESTACION') OR v_id_espacio_usuario IS DISTINCT FROM v_id_espacio THEN
      RAISE EXCEPTION 'Solo personal asignado a este espacio puede iniciar' USING ERRCODE='42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pedidos WHERE id_pedido = p_id_pedido AND id_negocio = v_negocio AND estado = 'CONFIRMADO'
  ) THEN
    RAISE EXCEPTION 'Pedido inválido' USING ERRCODE='42501';
  END IF;

  FOR v_id IN
    SELECT id_item FROM pedido_items
    WHERE id_pedido = p_id_pedido
      AND upper(coalesce(destino,'')) = upper(p_destino)
      AND estado_preparacion = 'EN_COLA'
      AND iniciado_at IS NULL
  LOOP
    PERFORM public.descontar_inventario_item(v_id);
    v_count := v_count + 1;
  END LOOP;

  UPDATE pedido_items
  SET estado_preparacion = 'EN_PREPARACION',
      iniciado_at = COALESCE(iniciado_at, now())
  WHERE id_pedido = p_id_pedido
    AND upper(coalesce(destino,'')) = upper(p_destino)
    AND estado_preparacion = 'EN_COLA';

  RETURN v_count;
END;
$$;

-- 9. Helper para frontend: espacio asignado al usuario actual
CREATE OR REPLACE FUNCTION public.mi_espacio_slug()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.slug
  FROM public.usuarios_staff u
  LEFT JOIN public.espacios_trabajo e ON e.id_espacio = u.id_espacio_asignado
  WHERE u.id_usuario = auth.uid()
  LIMIT 1
$$;
