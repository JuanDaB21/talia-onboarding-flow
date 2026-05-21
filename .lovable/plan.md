# Fix: "No se encontró un negocio asociado a tu usuario"

## Diagnóstico

La consulta a `usuarios_staff` devuelve **403** con el mensaje:

```
permission denied for function current_user_negocio
```

Todas las políticas RLS de `usuarios_staff`, `negocio`, `proveedores` e `insumos` usan `public.current_user_negocio()` en sus expresiones `USING` / `WITH CHECK`. Esa función existe y es `SECURITY DEFINER`, pero el rol `authenticated` **no tiene `EXECUTE`** sobre ella, por lo que Postgres rechaza cualquier evaluación de política y bloquea las lecturas/escrituras del usuario recién registrado (aunque su fila en `usuarios_staff` sí exista).

Verificado vía:
```sql
SELECT has_function_privilege('authenticated', 'public.current_user_negocio()', 'EXECUTE'); -- f
```

## Cambio (una sola migración SQL)

Otorgar `EXECUTE` sobre la función a los roles que la consumen desde PostgREST:

```sql
GRANT EXECUTE ON FUNCTION public.current_user_negocio() TO authenticated, anon;
```

No se modifican tablas, políticas, ni código del frontend. Tras aplicar la migración, `useCurrentNegocio` recibirá el `id_negocio` y la vista de Proveedores e Insumos cargará normalmente.

## Fuera de alcance

- Cambios en `/register`, `/login`, `/dashboard` o cualquier componente de Bodega.
- Cambios en la definición de la función `current_user_negocio` o en las políticas RLS existentes.
