---
name: modulo-datos
description: Patrón de acceso a datos del front de Talia — src/lib/<modulo>.functions.ts sobre @/lib/api-client, con zod, queryKeys y presets de query-config. Úsalo al crear o cambiar una pantalla, un formulario, una llamada a la API, o cuando aparezca fetch/supabase suelto en un componente.
---

# Módulo de datos

## Regla única

> **Ningún componente llama a la API.** El componente llama a una función de
> `src/lib/<modulo>.functions.ts`; esa función es la única que usa `@/lib/api-client`.

Esto es el contrato **T5**. Y nunca `supabase.rpc()` / `.from()`: la capa de datos es REST contra
el backend propio. Supabase quedó **solo** para Storage de imágenes, si acaso.

## 1. La función de datos

```ts
// src/lib/caja.functions.ts
import { api } from "@/lib/api-client";
import { z } from "zod";

const turnoSchema = z.object({
  id: z.string().uuid(),
  abierto_en: z.string(),
  efectivo_esperado: z.number(),
});
export type Turno = z.infer<typeof turnoSchema>;

export async function getTurnoActual(): Promise<Turno | null> {
  const data = await api.get("/caja/turno-actual");
  return data ? turnoSchema.parse(data) : null;
}

export async function registrarPago(input: { idMesa: string; monto: number }) {
  return api.post(`/mesas/${input.idMesa}/cobrar`, { monto: input.monto });
}
```

- El `id_negocio` **no** se manda como filtro: viaja en el JWT y el backend lo impone.
- El endpoint tiene que existir en `SPEC.md` (repo del backend). Si no está, no lo inventes:
  primero se agrega allá.
- Errores: deja subir el `ApiError` de `api-client`; no lo conviertas en `null` silencioso.

## 2. El consumo en el componente

```tsx
const { data: turno } = useQuery({
  queryKey: ["caja", "turno-actual"],       // [<modulo>, <recurso>, ...filtros]
  queryFn: getTurnoActual,
  ...POLL.NORMAL,                            // preset de @/lib/query-config
});
```

- **queryKey**: `[<modulo>, <recurso>, ...filtros]`. Consistente, porque el realtime parchea por
  esa key.
- **Preset de polling**: usa `query-config.ts` (REALTIME 10s · LIVE 15s · NORMAL 30s · SLOW 60s).
  No inventes intervalos ni desactives `refetchIntervalInBackground`.
- **Mutaciones**: `useMutation` + patch/`invalidateQueries` de la key **específica**, no del módulo.

## 3. Formularios

`react-hook-form` + `zodResolver` con el schema de `src/lib/<modulo>-schemas.ts`. El schema del
formulario y el de la respuesta son distintos: no los mezcles.

## 4. Sesión y roles

- No manejes el 401 a mano: `api-client` refresca el token y emite `onAuthExpired`.
- Los guards de rol están en `src/routes/_app.tsx` (RoleRedirect). Si un módulo cambia de
  permisos, se ajusta ahí **y** en el backend; el front no es la autoridad.

## 5. Checklist

- [ ] La función vive en `src/lib/<modulo>.functions.ts` y usa `api` de `api-client`.
- [ ] El endpoint existe en el `SPEC.md` del backend.
- [ ] zod en la respuesta si el componente confía en su forma.
- [ ] queryKey con la convención del repo.
- [ ] Preset de `query-config.ts`, no un intervalo inventado.
- [ ] Cero `fetch(`, cero `supabase.` en componentes.
- [ ] `npm run lint` y `npm run build` verdes.
