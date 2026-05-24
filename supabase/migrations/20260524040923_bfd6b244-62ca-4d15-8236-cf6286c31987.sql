
ALTER TABLE public.negocio
  ADD COLUMN IF NOT EXISTS tema_menu text NOT NULL DEFAULT 'verde-bosque';

INSERT INTO storage.buckets (id, name, public)
VALUES ('negocio-logos', 'negocio-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "negocio_logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'negocio-logos');

CREATE POLICY "negocio_logos_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'negocio-logos'
  AND (storage.foldername(name))[1] = public.current_user_negocio()::text
);

CREATE POLICY "negocio_logos_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'negocio-logos'
  AND (storage.foldername(name))[1] = public.current_user_negocio()::text
);

CREATE POLICY "negocio_logos_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'negocio-logos'
  AND (storage.foldername(name))[1] = public.current_user_negocio()::text
);
