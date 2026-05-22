CREATE TRIGGER trg_crear_inventario_para_insumo
AFTER INSERT ON public.insumos
FOR EACH ROW EXECUTE FUNCTION public.crear_inventario_para_insumo();

ALTER TABLE public.inventario_actual REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventario_actual;