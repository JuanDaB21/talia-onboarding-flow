ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_id_mesa_fkey FOREIGN KEY (id_mesa) REFERENCES public.mesas(id_mesa) ON DELETE RESTRICT;