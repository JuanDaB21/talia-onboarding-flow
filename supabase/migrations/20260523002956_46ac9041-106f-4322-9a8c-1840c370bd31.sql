ALTER TABLE public.pedido_items
  ADD CONSTRAINT pedido_items_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto) ON DELETE RESTRICT;

ALTER TABLE public.pedido_item_extras
  ADD CONSTRAINT pedido_item_extras_id_insumo_extra_fkey FOREIGN KEY (id_insumo_extra) REFERENCES public.insumos(id_insumo) ON DELETE RESTRICT;

ALTER TABLE public.pedido_item_exclusiones
  ADD CONSTRAINT pedido_item_exclusiones_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES public.insumos(id_insumo) ON DELETE RESTRICT;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_id_mesero_fkey FOREIGN KEY (id_mesero) REFERENCES public.usuarios_staff(id_usuario) ON DELETE SET NULL,
  ADD CONSTRAINT pedidos_id_negocio_fkey FOREIGN KEY (id_negocio) REFERENCES public.negocio(id_negocio) ON DELETE RESTRICT;

ALTER TABLE public.mesas
  ADD CONSTRAINT mesas_id_negocio_fkey FOREIGN KEY (id_negocio) REFERENCES public.negocio(id_negocio) ON DELETE RESTRICT,
  ADD CONSTRAINT mesas_id_mesero_asignado_fkey FOREIGN KEY (id_mesero_asignado) REFERENCES public.usuarios_staff(id_usuario) ON DELETE SET NULL;