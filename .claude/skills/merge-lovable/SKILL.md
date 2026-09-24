---
name: merge-lovable
description: Traer avances de Lovable de main a deployment sin reintroducir Supabase ni romper el cutover a la API propia. Úsalo al mergear main, al resolver conflictos entre ramas del front, o cuando aparezca código con supabase.rpc/from después de un merge.
---

# Merge `main → deployment`

`main` la edita Lovable **contra Supabase**. `deployment` es la rama desplegada en Railway,
con la capa de datos repuntada a la API propia. El merge siempre va en esa dirección; **`main`
no se toca desde aquí**.

## Procedimiento

```bash
git checkout deployment && git pull --ff-only
git checkout -b merge/lovable-<fecha>          # nunca mergear directo sobre deployment
git merge main
```

## Regla anti-regresión (lo que se revisa en cada conflicto)

> Todo acceso a **datos** pasa por `src/lib/*.functions.ts` → `@/lib/api-client`.
> Supabase queda **solo** para Storage de imágenes.

Cuando Lovable regenera un componente, típicamente vuelve a meter:

| Lo que trae `main` | Cómo queda en `deployment` |
|---|---|
| `supabase.from(...)` / `supabase.rpc(...)` | la función correspondiente de `src/lib/<modulo>.functions.ts` |
| `import { supabase } from "@/integrations/supabase/client"` | `import { realtime } from "@/lib/realtime-client"` (la API `channel().on("postgres_changes")` se mantiene) |
| `supabase.auth.*` | `@/lib/auth` (login/register/logout/getMe) |
| `useServerFn(fn)` | llamar `fn` directo (cliente → API) |
| `refetch()` tras un evento realtime | patch al cache (skill `realtime-incremental`) |

Resuelve el conflicto quedándote con **la UI de `main`** y **la capa de datos de `deployment`**.
Nunca al revés, y nunca "acepta ambos" en un archivo de `src/lib/*.functions.ts`.

## Verificación (obligatoria antes del PR)

```bash
# no debe devolver NADA fuera de storage de imágenes
grep -rn "supabase\." src --include=*.ts --include=*.tsx

# no debe haber fetch suelto en componentes
grep -rn "fetch(" src/components src/routes --include=*.tsx

npm run lint && npm run build
```

Estado de referencia: hoy `src/` **no tiene ninguna** referencia a Supabase. Si tras el merge
aparece alguna, es una regresión, no una novedad.

## Cierre

- PR de `merge/lovable-<fecha>` → `deployment`, listando los componentes que hubo que corregir.
- Si el merge trae UI que necesita un endpoint que no existe, **no lo inventes en el front**:
  primero va a `SPEC.md` y al backend (skill `lote-release` del repo del backend).
- Probar a mano, como mínimo: login, servicio (abrir mesa → pedido → cobrar), cocina/barra,
  caja (cierre) y carta pública por QR.
