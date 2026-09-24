---
name: realtime-incremental
description: Cómo suscribirse al realtime del backend de Talia (WebSocket propio, API tipo Supabase) parcheando el cache de TanStack Query en vez de refetch total. Úsalo al tocar realtime-client, suscripciones, o cuando una pantalla deba actualizarse sola (servicio, cocina, barra, caja).
---

# Realtime incremental

Contrato **P3**: el evento **parchea el cache**. Nunca `refetch()` total ni
`invalidateQueries(["servicio"])` por cada mensaje. En un local con 20 mesas y 6 pantallas, un
refetch por evento es lo que tumba la operación.

## Cómo funciona aquí

El backend hace `pg_notify('realtime', ...)` desde triggers, escucha con `LISTEN` y reparte por
WebSocket, **scopeado por `negocio_id`**. `src/lib/realtime-client.ts` expone una API con forma
de Supabase para no reescribir los componentes:

```ts
import { realtime } from "@/lib/realtime-client";

useEffect(() => {
  const ch = realtime
    .channel("servicio-mesas")
    .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, (payload) => {
      queryClient.setQueryData(["servicio", "mesas", negocioId], (prev) =>
        aplicarCambio(prev, payload),          // patch incremental
      );
    })
    .subscribe();
  return () => { ch.unsubscribe(); };
}, [negocioId, queryClient]);
```

## Reglas

1. **Patch, no refetch.** `setQueryData` con la fila del payload. Solo si el patch es imposible
   (cambió una agregación que el front no puede recalcular) se invalida **esa** queryKey.
2. **Un canal por pantalla**, desmontado en el cleanup del `useEffect`. Canales huérfanos =
   fugas y eventos duplicados.
3. **queryKey exacta.** El patch usa la misma key que la query (`[<modulo>, <recurso>, ...filtros]`).
   Si la key lleva filtros, parchea todas las variantes afectadas o invalida por prefijo acotado.
4. **Idempotencia.** El mismo evento puede llegar dos veces (reconexión). El patch debe ser
   idempotente: reemplaza por `id`, no hagas `push` a ciegas.
5. **Reconexión.** Al reconectar, el estado puede haberse perdido: ahí sí toca una
   revalidación puntual de las queries del módulo, **una vez**, no por evento.
6. **El polling sigue siendo la red de seguridad.** Los presets de `query-config.ts` cubren el
   caso de WS caído. No los quites porque "ya hay realtime".
7. **Móviles.** Hubo congelamientos por WS sin heartbeat y por refresh de auth sin timeout. Si
   tocas la reconexión, no elimines el heartbeat ni los timeouts de `api-client`.

## Checklist

- [ ] `setQueryData` (patch) en vez de refetch total.
- [ ] Cleanup del canal en el `useEffect`.
- [ ] Patch idempotente por `id`.
- [ ] queryKey consistente con la query que alimenta la pantalla.
- [ ] Presets de polling intactos.
- [ ] Probado con dos pestañas abiertas del mismo negocio.
