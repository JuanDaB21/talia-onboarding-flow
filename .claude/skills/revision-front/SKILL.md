---
name: revision-front
description: Auditar un diff o PR del front de Talia contra los contratos del proyecto (anti-regresión Supabase, T5 data-access, P3 realtime incremental, T2 tipos, P6 bundle de carta). Úsalo antes de abrir un PR del front o al revisar uno ajeno.
---

# Revisión del front

Auditoría **del diff**, no del repo entero. Cada hallazgo cita `archivo:línea`. Sin hallazgos
inventados; lo dudoso se marca como duda.

## Ámbito

```bash
git diff deployment...HEAD --stat
git diff deployment...HEAD
gh pr diff <n>
```

## Chequeos automatizables (córrelos)

```bash
# Anti-regresión Supabase — debe salir vacío (salvo storage de imágenes)
grep -rn "supabase\." src --include=*.ts --include=*.tsx

# T5 — data-access dentro de componentes
grep -rn "fetch(\|api\.\(get\|post\|put\|delete\)" src/components src/routes --include=*.tsx

# P3 — refetch total tras un evento realtime
grep -rn "refetch()\|invalidateQueries" src --include=*.tsx -B3 | grep -i "postgres_changes" -A3

# queryKeys fuera de convención [<modulo>, <recurso>, ...]
grep -rn "queryKey: \[" src --include=*.tsx | head -40

# Intervalos de polling inventados en vez de los presets
grep -rn "refetchInterval: [0-9]" src --include=*.tsx

# Secretos y URLs quemadas
grep -rnE "(sk-|eyJ[A-Za-z0-9]{20,}|https://[a-z0-9-]+\.up\.railway\.app)" src

# Puertas
npm run lint && npm run build
```

## Checklist

**Datos**
- Toda llamada nueva pasa por `src/lib/<modulo>.functions.ts` (T5).
- El endpoint existe en el `SPEC.md` del backend (T1). Si no, bloqueante.
- Cero `supabase.` en la capa de datos.
- `id_negocio` no se manda como filtro de confianza desde el cliente.

**Realtime**
- Patch al cache, no refetch total (P3).
- Canal con cleanup en el `useEffect`; patch idempotente por `id`.
- Presets de `query-config.ts` intactos.

**Calidad**
- `npm run lint` y `npm run build` verdes; sin `any` nuevo ni `@ts-ignore` sin justificar (T2).
- Errores de API manejados con `ApiError`; sesión expirada vía `onAuthExpired`, no a mano.
- Roles: el guard del front acompaña al del backend, no lo sustituye.

**Rendimiento**
- Carta pública (`carta.$idMesa`, `carta-publica.$idNegocio`): sin dependencias pesadas nuevas;
  presupuesto `< ~150 KB gz` y FCP `< 1.5 s` en 4G (P2/P6).
- Sin N+1 de llamadas: un endpoint compuesto antes que un bucle de fetches.

**Móvil**
- No se tocan heartbeat del WS ni timeouts de `api-client` sin justificarlo (hubo congelamientos
  por eso).

## Formato del reporte

```
BLOQUEANTE  T5  src/components/caja/cierre-panel.tsx:64  fetch directo en el componente
ADVERTENCIA P3  src/routes/_app.servicio.index.tsx:120   refetch() total tras evento realtime
DUDA        P6  package.json:41                          dep nueva: ¿entra en el bundle de la carta?

VEREDICTO: NO APTO — mover el fetch a servicio.functions.ts y parchear el cache
```
