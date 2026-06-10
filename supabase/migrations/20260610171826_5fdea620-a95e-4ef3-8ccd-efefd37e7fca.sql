
-- 1. Columnas nuevas
ALTER TABLE public.usuarios_staff
  ADD COLUMN IF NOT EXISTS recibe_propinas boolean NOT NULL DEFAULT false;

ALTER TABLE public.negocio
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Bogota';

-- 2. Tabla turnos_staff
CREATE TABLE IF NOT EXISTS public.turnos_staff (
  id_turno uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  id_usuario uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  iniciado_at timestamptz NOT NULL DEFAULT now(),
  finalizado_at timestamptz NULL,
  cerrado_por text NULL CHECK (cerrado_por IS NULL OR cerrado_por IN ('USUARIO','AUTO_12H','CIERRE_CAJA')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS turnos_staff_negocio_inicio_idx
  ON public.turnos_staff(id_negocio, iniciado_at);
CREATE INDEX IF NOT EXISTS turnos_staff_usuario_fin_idx
  ON public.turnos_staff(id_usuario, finalizado_at);
CREATE UNIQUE INDEX IF NOT EXISTS turnos_staff_un_abierto_por_usuario
  ON public.turnos_staff(id_usuario) WHERE finalizado_at IS NULL;

GRANT SELECT ON public.turnos_staff TO authenticated;
GRANT ALL ON public.turnos_staff TO service_role;

ALTER TABLE public.turnos_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff lee sus turnos del negocio"
  ON public.turnos_staff FOR SELECT TO authenticated
  USING (
    id_negocio IN (
      SELECT id_negocio FROM public.usuarios_staff WHERE id_usuario = auth.uid()
    )
  );

-- 3. iniciar_turno: ahora también inserta en turnos_staff
CREATE OR REPLACE FUNCTION public.iniciar_turno()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol rol_staff;
  v_negocio uuid;
  v_ya_abierto uuid;
BEGIN
  SELECT rol, id_negocio INTO v_rol, v_negocio
  FROM public.usuarios_staff
  WHERE id_usuario = auth.uid();

  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Usuario no es staff';
  END IF;

  IF v_rol NOT IN ('MESERO','COCINA','BARRA','ADMIN') THEN
    RAISE EXCEPTION 'Rol no puede iniciar turno';
  END IF;

  UPDATE public.usuarios_staff
  SET esta_en_turno = true,
      turno_iniciado_at = COALESCE(turno_iniciado_at, now())
  WHERE id_usuario = auth.uid();

  SELECT id_turno INTO v_ya_abierto
  FROM public.turnos_staff
  WHERE id_usuario = auth.uid() AND finalizado_at IS NULL
  LIMIT 1;

  IF v_ya_abierto IS NULL THEN
    INSERT INTO public.turnos_staff (id_negocio, id_usuario, iniciado_at)
    VALUES (v_negocio, auth.uid(),
            COALESCE((SELECT turno_iniciado_at FROM public.usuarios_staff WHERE id_usuario = auth.uid()), now()));
  END IF;
END;
$$;

-- 4. finalizar_turno: cierra fila en turnos_staff
CREATE OR REPLACE FUNCTION public.finalizar_turno()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol rol_staff;
  v_mesas_abiertas int;
BEGIN
  SELECT rol INTO v_rol
  FROM public.usuarios_staff
  WHERE id_usuario = auth.uid();

  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Usuario no es staff';
  END IF;

  IF v_rol = 'MESERO' THEN
    SELECT count(*) INTO v_mesas_abiertas
    FROM public.mesas
    WHERE id_mesero_asignado = auth.uid()
      AND estado <> 'LIBRE';

    IF v_mesas_abiertas > 0 THEN
      RAISE EXCEPTION 'No puedes salir de turno: tienes % mesa(s) con cuenta abierta', v_mesas_abiertas;
    END IF;
  END IF;

  UPDATE public.usuarios_staff
  SET esta_en_turno = false,
      turno_iniciado_at = NULL
  WHERE id_usuario = auth.uid();

  UPDATE public.turnos_staff
  SET finalizado_at = now(),
      cerrado_por = 'USUARIO'
  WHERE id_usuario = auth.uid() AND finalizado_at IS NULL;
END;
$$;

-- 5. cerrar_turnos_vencidos: cron / endpoint público
CREATE OR REPLACE FUNCTION public.cerrar_turnos_vencidos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH vencidos AS (
    SELECT id_turno, id_usuario, iniciado_at
    FROM public.turnos_staff
    WHERE finalizado_at IS NULL
      AND iniciado_at < now() - interval '12 hours'
  ), cerrados AS (
    UPDATE public.turnos_staff t
    SET finalizado_at = t.iniciado_at + interval '12 hours',
        cerrado_por = 'AUTO_12H'
    FROM vencidos v
    WHERE t.id_turno = v.id_turno
    RETURNING t.id_usuario
  )
  UPDATE public.usuarios_staff u
  SET esta_en_turno = false,
      turno_iniciado_at = NULL
  WHERE u.id_usuario IN (SELECT id_usuario FROM cerrados);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 6. calcular_propinas_por_usuario(desde, hasta)
CREATE OR REPLACE FUNCTION public.calcular_propinas_por_usuario(
  _desde date,
  _hasta date
)
RETURNS TABLE (
  id_usuario uuid,
  nombre text,
  rol rol_staff,
  dias_activos int,
  total_propinas numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_tz text;
BEGIN
  SELECT u.id_negocio, n.timezone INTO v_negocio, v_tz
  FROM public.usuarios_staff u
  JOIN public.negocio n ON n.id_negocio = u.id_negocio
  WHERE u.id_usuario = auth.uid();

  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'Usuario no es staff';
  END IF;

  RETURN QUERY
  WITH dias AS (
    SELECT d::date AS dia
    FROM generate_series(_desde, _hasta, interval '1 day') AS d
  ),
  propinas_dia AS (
    SELECT ((p.created_at AT TIME ZONE v_tz)::date) AS dia,
           COALESCE(SUM(p.propina), 0)::numeric AS total
    FROM public.pagos p
    WHERE p.id_negocio = v_negocio
      AND p.estado_confirmacion = 'APROBADO'
      AND ((p.created_at AT TIME ZONE v_tz)::date) BETWEEN _desde AND _hasta
    GROUP BY 1
  ),
  turnos_dia AS (
    SELECT ((t.iniciado_at AT TIME ZONE v_tz)::date) AS dia,
           t.id_usuario
    FROM public.turnos_staff t
    JOIN public.usuarios_staff u ON u.id_usuario = t.id_usuario
    WHERE t.id_negocio = v_negocio
      AND u.recibe_propinas = true
      AND ((t.iniciado_at AT TIME ZONE v_tz)::date) BETWEEN _desde AND _hasta
    GROUP BY 1, 2
  ),
  activos_por_dia AS (
    SELECT dia, COUNT(*)::int AS n FROM turnos_dia GROUP BY dia
  ),
  reparto AS (
    SELECT t.id_usuario,
           t.dia,
           COALESCE(pd.total, 0) / NULLIF(a.n, 0) AS monto
    FROM turnos_dia t
    JOIN activos_por_dia a ON a.dia = t.dia
    LEFT JOIN propinas_dia pd ON pd.dia = t.dia
  )
  SELECT u.id_usuario,
         u.nombre,
         u.rol,
         COALESCE(COUNT(r.dia)::int, 0) AS dias_activos,
         COALESCE(SUM(r.monto), 0)::numeric AS total_propinas
  FROM public.usuarios_staff u
  LEFT JOIN reparto r ON r.id_usuario = u.id_usuario
  WHERE u.id_negocio = v_negocio
    AND u.recibe_propinas = true
  GROUP BY u.id_usuario, u.nombre, u.rol
  ORDER BY total_propinas DESC, u.nombre ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_propinas_por_usuario(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_turnos_vencidos() TO service_role;

-- 7. Backfill: abrir filas turnos_staff para staff actualmente en turno
INSERT INTO public.turnos_staff (id_negocio, id_usuario, iniciado_at)
SELECT u.id_negocio, u.id_usuario, COALESCE(u.turno_iniciado_at, now())
FROM public.usuarios_staff u
WHERE u.esta_en_turno = true
  AND NOT EXISTS (
    SELECT 1 FROM public.turnos_staff t
    WHERE t.id_usuario = u.id_usuario AND t.finalizado_at IS NULL
  );
