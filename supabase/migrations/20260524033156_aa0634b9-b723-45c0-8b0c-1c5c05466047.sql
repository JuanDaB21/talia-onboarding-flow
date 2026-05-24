-- 1. Remove broad self-update policy that allowed privilege escalation
DROP POLICY IF EXISTS staff_update_self_safe ON public.usuarios_staff;

-- 2. Storage: add UPDATE and DELETE policies for comprobantes-pago, scoped to caller's negocio
DROP POLICY IF EXISTS comprobantes_staff_update ON storage.objects;
CREATE POLICY comprobantes_staff_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'comprobantes-pago'
    AND (storage.foldername(name))[1] = (public.current_user_negocio())::text
  )
  WITH CHECK (
    bucket_id = 'comprobantes-pago'
    AND (storage.foldername(name))[1] = (public.current_user_negocio())::text
  );

DROP POLICY IF EXISTS comprobantes_staff_delete ON storage.objects;
CREATE POLICY comprobantes_staff_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'comprobantes-pago'
    AND (storage.foldername(name))[1] = (public.current_user_negocio())::text
  );

-- 3. Revoke EXECUTE on all SECURITY DEFINER functions from anon and PUBLIC
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                   f.nspname, f.proname, f.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                   f.nspname, f.proname, f.args);
  END LOOP;
END $$;