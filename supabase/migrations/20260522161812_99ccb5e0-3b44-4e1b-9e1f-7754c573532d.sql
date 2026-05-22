DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_id_usuario_fkey'
  ) THEN
    ALTER TABLE public.movimientos_inventario
      ADD CONSTRAINT movimientos_inventario_id_usuario_fkey
      FOREIGN KEY (id_usuario) REFERENCES public.usuarios_staff(id_usuario) ON DELETE SET NULL;
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';