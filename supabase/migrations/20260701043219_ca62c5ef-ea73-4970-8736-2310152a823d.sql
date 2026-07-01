ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS id_metodo_pago_qr uuid NULL
  REFERENCES public.metodos_pago_qr(id_qr) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reservas_id_metodo_pago_qr_idx
  ON public.reservas(id_metodo_pago_qr);