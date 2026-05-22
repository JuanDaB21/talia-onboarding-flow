ALTER TYPE rol_staff ADD VALUE IF NOT EXISTS 'BARRA';

CREATE POLICY staff_delete_own_negocio ON public.usuarios_staff
  FOR DELETE TO authenticated
  USING (id_negocio = current_user_negocio() AND rol <> 'SUPERADMIN');

DROP POLICY IF EXISTS staff_insert_own_negocio ON public.usuarios_staff;
CREATE POLICY staff_insert_own_negocio ON public.usuarios_staff
  FOR INSERT TO authenticated
  WITH CHECK (id_negocio = current_user_negocio() AND rol <> 'SUPERADMIN');

DROP POLICY IF EXISTS staff_update_own_negocio ON public.usuarios_staff;
CREATE POLICY staff_update_own_negocio ON public.usuarios_staff
  FOR UPDATE TO authenticated
  USING (id_negocio = current_user_negocio() AND rol <> 'SUPERADMIN')
  WITH CHECK (id_negocio = current_user_negocio() AND rol <> 'SUPERADMIN');