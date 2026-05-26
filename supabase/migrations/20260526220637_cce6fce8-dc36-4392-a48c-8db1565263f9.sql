
-- 1) Fix staff_update policy: restrict to authenticated role
DROP POLICY IF EXISTS staff_update_own_negocio ON public.usuarios_staff;
CREATE POLICY staff_update_own_negocio
ON public.usuarios_staff
FOR UPDATE
TO authenticated
USING (
  (id_negocio = current_user_negocio())
  AND (rol <> 'SUPERADMIN'::rol_staff)
  AND (id_usuario <> auth.uid())
)
WITH CHECK (
  (id_negocio = current_user_negocio())
  AND (rol <> 'SUPERADMIN'::rol_staff)
  AND (id_usuario <> auth.uid())
);

-- 2) current_user_negocio: require ACTIVO
CREATE OR REPLACE FUNCTION public.current_user_negocio()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id_negocio
  FROM public.usuarios_staff
  WHERE id_usuario = auth.uid()
    AND estado = 'ACTIVO'
  LIMIT 1
$function$;

-- 3) Revoke EXECUTE from anon on SECURITY DEFINER functions in public schema.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname <> 'registrar_negocio_y_admin'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public;', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role;', r.proname, r.args);
  END LOOP;
END $$;
