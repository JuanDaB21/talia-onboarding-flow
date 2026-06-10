-- Restrict negocio UPDATE to admins
DROP POLICY IF EXISTS negocio_update_own ON public.negocio;
CREATE POLICY negocio_update_own ON public.negocio
  FOR UPDATE
  USING (id_negocio = current_user_negocio() AND public.is_admin_actual())
  WITH CHECK (id_negocio = current_user_negocio() AND public.is_admin_actual());

-- Restrict staff UPDATE to admins (in addition to trigger defense-in-depth)
DROP POLICY IF EXISTS staff_update_own_negocio ON public.usuarios_staff;
CREATE POLICY staff_update_own_negocio ON public.usuarios_staff
  FOR UPDATE
  USING (
    id_negocio = current_user_negocio()
    AND rol <> 'SUPERADMIN'::rol_staff
    AND id_usuario <> auth.uid()
    AND public.is_admin_actual()
  )
  WITH CHECK (
    id_negocio = current_user_negocio()
    AND rol <> 'SUPERADMIN'::rol_staff
    AND id_usuario <> auth.uid()
    AND public.is_admin_actual()
  );