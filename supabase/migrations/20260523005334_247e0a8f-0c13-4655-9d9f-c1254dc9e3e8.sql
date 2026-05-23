CREATE OR REPLACE FUNCTION public.iniciar_comanda_estacion(p_id_pedido uuid, p_destino text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio uuid;
  v_rol rol_staff;
  v_count integer := 0;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT rol INTO v_rol FROM usuarios_staff WHERE id_usuario = auth.uid();
  IF v_rol IS NULL THEN RAISE EXCEPTION 'Sin rol' USING ERRCODE='42501'; END IF;

  IF p_destino NOT IN ('COCINA','BARRA') THEN
    RAISE EXCEPTION 'Destino inválido' USING ERRCODE='23514';
  END IF;
  IF p_destino = 'COCINA' AND v_rol NOT IN ('COCINA','ADMIN','SUPERADMIN') THEN
    RAISE EXCEPTION 'Solo cocina puede iniciar' USING ERRCODE='42501';
  END IF;
  IF p_destino = 'BARRA' AND v_rol NOT IN ('BARRA','ADMIN','SUPERADMIN') THEN
    RAISE EXCEPTION 'Solo barra puede iniciar' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pedidos WHERE id_pedido = p_id_pedido AND id_negocio = v_negocio AND estado = 'CONFIRMADO'
  ) THEN
    RAISE EXCEPTION 'Pedido inválido' USING ERRCODE='42501';
  END IF;

  UPDATE pedido_items
  SET estado_preparacion = 'EN_PREPARACION',
      iniciado_at = COALESCE(iniciado_at, now())
  WHERE id_pedido = p_id_pedido
    AND destino = p_destino
    AND estado_preparacion = 'EN_COLA';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;