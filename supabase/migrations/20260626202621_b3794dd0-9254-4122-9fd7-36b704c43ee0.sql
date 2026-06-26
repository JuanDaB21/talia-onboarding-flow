REVOKE EXECUTE ON FUNCTION public.solicitar_accion_cliente(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.solicitar_accion_cliente(uuid, text) TO authenticated, service_role;