
-- ============================================================
-- CAJA DIA: apertura, cierre y conciliación
-- ============================================================

CREATE TABLE IF NOT EXISTS public.caja_dia (
  id_caja uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado text NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA','CERRADA')),
  base_inicial numeric NOT NULL DEFAULT 0,
  abierta_por uuid NOT NULL,
  abierta_at timestamptz NOT NULL DEFAULT now(),
  cerrada_por uuid,
  cerrada_at timestamptz,
  efectivo_sistema numeric NOT NULL DEFAULT 0,
  transferencia_sistema numeric NOT NULL DEFAULT 0,
  datafono_sistema numeric NOT NULL DEFAULT 0,
  efectivo_fisico numeric NOT NULL DEFAULT 0,
  datafono_fisico numeric NOT NULL DEFAULT 0,
  diferencia_efectivo numeric NOT NULL DEFAULT 0,
  diferencia_datafono numeric NOT NULL DEFAULT 0,
  nota_cuadre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_negocio, fecha)
);

ALTER TABLE public.caja_dia ENABLE ROW LEVEL SECURITY;

CREATE POLICY caja_dia_select_own ON public.caja_dia
  FOR SELECT TO authenticated
  USING (id_negocio = public.current_user_negocio());

-- Inserciones y cambios se hacen vía RPC SECURITY DEFINER, no se exponen
CREATE POLICY caja_dia_no_direct_write ON public.caja_dia
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_caja_dia_negocio_fecha ON public.caja_dia (id_negocio, fecha DESC);

-- ============================================================
-- Helper: verificar rol ADMIN del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_actual()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_staff
    WHERE id_usuario = auth.uid()
      AND rol IN ('ADMIN','SUPERADMIN')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_actual() TO authenticated;

-- ============================================================
-- RPC abrir_caja
-- ============================================================
CREATE OR REPLACE FUNCTION public.abrir_caja(p_base numeric)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_id uuid;
BEGIN
  IF NOT public.is_admin_actual() THEN
    RAISE EXCEPTION 'Solo administradores pueden abrir la caja';
  END IF;
  v_negocio := public.current_user_negocio();
  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'No tienes negocio asignado';
  END IF;
  IF p_base IS NULL OR p_base < 0 THEN
    RAISE EXCEPTION 'Base inicial inválida';
  END IF;

  IF EXISTS (SELECT 1 FROM caja_dia WHERE id_negocio = v_negocio AND fecha = CURRENT_DATE) THEN
    RAISE EXCEPTION 'Ya existe una caja para hoy';
  END IF;

  INSERT INTO caja_dia (id_negocio, base_inicial, abierta_por)
  VALUES (v_negocio, p_base, auth.uid())
  RETURNING id_caja INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.abrir_caja(numeric) TO authenticated;

-- ============================================================
-- RPC resumen_caja_dia
-- ============================================================
CREATE OR REPLACE FUNCTION public.resumen_caja_dia()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_caja caja_dia;
  v_desde timestamptz;
  v_hasta timestamptz;
  v_efectivo numeric := 0;
  v_transf_conf numeric := 0;
  v_transf_pend numeric := 0;
  v_datafono numeric := 0;
  v_pend_count int := 0;
  v_mesas_abiertas int := 0;
  v_efectivo_meseros jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin_actual() THEN
    RAISE EXCEPTION 'Solo administradores';
  END IF;
  v_negocio := public.current_user_negocio();

  SELECT * INTO v_caja FROM caja_dia
   WHERE id_negocio = v_negocio AND fecha = CURRENT_DATE;

  IF v_caja.id_caja IS NULL THEN
    RETURN jsonb_build_object('caja', null);
  END IF;

  v_desde := date_trunc('day', now());
  v_hasta := v_desde + interval '1 day';

  SELECT
    COALESCE(SUM(monto) FILTER (WHERE metodo='EFECTIVO' AND estado_confirmacion='CONFIRMADO'),0),
    COALESCE(SUM(monto) FILTER (WHERE metodo='TRANSFERENCIA' AND estado_confirmacion='CONFIRMADO'),0),
    COALESCE(SUM(monto) FILTER (WHERE metodo='TRANSFERENCIA' AND estado_confirmacion='PENDIENTE'),0),
    COALESCE(SUM(monto) FILTER (WHERE metodo='DATAFONO' AND estado_confirmacion='CONFIRMADO'),0),
    COUNT(*) FILTER (WHERE estado_confirmacion='PENDIENTE')
  INTO v_efectivo, v_transf_conf, v_transf_pend, v_datafono, v_pend_count
  FROM pagos
  WHERE id_negocio = v_negocio
    AND created_at >= v_desde AND created_at < v_hasta;

  SELECT COUNT(*) INTO v_mesas_abiertas
  FROM mesas WHERE id_negocio = v_negocio AND estado <> 'LIBRE';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id_mesero', x.id_mesero,
    'nombre', x.nombre,
    'monto', x.monto
  ) ORDER BY x.monto DESC), '[]'::jsonb)
  INTO v_efectivo_meseros
  FROM (
    SELECT p.id_mesero, COALESCE(u.nombre, '—') AS nombre, SUM(p.monto)::numeric AS monto
    FROM pagos p
    LEFT JOIN usuarios_staff u ON u.id_usuario = p.id_mesero
    WHERE p.id_negocio = v_negocio
      AND p.metodo = 'EFECTIVO'
      AND p.estado_confirmacion = 'CONFIRMADO'
      AND p.created_at >= v_desde AND p.created_at < v_hasta
    GROUP BY p.id_mesero, u.nombre
  ) x;

  RETURN jsonb_build_object(
    'caja', jsonb_build_object(
      'id_caja', v_caja.id_caja,
      'fecha', v_caja.fecha,
      'estado', v_caja.estado,
      'base_inicial', v_caja.base_inicial,
      'abierta_at', v_caja.abierta_at,
      'cerrada_at', v_caja.cerrada_at
    ),
    'efectivo', v_efectivo,
    'transferencia_confirmada', v_transf_conf,
    'transferencia_pendiente', v_transf_pend,
    'datafono', v_datafono,
    'total_sistema', v_efectivo + v_transf_conf + v_datafono,
    'pagos_pendientes', v_pend_count,
    'mesas_abiertas', v_mesas_abiertas,
    'efectivo_por_mesero', v_efectivo_meseros
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.resumen_caja_dia() TO authenticated;

-- ============================================================
-- RPC cerrar_caja
-- ============================================================
CREATE OR REPLACE FUNCTION public.cerrar_caja(
  p_efectivo_fisico numeric,
  p_datafono_fisico numeric,
  p_nota text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_caja caja_dia;
  v_desde timestamptz;
  v_hasta timestamptz;
  v_efectivo numeric := 0;
  v_transf numeric := 0;
  v_datafono numeric := 0;
  v_pend_count int := 0;
  v_mesas_abiertas int := 0;
  v_dif_efectivo numeric;
  v_dif_datafono numeric;
BEGIN
  IF NOT public.is_admin_actual() THEN
    RAISE EXCEPTION 'Solo administradores pueden cerrar la caja';
  END IF;
  v_negocio := public.current_user_negocio();

  SELECT * INTO v_caja FROM caja_dia
   WHERE id_negocio = v_negocio AND fecha = CURRENT_DATE
   FOR UPDATE;
  IF v_caja.id_caja IS NULL THEN
    RAISE EXCEPTION 'No hay caja abierta para hoy';
  END IF;
  IF v_caja.estado = 'CERRADA' THEN
    RAISE EXCEPTION 'La caja ya está cerrada';
  END IF;

  v_desde := date_trunc('day', now());
  v_hasta := v_desde + interval '1 day';

  SELECT COUNT(*) INTO v_pend_count
  FROM pagos WHERE id_negocio = v_negocio AND estado_confirmacion = 'PENDIENTE';
  IF v_pend_count > 0 THEN
    RAISE EXCEPTION 'Aún hay % pago(s) por verificar', v_pend_count;
  END IF;

  SELECT COUNT(*) INTO v_mesas_abiertas
  FROM mesas WHERE id_negocio = v_negocio AND estado <> 'LIBRE';
  IF v_mesas_abiertas > 0 THEN
    RAISE EXCEPTION 'Aún hay % mesa(s) con cuenta abierta', v_mesas_abiertas;
  END IF;

  SELECT
    COALESCE(SUM(monto) FILTER (WHERE metodo='EFECTIVO'),0),
    COALESCE(SUM(monto) FILTER (WHERE metodo='TRANSFERENCIA'),0),
    COALESCE(SUM(monto) FILTER (WHERE metodo='DATAFONO'),0)
  INTO v_efectivo, v_transf, v_datafono
  FROM pagos
  WHERE id_negocio = v_negocio
    AND estado_confirmacion = 'CONFIRMADO'
    AND created_at >= v_desde AND created_at < v_hasta;

  -- El efectivo físico debe igualar (base + efectivo cobrado)
  v_dif_efectivo := p_efectivo_fisico - (v_caja.base_inicial + v_efectivo);
  v_dif_datafono := p_datafono_fisico - v_datafono;

  IF (v_dif_efectivo <> 0 OR v_dif_datafono <> 0)
     AND (p_nota IS NULL OR length(trim(p_nota)) = 0) THEN
    RAISE EXCEPTION 'Hay diferencias en el cuadre. Ingresa una nota explicando.';
  END IF;

  UPDATE caja_dia SET
    estado = 'CERRADA',
    cerrada_por = auth.uid(),
    cerrada_at = now(),
    efectivo_sistema = v_efectivo,
    transferencia_sistema = v_transf,
    datafono_sistema = v_datafono,
    efectivo_fisico = p_efectivo_fisico,
    datafono_fisico = p_datafono_fisico,
    diferencia_efectivo = v_dif_efectivo,
    diferencia_datafono = v_dif_datafono,
    nota_cuadre = NULLIF(trim(coalesce(p_nota,'')), '')
  WHERE id_caja = v_caja.id_caja;

  -- Auto-cierre de turnos olvidados
  UPDATE usuarios_staff
     SET esta_en_turno = false, turno_iniciado_at = null
   WHERE id_negocio = v_negocio AND esta_en_turno = true;

  RETURN v_caja.id_caja;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cerrar_caja(numeric, numeric, text) TO authenticated;

-- ============================================================
-- Índices para KPIs y alertas
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pagos_negocio_created ON public.pagos (id_negocio, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedido_items_estado_prep ON public.pedido_items (estado_preparacion, iniciado_at);
