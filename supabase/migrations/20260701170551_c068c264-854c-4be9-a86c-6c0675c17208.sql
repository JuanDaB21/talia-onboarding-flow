
-- 1) usuarios_staff: solo admin puede DELETE
DROP POLICY IF EXISTS staff_delete_own_negocio ON public.usuarios_staff;
CREATE POLICY staff_delete_own_negocio ON public.usuarios_staff
  FOR DELETE TO authenticated
  USING (
    id_negocio = current_user_negocio()
    AND rol <> 'SUPERADMIN'::rol_staff
    AND id_usuario <> auth.uid()
    AND public.is_admin_actual()
  );

-- 2) usuarios_staff: solo admin puede INSERT
DROP POLICY IF EXISTS staff_insert_own_negocio ON public.usuarios_staff;
CREATE POLICY staff_insert_own_negocio ON public.usuarios_staff
  FOR INSERT TO authenticated
  WITH CHECK (
    id_negocio = current_user_negocio()
    AND rol <> 'SUPERADMIN'::rol_staff
    AND public.is_admin_actual()
  );

-- 3) bono_aplicaciones: políticas de escritura restringidas a admin
CREATE POLICY bono_apl_insert_admin ON public.bono_aplicaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    id_negocio = current_user_negocio()
    AND public.is_admin_actual()
  );
CREATE POLICY bono_apl_update_admin ON public.bono_aplicaciones
  FOR UPDATE TO authenticated
  USING (id_negocio = current_user_negocio() AND public.is_admin_actual())
  WITH CHECK (id_negocio = current_user_negocio() AND public.is_admin_actual());
CREATE POLICY bono_apl_delete_admin ON public.bono_aplicaciones
  FOR DELETE TO authenticated
  USING (id_negocio = current_user_negocio() AND public.is_admin_actual());

-- 4) caja_ajuste_tipos: DELETE para admin/cajero
CREATE POLICY tipos_delete_admin_cajero ON public.caja_ajuste_tipos
  FOR DELETE TO authenticated
  USING (
    id_negocio = current_user_negocio()
    AND EXISTS (
      SELECT 1 FROM public.usuarios_staff u
      WHERE u.id_usuario = auth.uid()
        AND u.rol = ANY (ARRAY['ADMIN'::rol_staff, 'SUPERADMIN'::rol_staff, 'CAJERO'::rol_staff])
    )
  );

-- 5) prepedido_items: escritura para staff del mismo negocio
CREATE POLICY staff_insert_prepedido_items ON public.prepedido_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_items.id_mesa AND m.id_negocio = current_user_negocio())
  );
CREATE POLICY staff_update_prepedido_items ON public.prepedido_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_items.id_mesa AND m.id_negocio = current_user_negocio())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_items.id_mesa AND m.id_negocio = current_user_negocio())
  );
CREATE POLICY staff_delete_prepedido_items ON public.prepedido_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_items.id_mesa AND m.id_negocio = current_user_negocio())
  );

-- 6) prepedido_sesiones: mismo esquema
CREATE POLICY staff_insert_prepedido_sesiones ON public.prepedido_sesiones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_sesiones.id_mesa AND m.id_negocio = current_user_negocio())
  );
CREATE POLICY staff_update_prepedido_sesiones ON public.prepedido_sesiones
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_sesiones.id_mesa AND m.id_negocio = current_user_negocio())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_sesiones.id_mesa AND m.id_negocio = current_user_negocio())
  );
CREATE POLICY staff_delete_prepedido_sesiones ON public.prepedido_sesiones
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_sesiones.id_mesa AND m.id_negocio = current_user_negocio())
  );

-- 7) turnos_staff: escritura del propio usuario, admin puede todo
CREATE POLICY turnos_insert_self_or_admin ON public.turnos_staff
  FOR INSERT TO authenticated
  WITH CHECK (
    id_negocio = current_user_negocio()
    AND (id_usuario = auth.uid() OR public.is_admin_actual())
  );
CREATE POLICY turnos_update_self_or_admin ON public.turnos_staff
  FOR UPDATE TO authenticated
  USING (
    id_negocio = current_user_negocio()
    AND (id_usuario = auth.uid() OR public.is_admin_actual())
  )
  WITH CHECK (
    id_negocio = current_user_negocio()
    AND (id_usuario = auth.uid() OR public.is_admin_actual())
  );
CREATE POLICY turnos_delete_admin ON public.turnos_staff
  FOR DELETE TO authenticated
  USING (
    id_negocio = current_user_negocio()
    AND public.is_admin_actual()
  );
