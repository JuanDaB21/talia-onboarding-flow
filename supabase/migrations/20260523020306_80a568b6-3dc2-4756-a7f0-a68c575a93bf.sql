
-- 1) Enums
DO $$ BEGIN
  CREATE TYPE metodo_pago AS ENUM ('EFECTIVO','TRANSFERENCIA','DATAFONO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_pago AS ENUM ('CONFIRMADO','PENDIENTE','RECHAZADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE estado_pedido ADD VALUE IF NOT EXISTS 'PARCIAL';

-- 2) pagos
CREATE TABLE IF NOT EXISTS public.pagos (
  id_pago uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL,
  id_mesa uuid NOT NULL,
  id_mesero uuid,
  metodo metodo_pago NOT NULL,
  subtipo text,
  monto numeric NOT NULL CHECK (monto > 0),
  voucher text,
  url_comprobante text,
  estado_confirmacion estado_pago NOT NULL DEFAULT 'CONFIRMADO',
  confirmado_por uuid,
  confirmado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagos_negocio ON public.pagos(id_negocio);
CREATE INDEX IF NOT EXISTS idx_pagos_mesa ON public.pagos(id_mesa);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON public.pagos(estado_confirmacion);

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pagos_all_own ON public.pagos;
CREATE POLICY pagos_all_own ON public.pagos
  FOR ALL TO authenticated
  USING (id_negocio = current_user_negocio())
  WITH CHECK (id_negocio = current_user_negocio());

-- 3) pago_items
CREATE TABLE IF NOT EXISTS public.pago_items (
  id_pi uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pago uuid NOT NULL REFERENCES public.pagos(id_pago) ON DELETE CASCADE,
  id_item uuid NOT NULL UNIQUE,
  monto numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pago_items_pago ON public.pago_items(id_pago);

ALTER TABLE public.pago_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pago_items_all_own ON public.pago_items;
CREATE POLICY pago_items_all_own ON public.pago_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pagos pg WHERE pg.id_pago=pago_items.id_pago AND pg.id_negocio=current_user_negocio()))
  WITH CHECK (EXISTS (SELECT 1 FROM pagos pg WHERE pg.id_pago=pago_items.id_pago AND pg.id_negocio=current_user_negocio()));

-- 4) Columnas en pedido_items
ALTER TABLE public.pedido_items
  ADD COLUMN IF NOT EXISTS pagado_at timestamptz,
  ADD COLUMN IF NOT EXISTS id_pago uuid;

-- 5) RPC registrar_pago
CREATE OR REPLACE FUNCTION public.registrar_pago(
  p_id_mesa uuid,
  p_metodo metodo_pago,
  p_subtipo text,
  p_voucher text,
  p_url_comprobante text,
  p_item_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_uid uuid := auth.uid();
  v_id_pago uuid;
  v_monto numeric := 0;
  v_estado estado_pago;
  v_pendientes integer;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;
  IF p_item_ids IS NULL OR array_length(p_item_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Sin items' USING ERRCODE='23514';
  END IF;
  IF p_metodo = 'TRANSFERENCIA' AND (p_url_comprobante IS NULL OR length(p_url_comprobante)=0) THEN
    RAISE EXCEPTION 'Comprobante requerido' USING ERRCODE='23514';
  END IF;

  -- Validar items: pertenecen al negocio, a la mesa, y no están pagados
  IF EXISTS (
    SELECT 1 FROM unnest(p_item_ids) AS x(id_item)
    WHERE NOT EXISTS (
      SELECT 1 FROM pedido_items i
      JOIN pedidos p ON p.id_pedido=i.id_pedido
      WHERE i.id_item=x.id_item AND p.id_negocio=v_negocio AND p.id_mesa=p_id_mesa AND i.pagado_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Items inválidos o ya pagados' USING ERRCODE='42501';
  END IF;

  -- Calcular monto = sum(cantidad * precio + extras)
  SELECT COALESCE(SUM(
    i.cantidad * i.precio_unitario
    + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item=i.id_item),0)
  ),0)
  INTO v_monto
  FROM pedido_items i
  WHERE i.id_item = ANY(p_item_ids);

  v_estado := CASE WHEN p_metodo='TRANSFERENCIA' THEN 'PENDIENTE'::estado_pago ELSE 'CONFIRMADO'::estado_pago END;

  INSERT INTO pagos (id_negocio, id_mesa, id_mesero, metodo, subtipo, monto, voucher, url_comprobante, estado_confirmacion, confirmado_por, confirmado_at)
  VALUES (v_negocio, p_id_mesa, v_uid, p_metodo, NULLIF(trim(p_subtipo),''), v_monto, NULLIF(trim(p_voucher),''), NULLIF(trim(p_url_comprobante),''), v_estado,
          CASE WHEN v_estado='CONFIRMADO' THEN v_uid ELSE NULL END,
          CASE WHEN v_estado='CONFIRMADO' THEN now() ELSE NULL END)
  RETURNING id_pago INTO v_id_pago;

  INSERT INTO pago_items (id_pago, id_item, monto)
  SELECT v_id_pago, i.id_item,
    i.cantidad * i.precio_unitario + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item=i.id_item),0)
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  UPDATE pedido_items SET pagado_at = now(), id_pago = v_id_pago
   WHERE id_item = ANY(p_item_ids);

  -- Si pago CONFIRMADO y todos los items de la mesa están pagados → cerrar
  IF v_estado = 'CONFIRMADO' THEN
    SELECT count(*) INTO v_pendientes
    FROM pedido_items i JOIN pedidos p ON p.id_pedido=i.id_pedido
    WHERE p.id_mesa=p_id_mesa AND p.id_negocio=v_negocio AND p.estado <> 'PAGADO' AND i.pagado_at IS NULL;

    IF v_pendientes = 0 THEN
      UPDATE pedidos SET estado='PAGADO', pagado_at=now()
       WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado <> 'PAGADO';
      UPDATE mesas SET estado='LIBRE', id_mesero_asignado=NULL, asignada_at=NULL, liberada_at=now(),
                       solicitud_cliente=NULL, solicitud_at=NULL
       WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio;
    ELSE
      UPDATE pedidos SET estado='PARCIAL'
       WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado='CONFIRMADO'
         AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NOT NULL)
         AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NULL);
    END IF;
  END IF;

  RETURN v_id_pago;
END $$;

-- 6) Confirmar/rechazar transferencia (ADMIN)
CREATE OR REPLACE FUNCTION public.confirmar_pago_transferencia(p_id_pago uuid, p_aprobar boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_negocio uuid;
  v_uid uuid := auth.uid();
  v_rol text;
  v_id_mesa uuid;
  v_pendientes integer;
BEGIN
  v_negocio := current_user_negocio();
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT rol::text INTO v_rol FROM usuarios_staff WHERE id_usuario=v_uid AND id_negocio=v_negocio;
  IF v_rol NOT IN ('ADMIN','SUPERADMIN') THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;

  SELECT id_mesa INTO v_id_mesa FROM pagos
   WHERE id_pago=p_id_pago AND id_negocio=v_negocio AND estado_confirmacion='PENDIENTE';
  IF v_id_mesa IS NULL THEN RAISE EXCEPTION 'Pago no encontrado o ya resuelto' USING ERRCODE='P0002'; END IF;

  IF p_aprobar THEN
    UPDATE pagos SET estado_confirmacion='CONFIRMADO', confirmado_por=v_uid, confirmado_at=now()
     WHERE id_pago=p_id_pago;

    -- Verificar si la mesa queda totalmente pagada
    SELECT count(*) INTO v_pendientes
    FROM pedido_items i JOIN pedidos p ON p.id_pedido=i.id_pedido
    WHERE p.id_mesa=v_id_mesa AND p.id_negocio=v_negocio AND p.estado <> 'PAGADO' AND i.pagado_at IS NULL;

    IF v_pendientes = 0 THEN
      UPDATE pedidos SET estado='PAGADO', pagado_at=now()
       WHERE id_mesa=v_id_mesa AND id_negocio=v_negocio AND estado <> 'PAGADO';
      UPDATE mesas SET estado='LIBRE', id_mesero_asignado=NULL, asignada_at=NULL, liberada_at=now(),
                       solicitud_cliente=NULL, solicitud_at=NULL
       WHERE id_mesa=v_id_mesa AND id_negocio=v_negocio;
    END IF;
  ELSE
    -- Rechazar: liberar items para que se vuelvan a cobrar
    UPDATE pedido_items SET pagado_at=NULL, id_pago=NULL
     WHERE id_pago=p_id_pago;
    UPDATE pagos SET estado_confirmacion='RECHAZADO', confirmado_por=v_uid, confirmado_at=now()
     WHERE id_pago=p_id_pago;
  END IF;
END $$;

-- 7) Realtime
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pagos; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 8) Storage bucket privado para comprobantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes-pago','comprobantes-pago', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: staff del negocio puede subir y leer; path debe iniciar con id_negocio
DROP POLICY IF EXISTS comprobantes_staff_select ON storage.objects;
CREATE POLICY comprobantes_staff_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id='comprobantes-pago'
    AND (storage.foldername(name))[1] = current_user_negocio()::text
  );

DROP POLICY IF EXISTS comprobantes_staff_insert ON storage.objects;
CREATE POLICY comprobantes_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id='comprobantes-pago'
    AND (storage.foldername(name))[1] = current_user_negocio()::text
  );
