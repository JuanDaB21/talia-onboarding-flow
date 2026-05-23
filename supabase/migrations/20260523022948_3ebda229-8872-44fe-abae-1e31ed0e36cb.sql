-- Columna histórica para inicio de turno
ALTER TABLE public.usuarios_staff
  ADD COLUMN IF NOT EXISTS turno_iniciado_at timestamptz;

-- RPC: iniciar turno
CREATE OR REPLACE FUNCTION public.iniciar_turno()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol rol_staff;
BEGIN
  SELECT rol INTO v_rol
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.iniciar_turno() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_turno() TO authenticated;

-- RPC: finalizar turno
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalizar_turno() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_turno() TO authenticated;