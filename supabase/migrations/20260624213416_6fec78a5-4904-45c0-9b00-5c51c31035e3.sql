CREATE OR REPLACE FUNCTION public.solicitar_accion_cliente(p_id_mesa uuid, p_tipo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_tipo NOT IN ('PEDIR_MAS','CUENTA','TOMAR_PEDIDO') THEN
    RAISE EXCEPTION 'Tipo inválido' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa) THEN
    RAISE EXCEPTION 'Mesa no encontrada' USING ERRCODE='P0002';
  END IF;
  UPDATE mesas SET solicitud_cliente=p_tipo, solicitud_at=now() WHERE id_mesa=p_id_mesa;
END;
$function$;