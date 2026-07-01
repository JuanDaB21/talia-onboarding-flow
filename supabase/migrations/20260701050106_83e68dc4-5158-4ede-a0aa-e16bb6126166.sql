
CREATE OR REPLACE FUNCTION public.abrir_mesa(p_id_mesa uuid, p_id_mesero uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_mesa_negocio uuid;
  v_mesa_estado text;
  v_rol text;
  v_caller uuid;
  v_target uuid;
  v_target_rol text;
  v_target_estado text;
  v_target_negocio uuid;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  v_caller := auth.uid();

  SELECT id_negocio, estado::text INTO v_mesa_negocio, v_mesa_estado
  FROM mesas WHERE id_mesa = p_id_mesa;
  IF v_mesa_negocio IS NULL OR v_mesa_negocio <> v_negocio THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;
  IF v_mesa_estado <> 'LIBRE' THEN
    RAISE EXCEPTION 'La mesa ya está abierta' USING ERRCODE='42501';
  END IF;

  SELECT rol::text INTO v_rol FROM usuarios_staff
   WHERE id_usuario = v_caller AND id_negocio = v_negocio;
  IF v_rol IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  IF p_id_mesero IS NULL THEN
    IF v_rol = 'MESERO' THEN
      v_target := v_caller;
    ELSE
      RAISE EXCEPTION 'Debes seleccionar un mesero' USING ERRCODE='22023';
    END IF;
  ELSE
    v_target := p_id_mesero;
    IF v_rol = 'MESERO' AND v_target <> v_caller THEN
      RAISE EXCEPTION 'Un mesero solo puede abrir mesas para sí mismo' USING ERRCODE='42501';
    END IF;
  END IF;

  SELECT rol::text, estado::text, id_negocio
    INTO v_target_rol, v_target_estado, v_target_negocio
  FROM usuarios_staff WHERE id_usuario = v_target;
  IF v_target_rol IS NULL
     OR v_target_rol <> 'MESERO'
     OR v_target_estado <> 'ACTIVO'
     OR v_target_negocio <> v_negocio THEN
    RAISE EXCEPTION 'Mesero inválido' USING ERRCODE='22023';
  END IF;

  UPDATE mesas SET
    estado = 'OCUPADA',
    id_mesero_asignado = v_target,
    asignada_at = now(),
    liberada_at = NULL,
    solicitud_cliente = NULL,
    solicitud_at = NULL
  WHERE id_mesa = p_id_mesa;

  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.abrir_mesa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_mesa(uuid, uuid) TO authenticated;
