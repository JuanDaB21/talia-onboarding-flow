
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.mesas (
  id_mesa UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_negocio UUID NOT NULL,
  identificador VARCHAR(80) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'LIBRE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mesas_identificador_unique UNIQUE (id_negocio, identificador)
);

ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY mesas_select_own ON public.mesas
  FOR SELECT TO authenticated
  USING (id_negocio = current_user_negocio());

CREATE POLICY mesas_insert_own ON public.mesas
  FOR INSERT TO authenticated
  WITH CHECK (id_negocio = current_user_negocio());

CREATE POLICY mesas_update_own ON public.mesas
  FOR UPDATE TO authenticated
  USING (id_negocio = current_user_negocio())
  WITH CHECK (id_negocio = current_user_negocio());

CREATE POLICY mesas_delete_own ON public.mesas
  FOR DELETE TO authenticated
  USING (id_negocio = current_user_negocio());

CREATE TRIGGER set_mesas_updated_at
  BEFORE UPDATE ON public.mesas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
ALTER TABLE public.mesas REPLICA IDENTITY FULL;
