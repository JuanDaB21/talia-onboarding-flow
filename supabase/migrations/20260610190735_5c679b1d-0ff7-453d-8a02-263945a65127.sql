
-- 1) Quitar lectura pública de prepedido_*
DROP POLICY IF EXISTS "lectura publica prepedido_items" ON public.prepedido_items;
DROP POLICY IF EXISTS "lectura publica prepedido_sesiones" ON public.prepedido_sesiones;
REVOKE SELECT ON public.prepedido_items FROM anon, authenticated;
REVOKE SELECT ON public.prepedido_sesiones FROM anon, authenticated;

-- Staff del negocio (autenticados) sí debe poder leer para la vista del mesero
CREATE POLICY "staff_select_prepedido_items"
  ON public.prepedido_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_items.id_mesa
        AND m.id_negocio = public.current_user_negocio()
    )
  );

CREATE POLICY "staff_select_prepedido_sesiones"
  ON public.prepedido_sesiones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mesas m
      WHERE m.id_mesa = prepedido_sesiones.id_mesa
        AND m.id_negocio = public.current_user_negocio()
    )
  );

GRANT SELECT ON public.prepedido_items TO authenticated;
GRANT SELECT ON public.prepedido_sesiones TO authenticated;

-- 2) Bloquear escalamiento de privilegios entre staff
CREATE OR REPLACE FUNCTION public.prevent_staff_self_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
BEGIN
  -- No tocarse a sí mismo en campos sensibles
  IF auth.uid() = OLD.id_usuario AND auth.uid() = NEW.id_usuario THEN
    IF NEW.rol IS DISTINCT FROM OLD.rol
       OR NEW.id_negocio IS DISTINCT FROM OLD.id_negocio
       OR NEW.id_usuario IS DISTINCT FROM OLD.id_usuario
       OR NEW.correo IS DISTINCT FROM OLD.correo
       OR NEW.estado IS DISTINCT FROM OLD.estado THEN
      RAISE EXCEPTION 'No puedes modificar tu propio rol, negocio, correo o estado'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Solo admins pueden cambiar rol/correo/estado de OTROS staff
  IF auth.uid() <> OLD.id_usuario THEN
    IF NEW.rol IS DISTINCT FROM OLD.rol
       OR NEW.correo IS DISTINCT FROM OLD.correo
       OR NEW.estado IS DISTINCT FROM OLD.estado
       OR NEW.id_negocio IS DISTINCT FROM OLD.id_negocio THEN
      v_is_admin := public.is_admin_actual();
      IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Solo administradores pueden modificar rol, correo o estado de otros usuarios'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
