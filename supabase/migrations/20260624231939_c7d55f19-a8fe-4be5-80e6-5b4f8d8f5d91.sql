
-- 1. Grupos de variantes por producto
CREATE TABLE public.producto_variante_grupos (
  id_grupo uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_producto uuid NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE,
  nombre text NOT NULL,
  seleccion text NOT NULL CHECK (seleccion IN ('UNICA','MULTIPLE')),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pvg_producto ON public.producto_variante_grupos(id_producto);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.producto_variante_grupos TO authenticated;
GRANT ALL ON public.producto_variante_grupos TO service_role;

ALTER TABLE public.producto_variante_grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pvg_all_own" ON public.producto_variante_grupos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.productos p WHERE p.id_producto = producto_variante_grupos.id_producto AND p.id_negocio = current_user_negocio()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.productos p WHERE p.id_producto = producto_variante_grupos.id_producto AND p.id_negocio = current_user_negocio()));

CREATE TRIGGER pvg_touch BEFORE UPDATE ON public.producto_variante_grupos
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 2. Opciones del grupo
CREATE TABLE public.producto_variante_opciones (
  id_opcion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_grupo uuid NOT NULL REFERENCES public.producto_variante_grupos(id_grupo) ON DELETE CASCADE,
  id_producto_opcion uuid NOT NULL REFERENCES public.productos(id_producto) ON DELETE RESTRICT,
  precio_delta numeric NOT NULL DEFAULT 0 CHECK (precio_delta >= 0),
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id_grupo, id_producto_opcion)
);
CREATE INDEX idx_pvo_grupo ON public.producto_variante_opciones(id_grupo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.producto_variante_opciones TO authenticated;
GRANT ALL ON public.producto_variante_opciones TO service_role;

ALTER TABLE public.producto_variante_opciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pvo_all_own" ON public.producto_variante_opciones
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.producto_variante_grupos g
    JOIN public.productos p ON p.id_producto = g.id_producto
    WHERE g.id_grupo = producto_variante_opciones.id_grupo AND p.id_negocio = current_user_negocio()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.producto_variante_grupos g
    JOIN public.productos p ON p.id_producto = g.id_producto
    WHERE g.id_grupo = producto_variante_opciones.id_grupo AND p.id_negocio = current_user_negocio()
  ));

-- 3. Variantes seleccionadas en pedido confirmado
CREATE TABLE public.pedido_item_variantes (
  id_piv uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_item uuid NOT NULL REFERENCES public.pedido_items(id_item) ON DELETE CASCADE,
  id_grupo uuid REFERENCES public.producto_variante_grupos(id_grupo) ON DELETE SET NULL,
  id_opcion uuid REFERENCES public.producto_variante_opciones(id_opcion) ON DELETE SET NULL,
  id_producto_opcion uuid REFERENCES public.productos(id_producto) ON DELETE SET NULL,
  nombre_grupo text NOT NULL,
  nombre_opcion text NOT NULL,
  precio_delta numeric NOT NULL DEFAULT 0
);
CREATE INDEX idx_piv_item ON public.pedido_item_variantes(id_item);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_item_variantes TO authenticated;
GRANT ALL ON public.pedido_item_variantes TO service_role;

ALTER TABLE public.pedido_item_variantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "piv_all_own" ON public.pedido_item_variantes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedido_items i
    JOIN public.pedidos p ON p.id_pedido = i.id_pedido
    WHERE i.id_item = pedido_item_variantes.id_item AND p.id_negocio = current_user_negocio()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedido_items i
    JOIN public.pedidos p ON p.id_pedido = i.id_pedido
    WHERE i.id_item = pedido_item_variantes.id_item AND p.id_negocio = current_user_negocio()
  ));

-- 4. Columna de variantes en prepedido_items
ALTER TABLE public.prepedido_items
  ADD COLUMN variantes jsonb NOT NULL DEFAULT '[]'::jsonb;
