
ALTER TABLE public.compras
  ADD CONSTRAINT compras_id_proveedor_fkey
  FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id_proveedor) ON DELETE RESTRICT;

ALTER TABLE public.compras
  ADD CONSTRAINT compras_id_negocio_fkey
  FOREIGN KEY (id_negocio) REFERENCES public.negocio(id_negocio) ON DELETE CASCADE;

ALTER TABLE public.detalle_compra
  ADD CONSTRAINT detalle_compra_id_insumo_fkey
  FOREIGN KEY (id_insumo) REFERENCES public.insumos(id_insumo) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_compras_id_proveedor ON public.compras(id_proveedor);
CREATE INDEX IF NOT EXISTS idx_compras_id_negocio_fecha ON public.compras(id_negocio, fecha_compra DESC);
CREATE INDEX IF NOT EXISTS idx_detalle_compra_id_insumo ON public.detalle_compra(id_insumo);
