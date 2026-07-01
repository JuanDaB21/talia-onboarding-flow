CREATE OR REPLACE FUNCTION public.reasignar_mesas_de_mesero(p_mesero uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_mesa record;
  v_nuevo uuid;
  v_count int := 0;
BEGIN
  SELECT id_negocio INTO v_negocio FROM usuarios_staff WHERE id_usuario = p_mesero;
  IF v_negocio IS NULL THEN RETURN 0; END IF;

  FOR v_mesa IN
    SELECT id_mesa FROM mesas
    WHERE id_mesero_asignado = p_mesero AND id_negocio = v_negocio
  LOOP
    SELECT s.id_usuario INTO v_nuevo
    FROM usuarios_staff s
    LEFT JOIN (
      SELECT id_mesero_asignado, COUNT(*) AS carga
      FROM mesas
      WHERE id_negocio = v_negocio
        AND estado = 'OCUPADA'
        AND id_mesero_asignado IS NOT NULL
        AND id_mesero_asignado <> p_mesero
      GROUP BY id_mesero_asignado
    ) c ON c.id_mesero_asignado = s.id_usuario
    WHERE s.id_negocio = v_negocio
      AND s.rol = 'MESERO'
      AND s.estado = 'ACTIVO'
      AND s.esta_en_turno = true
      AND s.id_usuario <> p_mesero
    ORDER BY COALESCE(c.carga, 0) ASC, s.created_at ASC
    LIMIT 1;

    UPDATE mesas
    SET id_mesero_asignado = v_nuevo,
        asignada_at = CASE WHEN v_nuevo IS NOT NULL THEN now() ELSE asignada_at END
    WHERE id_mesa = v_mesa.id_mesa;

    UPDATE pedidos
    SET id_mesero = v_nuevo
    WHERE id_mesa = v_mesa.id_mesa
      AND estado = 'ABIERTO'
      AND id_mesero = p_mesero;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reasignar_mesas_de_mesero(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reasignar_mesas_de_mesero(uuid) TO service_role;