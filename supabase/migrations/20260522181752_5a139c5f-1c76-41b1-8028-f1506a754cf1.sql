-- Bucket público para imágenes de productos
INSERT INTO storage.buckets (id, name, public)
VALUES ('producto-imagenes', 'producto-imagenes', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública
CREATE POLICY "producto_imagenes_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'producto-imagenes');

-- INSERT/UPDATE/DELETE solo para usuarios autenticados cuyo negocio coincida con la primera carpeta del path
CREATE POLICY "producto_imagenes_insert_own_negocio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'producto-imagenes'
  AND (storage.foldername(name))[1] = public.current_user_negocio()::text
);

CREATE POLICY "producto_imagenes_update_own_negocio"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'producto-imagenes'
  AND (storage.foldername(name))[1] = public.current_user_negocio()::text
)
WITH CHECK (
  bucket_id = 'producto-imagenes'
  AND (storage.foldername(name))[1] = public.current_user_negocio()::text
);

CREATE POLICY "producto_imagenes_delete_own_negocio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'producto-imagenes'
  AND (storage.foldername(name))[1] = public.current_user_negocio()::text
);