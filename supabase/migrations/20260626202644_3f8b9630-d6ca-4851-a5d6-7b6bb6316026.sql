REVOKE EXECUTE ON FUNCTION public.solicitar_accion_cliente(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_accion_cliente(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.aceptar_prepedido_mesa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceptar_prepedido_mesa(uuid) TO authenticated, service_role;