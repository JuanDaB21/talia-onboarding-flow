
-- 1. Extender enum metodo_pago
ALTER TYPE public.metodo_pago ADD VALUE IF NOT EXISTS 'ABONO_RESERVA';

-- 2. Tabla reservas
CREATE TABLE IF NOT EXISTS public.reservas (
  id_reserva uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_negocio uuid NOT NULL REFERENCES public.negocio(id_negocio) ON DELETE CASCADE,
  codigo_reserva text UNIQUE NOT NULL,
  customer_name text NOT NULL CHECK (length(trim(customer_name)) > 0),
  customer_phone text,
  fecha_reserva date NOT NULL,
  hora_reserva text NOT NULL CHECK (length(trim(hora_reserva)) > 0),
  cantidad_personas integer NOT NULL CHECK (cantidad_personas > 0),
  tipo_reserva text,
  monto_abonado numeric(12,2) NOT NULL DEFAULT 0 CHECK (monto_abonado >= 0),
  estado text NOT NULL DEFAULT 'intencion'
    CHECK (estado IN ('intencion','abonado','cancelada_devuelto','cancelada_retenido','asistida')),
  id_pedido_aplicado uuid REFERENCES public.pedidos(id_pedido) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservas_negocio_fecha_idx ON public.reservas(id_negocio, fecha_reserva);
CREATE INDEX IF NOT EXISTS reservas_estado_idx ON public.reservas(id_negocio, estado);
CREATE INDEX IF NOT EXISTS reservas_codigo_idx ON public.reservas(codigo_reserva);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservas TO authenticated;
GRANT ALL ON public.reservas TO service_role;

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservas_select_own_negocio" ON public.reservas
  FOR SELECT TO authenticated
  USING (id_negocio = public.current_user_negocio());

CREATE POLICY "reservas_insert_own_negocio" ON public.reservas
  FOR INSERT TO authenticated
  WITH CHECK (id_negocio = public.current_user_negocio());

CREATE POLICY "reservas_update_own_negocio" ON public.reservas
  FOR UPDATE TO authenticated
  USING (id_negocio = public.current_user_negocio())
  WITH CHECK (id_negocio = public.current_user_negocio());

CREATE POLICY "reservas_delete_own_negocio" ON public.reservas
  FOR DELETE TO authenticated
  USING (id_negocio = public.current_user_negocio());

CREATE TRIGGER reservas_set_updated_at
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Trigger para generar codigo_reserva TAL-XXXX
CREATE OR REPLACE FUNCTION public.generar_codigo_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_try int := 0;
BEGIN
  IF NEW.codigo_reserva IS NOT NULL AND length(NEW.codigo_reserva) > 0 THEN
    RETURN NEW;
  END IF;
  LOOP
    v_code := 'TAL-' ||
      substr(v_chars, 1+floor(random()*length(v_chars))::int, 1) ||
      substr(v_chars, 1+floor(random()*length(v_chars))::int, 1) ||
      substr(v_chars, 1+floor(random()*length(v_chars))::int, 1) ||
      substr(v_chars, 1+floor(random()*length(v_chars))::int, 1);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.reservas WHERE codigo_reserva = v_code);
    v_try := v_try + 1;
    IF v_try > 20 THEN
      RAISE EXCEPTION 'No se pudo generar código único';
    END IF;
  END LOOP;
  NEW.codigo_reserva := v_code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservas_gen_codigo
  BEFORE INSERT ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.generar_codigo_reserva();

-- 4. RPC: aplicar abono de reserva durante checkout
CREATE OR REPLACE FUNCTION public.pagar_con_abono_reserva(
  p_id_reserva uuid,
  p_id_mesa uuid,
  p_item_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio uuid := current_user_negocio();
  v_uid uuid := auth.uid();
  v_reserva record;
  v_subtotal numeric := 0;
  v_id_pago uuid;
  v_id_pedido uuid;
BEGIN
  IF v_negocio IS NULL THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF p_item_ids IS NULL OR array_length(p_item_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Selecciona al menos un item' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mesas WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio) THEN
    RAISE EXCEPTION 'Mesa inválida' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_reserva FROM public.reservas
   WHERE id_reserva = p_id_reserva AND id_negocio = v_negocio
   FOR UPDATE;
  IF v_reserva.id_reserva IS NULL THEN
    RAISE EXCEPTION 'Reserva no encontrada' USING ERRCODE='P0002';
  END IF;
  IF v_reserva.estado <> 'abonado' THEN
    RAISE EXCEPTION 'La reserva no tiene abono disponible (estado=%)', v_reserva.estado USING ERRCODE='42501';
  END IF;
  IF v_reserva.fecha_reserva <> CURRENT_DATE THEN
    RAISE EXCEPTION 'El abono solo aplica el mismo día de la reserva' USING ERRCODE='42501';
  END IF;

  -- Validar items
  IF EXISTS (
    SELECT 1 FROM unnest(p_item_ids) AS x(id_item)
    WHERE NOT EXISTS (
      SELECT 1 FROM pedido_items i
      JOIN pedidos p ON p.id_pedido=i.id_pedido
      WHERE i.id_item=x.id_item AND p.id_negocio=v_negocio
        AND p.id_mesa=p_id_mesa AND i.pagado_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Items inválidos o ya pagados' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(SUM(
    i.cantidad * i.precio_unitario
    + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item=i.id_item),0)
  ),0)
  INTO v_subtotal
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  IF v_subtotal > v_reserva.monto_abonado THEN
    RAISE EXCEPTION 'El abono ($%) no cubre el total seleccionado ($%). Paga el resto con otro método primero.',
      v_reserva.monto_abonado, v_subtotal USING ERRCODE='42501';
  END IF;

  SELECT id_pedido INTO v_id_pedido FROM pedido_items
   WHERE id_item = p_item_ids[1];

  INSERT INTO pagos (
    id_negocio, id_mesa, id_mesero, metodo, subtipo, monto, propina,
    estado_confirmacion, confirmado_por, confirmado_at
  ) VALUES (
    v_negocio, p_id_mesa, v_uid, 'ABONO_RESERVA',
    'Reserva ' || v_reserva.codigo_reserva,
    v_subtotal, 0, 'CONFIRMADO', v_uid, now()
  ) RETURNING id_pago INTO v_id_pago;

  INSERT INTO pago_items (id_pago, id_item, monto)
  SELECT v_id_pago, i.id_item,
    i.cantidad * i.precio_unitario + COALESCE((SELECT SUM(e.precio_extra) FROM pedido_item_extras e WHERE e.id_item=i.id_item),0)
  FROM pedido_items i WHERE i.id_item = ANY(p_item_ids);

  UPDATE pedido_items SET pagado_at = now(), id_pago = v_id_pago
   WHERE id_item = ANY(p_item_ids);

  UPDATE pedidos SET estado='PARCIAL'
   WHERE id_mesa=p_id_mesa AND id_negocio=v_negocio AND estado='CONFIRMADO'
     AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NOT NULL)
     AND EXISTS (SELECT 1 FROM pedido_items i WHERE i.id_pedido=pedidos.id_pedido AND i.pagado_at IS NULL);

  UPDATE public.reservas
     SET estado = 'asistida',
         id_pedido_aplicado = v_id_pedido,
         updated_at = now()
   WHERE id_reserva = p_id_reserva;

  RETURN v_id_pago;
END;
$$;
