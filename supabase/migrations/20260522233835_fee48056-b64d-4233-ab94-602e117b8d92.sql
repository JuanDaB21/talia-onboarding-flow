
-- 1) Fix privilege escalation: replace staff_update_self with a column-scoped policy
DROP POLICY IF EXISTS staff_update_self ON public.usuarios_staff;

CREATE OR REPLACE FUNCTION public.prevent_staff_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_staff_self_escalation ON public.usuarios_staff;
CREATE TRIGGER trg_prevent_staff_self_escalation
BEFORE UPDATE ON public.usuarios_staff
FOR EACH ROW EXECUTE FUNCTION public.prevent_staff_self_escalation();

-- Recreate a narrowly-scoped self-update policy (only own row; trigger blocks sensitive cols)
CREATE POLICY staff_update_self_safe
ON public.usuarios_staff
FOR UPDATE
TO authenticated
USING (id_usuario = auth.uid())
WITH CHECK (id_usuario = auth.uid());

-- 2) Harden current_user_negocio against multi-row case
CREATE OR REPLACE FUNCTION public.current_user_negocio()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_negocio
  FROM public.usuarios_staff
  WHERE id_usuario = auth.uid()
  LIMIT 1
$$;

-- 3) Restrict public bucket listing while keeping object reads public
DROP POLICY IF EXISTS "Producto imagenes publicas" ON storage.objects;
DROP POLICY IF EXISTS "producto_imagenes_public_read" ON storage.objects;
DROP POLICY IF EXISTS "producto_imagenes_public_select" ON storage.objects;

-- Allow read of a specific known object path (no listing of bucket contents)
CREATE POLICY "producto_imagenes_public_read_object"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'producto-imagenes'
  AND (current_setting('request.method', true) IS DISTINCT FROM 'LIST')
);

-- 4) Revoke EXECUTE on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.current_user_negocio() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ajustar_stock_manual(uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crear_receta(uuid, uuid, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.actualizar_receta(uuid, uuid, uuid, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.eliminar_receta(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicar_receta(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.guardar_extras_producto(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_compra(uuid, text, text, date, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_negocio_y_admin(uuid, text, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crear_inventario_para_insumo() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_staff_self_escalation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
