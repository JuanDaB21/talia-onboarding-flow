REVOKE EXECUTE ON FUNCTION public.registrar_pago(uuid, metodo_pago, text, text, text, uuid[], numeric, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago(uuid, metodo_pago, text, text, text, uuid[], numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago(uuid, metodo_pago, text, text, text, uuid[], numeric, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pagar_con_abono_reserva(uuid, uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.pagar_con_abono_reserva(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pagar_con_abono_reserva(uuid, uuid, uuid[]) TO service_role;