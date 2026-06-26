CREATE OR REPLACE FUNCTION public.calcular_propinas_por_usuario(_desde date, _hasta date)
 RETURNS TABLE(id_usuario uuid, nombre text, rol rol_staff, dias_activos integer, total_propinas numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_tz text;
  v_retencion numeric;
BEGIN
  SELECT u.id_negocio, n.timezone, COALESCE(n.porcentaje_retencion_propina, 0)
    INTO v_negocio, v_tz, v_retencion
  FROM public.usuarios_staff u
  JOIN public.negocio n ON n.id_negocio = u.id_negocio
  WHERE u.id_usuario = auth.uid();

  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'Usuario no es staff';
  END IF;

  RETURN QUERY
  WITH propinas_dia AS (
    SELECT ((p.created_at AT TIME ZONE v_tz)::date) AS dia,
           (COALESCE(SUM(p.propina), 0) * (1 - v_retencion / 100.0))::numeric AS total
    FROM public.pagos p
    WHERE p.id_negocio = v_negocio
      AND p.estado_confirmacion = 'CONFIRMADO'
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
$function$;