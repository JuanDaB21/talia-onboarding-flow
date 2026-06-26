
CREATE OR REPLACE FUNCTION public.reabrir_caja()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_negocio uuid;
  v_caja caja_dia;
BEGIN
  IF NOT public.is_admin_actual() THEN
    RAISE EXCEPTION 'Solo administradores pueden reabrir la caja';
  END IF;
  v_negocio := public.current_user_negocio();
  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'No tienes negocio asignado';
  END IF;

  SELECT * INTO v_caja FROM caja_dia
   WHERE id_negocio = v_negocio AND fecha = CURRENT_DATE
   FOR UPDATE;
  IF v_caja.id_caja IS NULL THEN
    RAISE EXCEPTION 'No hay caja de hoy para reabrir';
  END IF;
  IF v_caja.estado = 'ABIERTA' THEN
    RAISE EXCEPTION 'La caja ya está abierta';
  END IF;

  UPDATE caja_dia
     SET estado = 'ABIERTA',
         cerrada_at = NULL,
         cerrada_por = NULL,
         efectivo_fisico = 0,
         datafono_fisico = 0,
         diferencia_efectivo = 0,
         diferencia_datafono = 0,
         nota_cuadre = COALESCE(NULLIF(nota_cuadre,'') || E'\n','') || '[Reabierta ' || to_char(now(),'YYYY-MM-DD HH24:MI') || ']'
   WHERE id_caja = v_caja.id_caja;

  RETURN v_caja.id_caja;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reabrir_caja() TO authenticated;
