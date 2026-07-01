
CREATE OR REPLACE FUNCTION public.set_categoria_destino(
  p_id_categoria uuid,
  p_destino text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_rol rol_staff;
  v_destino text;
  v_id_espacio uuid;
  v_updated_items integer := 0;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  SELECT rol INTO v_rol FROM usuarios_staff WHERE id_usuario = auth.uid();
  IF v_rol NOT IN ('ADMIN','SUPERADMIN') THEN
    RAISE EXCEPTION 'Solo administradores pueden mover categorías' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM categorias WHERE id_categoria = p_id_categoria AND id_negocio = v_negocio
  ) THEN
    RAISE EXCEPTION 'Categoría no encontrada' USING ERRCODE='42704';
  END IF;

  v_destino := upper(coalesce(trim(p_destino), ''));
  IF v_destino = '' THEN
    RAISE EXCEPTION 'Espacio de trabajo requerido' USING ERRCODE='23514';
  END IF;

  SELECT id_espacio INTO v_id_espacio
  FROM espacios_trabajo
  WHERE id_negocio = v_negocio AND slug = v_destino AND activo = true;
  IF v_id_espacio IS NULL THEN
    RAISE EXCEPTION 'Espacio de trabajo inválido o inactivo: %', v_destino USING ERRCODE='23514';
  END IF;

  UPDATE categorias SET destino = v_destino WHERE id_categoria = p_id_categoria;

  WITH upd AS (
    UPDATE pedido_items pi
       SET destino = v_destino
      FROM productos p
      JOIN receta_master rm ON rm.id_receta = p.id_receta
     WHERE pi.id_producto = p.id_producto
       AND rm.id_categoria = p_id_categoria
       AND pi.estado_preparacion = 'EN_COLA'
       AND pi.iniciado_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_updated_items FROM upd;

  RETURN jsonb_build_object(
    'ok', true,
    'destino', v_destino,
    'updated_items', v_updated_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_categoria_destino(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_categoria_destino(uuid, text) TO authenticated;

-- Reparación: destinos huérfanos → primer espacio activo del negocio
DO $repair$
DECLARE
  r record;
  v_new_slug text;
  v_moved_cats integer;
  v_moved_items integer;
BEGIN
  FOR r IN
    SELECT DISTINCT c.id_negocio
      FROM categorias c
     WHERE c.destino IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM espacios_trabajo e
           WHERE e.id_negocio = c.id_negocio
             AND e.slug = upper(c.destino)
             AND e.activo = true
        )
  LOOP
    SELECT slug INTO v_new_slug
      FROM espacios_trabajo
     WHERE id_negocio = r.id_negocio AND activo = true
     ORDER BY orden, nombre
     LIMIT 1;
    IF v_new_slug IS NULL THEN CONTINUE; END IF;

    WITH upd AS (
      UPDATE categorias c
         SET destino = v_new_slug
       WHERE c.id_negocio = r.id_negocio
         AND (c.destino IS NULL
              OR NOT EXISTS (
                SELECT 1 FROM espacios_trabajo e
                 WHERE e.id_negocio = c.id_negocio
                   AND e.slug = upper(c.destino)
                   AND e.activo = true
              ))
      RETURNING 1
    )
    SELECT count(*) INTO v_moved_cats FROM upd;
    RAISE NOTICE 'Negocio %: reasignadas % categorías huérfanas a %', r.id_negocio, v_moved_cats, v_new_slug;
  END LOOP;

  -- pedido_items EN_COLA con destino huérfano → destino actual de su categoría
  WITH target AS (
    SELECT pi.id_item, c.destino AS nuevo_destino
      FROM pedido_items pi
      JOIN pedidos pd ON pd.id_pedido = pi.id_pedido
      JOIN productos p ON p.id_producto = pi.id_producto
      JOIN receta_master rm ON rm.id_receta = p.id_receta
      JOIN categorias c ON c.id_categoria = rm.id_categoria
     WHERE pi.estado_preparacion = 'EN_COLA'
       AND pi.iniciado_at IS NULL
       AND (
         pi.destino IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM espacios_trabajo e
            WHERE e.id_negocio = pd.id_negocio
              AND e.slug = upper(pi.destino)
              AND e.activo = true
         )
       )
  ),
  upd AS (
    UPDATE pedido_items pi
       SET destino = t.nuevo_destino
      FROM target t
     WHERE pi.id_item = t.id_item
    RETURNING 1
  )
  SELECT count(*) INTO v_moved_items FROM upd;
  RAISE NOTICE 'Reasignados % pedido_items EN_COLA con destino huérfano', v_moved_items;
END
$repair$;
