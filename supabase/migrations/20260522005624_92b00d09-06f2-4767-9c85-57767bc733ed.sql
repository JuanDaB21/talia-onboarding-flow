
REVOKE EXECUTE ON FUNCTION public.ajustar_stock_manual(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_stock_manual(uuid, numeric, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.crear_inventario_para_insumo() FROM PUBLIC, anon, authenticated;
