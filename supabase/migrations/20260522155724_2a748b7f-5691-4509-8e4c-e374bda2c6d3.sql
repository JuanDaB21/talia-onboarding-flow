DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_actual_id_insumo_fkey') THEN
    ALTER TABLE public.inventario_actual ADD CONSTRAINT inventario_actual_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES public.insumos(id_insumo) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_actual_id_negocio_fkey') THEN
    ALTER TABLE public.inventario_actual ADD CONSTRAINT inventario_actual_id_negocio_fkey FOREIGN KEY (id_negocio) REFERENCES public.negocio(id_negocio) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_id_proveedor_fkey') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_id_proveedor_fkey FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id_proveedor);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_id_negocio_fkey') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_id_negocio_fkey FOREIGN KEY (id_negocio) REFERENCES public.negocio(id_negocio) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'detalle_compra_id_compra_fkey') THEN
    ALTER TABLE public.detalle_compra ADD CONSTRAINT detalle_compra_id_compra_fkey FOREIGN KEY (id_compra) REFERENCES public.compras(id_compra) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'detalle_compra_id_insumo_fkey') THEN
    ALTER TABLE public.detalle_compra ADD CONSTRAINT detalle_compra_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES public.insumos(id_insumo);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_id_insumo_fkey') THEN
    ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_inventario_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES public.insumos(id_insumo) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_id_negocio_fkey') THEN
    ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_inventario_id_negocio_fkey FOREIGN KEY (id_negocio) REFERENCES public.negocio(id_negocio) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';