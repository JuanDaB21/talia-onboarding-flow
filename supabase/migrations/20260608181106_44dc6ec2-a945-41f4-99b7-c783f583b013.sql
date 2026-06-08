
-- Tabla métodos pago QR
CREATE TABLE public.metodos_pago_qr (
  id_qr uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  plataforma text NOT NULL CHECK (plataforma IN ('Nequi','Daviplata','Bancolombia','Otra')),
  etiqueta text,
  url_qr text NOT NULL,
  titular text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX metodos_pago_qr_unq
  ON public.metodos_pago_qr (id_negocio, plataforma, COALESCE(etiqueta, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metodos_pago_qr TO authenticated;
GRANT ALL ON public.metodos_pago_qr TO service_role;

ALTER TABLE public.metodos_pago_qr ENABLE ROW LEVEL SECURITY;

-- Cualquier staff del negocio puede ver
CREATE POLICY "qr_select_staff" ON public.metodos_pago_qr
  FOR SELECT TO authenticated
  USING (id_negocio = public.current_user_negocio());

-- Solo admin puede modificar
CREATE POLICY "qr_modify_admin" ON public.metodos_pago_qr
  FOR ALL TO authenticated
  USING (id_negocio = public.current_user_negocio() AND public.is_admin_actual())
  WITH CHECK (id_negocio = public.current_user_negocio() AND public.is_admin_actual());

CREATE TRIGGER metodos_pago_qr_touch
  BEFORE UPDATE ON public.metodos_pago_qr
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies para bucket qr-metodos-pago
-- path: {id_negocio}/...
CREATE POLICY "qr_storage_select_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'qr-metodos-pago'
    AND (storage.foldername(name))[1] = public.current_user_negocio()::text
  );

CREATE POLICY "qr_storage_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'qr-metodos-pago'
    AND (storage.foldername(name))[1] = public.current_user_negocio()::text
    AND public.is_admin_actual()
  );

CREATE POLICY "qr_storage_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'qr-metodos-pago'
    AND (storage.foldername(name))[1] = public.current_user_negocio()::text
    AND public.is_admin_actual()
  );

CREATE POLICY "qr_storage_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'qr-metodos-pago'
    AND (storage.foldername(name))[1] = public.current_user_negocio()::text
    AND public.is_admin_actual()
  );
