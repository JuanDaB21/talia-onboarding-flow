
-- 1) Restrict public listing on negocio-logos bucket (allow reads of known URLs only)
DROP POLICY IF EXISTS negocio_logos_public_read ON storage.objects;
CREATE POLICY negocio_logos_public_read ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'negocio-logos'
    AND current_setting('request.method', true) IS DISTINCT FROM 'LIST'
  );

-- 2) Prevent staff from updating their own row via direct client UPDATE
DROP POLICY IF EXISTS staff_update_own_negocio ON public.usuarios_staff;
CREATE POLICY staff_update_own_negocio ON public.usuarios_staff
  FOR UPDATE
  USING (
    id_negocio = current_user_negocio()
    AND rol <> 'SUPERADMIN'::rol_staff
    AND id_usuario <> auth.uid()
  )
  WITH CHECK (
    id_negocio = current_user_negocio()
    AND rol <> 'SUPERADMIN'::rol_staff
    AND id_usuario <> auth.uid()
  );

-- 3) Lock down realtime.messages (broadcast/presence). postgres_changes is unaffected.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS realtime_messages_deny_all ON realtime.messages;
CREATE POLICY realtime_messages_deny_all ON realtime.messages
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
