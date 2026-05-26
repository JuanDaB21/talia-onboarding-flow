# Estandarización y mejora de performance

## Hallazgos del análisis

Al revisar `src/components` y `src/routes` (129 archivos `.tsx`) encontré varios patrones inconsistentes que afectan performance, mantenibilidad y consumo:

1. **Polling con intervalos hardcoded e inconsistentes** (18 lugares): `10_000`, `15_000`, `15000`, `20_000`, `30_000`, `60_000`. Cada componente decide su propio ritmo, y varios refetch corren en background incluso cuando la pestaña no está visible.
2. **Componentes que consultan Supabase directamente** (11 archivos): formularios de `bodega`, `menu`, `configuracion` y `register` hacen `supabase.from(...)` en lugar de pasar por `createServerFn`. Esto rompe el patrón del resto del proyecto, no aprovecha caché de React Query y carga el bundle del cliente con queries.
3. **Componentes reutilizables aislados en un módulo**: `ResponsiveSheet` y `Combobox` viven en `src/components/bodega/` pero son genéricos. Otros módulos (menu, configuracion, servicio) reimplementan Sheet+Dialog responsive a mano.
4. **Rutas muy grandes** (>900 líneas): `_app.servicio.$idMesa.tsx` (925), `carta.$idMesa.tsx` (1222), `_app.operacion.tsx` (286). Todo en un archivo = bundle más grande para esa ruta y peor code-splitting.
5. **Empty states ad-hoc**: 15+ lugares con "No hay…" duplicado en JSX.
6. **Sin `staleTime`** en la mayoría de `useQuery`: cada montaje refetchea aunque los datos sigan frescos.

## Plan de cambios

### 1. Centralizar polling y caché (mayor impacto/menor riesgo)
- Crear `src/lib/query-config.ts` con presets:
  - `POLL.REALTIME` (10s) — alertas mesero, llamados
  - `POLL.LIVE` (15s) — servicio, mesas, cocina
  - `POLL.NORMAL` (30s) — caja, dashboard
  - `POLL.SLOW` (60s) — paneles del dashboard, turno
  - Cada preset incluye `refetchInterval`, `staleTime` y `refetchIntervalInBackground: false` para no consumir red con pestaña inactiva.
- Reemplazar los 18 sitios con `...POLL.LIVE` etc.
- Beneficio inmediato: menos requests cuando la app no está en foco (estimado −40 a −60% de requests de polling).

### 2. Mover componentes genéricos a `src/components/ui/` o `src/components/common/`
- `responsive-sheet.tsx` → `src/components/ui/responsive-sheet.tsx`
- `combobox.tsx` → `src/components/ui/combobox.tsx`
- Crear `src/components/common/empty-state.tsx` (icono + título + descripción + acción opcional) y reemplazar los "No hay X" duplicados.
- Crear `src/components/common/loading-state.tsx` (skeleton/spinner estándar).
- Actualizar imports en bodega y aplicar en los demás módulos donde haya patrón similar.

### 3. Migrar queries directas a server functions
- Inventariar los 11 componentes con `supabase.from/rpc` directo y mover su lectura a una función en `src/lib/<modulo>.functions.ts` (las mutaciones se quedan; el foco es lectura).
- Envolver cada lectura en `useQuery` con `queryKey` consistente y preset de caché.
- Reduce código duplicado, mejora SSR-readiness y permite invalidación coordinada.

### 4. Code-splitting de rutas pesadas
- Extraer los sub-componentes grandes de `carta.$idMesa.tsx` y `_app.servicio.$idMesa.tsx` a archivos en `src/components/menu-publico/` y `src/components/servicio/` (modal de detalle, ProductoCard variants, sheets, etc.). Los archivos ya estaban previstos en el plan anterior pero quedaron inline.
- Esto reduce el bundle de cada ruta y mejora TTI.

### 5. Estandarizar claves de `useQuery`
- Convención: `[<modulo>, <recurso>, ...filtros]` (ej. `['servicio', 'mesas', negocioId]`).
- Documentar en `src/lib/query-config.ts` como comentario de referencia.
- Permite invalidación granular sin pisar otros módulos.

## Fuera de alcance

- No tocar lógica de negocio (cálculos, RPCs, RLS).
- No cambiar el diseño visual de ningún componente.
- No migrar todos los formularios a server functions en una sola pasada — solo las **lecturas**; las mutaciones quedan igual para evitar regresiones.
- No introducir nuevas dependencias.

## Archivos principales a tocar

- **Nuevos**: `src/lib/query-config.ts`, `src/components/ui/responsive-sheet.tsx`, `src/components/ui/combobox.tsx`, `src/components/common/empty-state.tsx`, `src/components/common/loading-state.tsx`.
- **Modificados (polling/caché)**: las 18 rutas/componentes con `refetchInterval`.
- **Modificados (imports)**: bodega/* que usan `ResponsiveSheet` y `Combobox`.
- **Refactor (lectura → server fn + useQuery)**: `productos-tab`, `recetas-table`, `categorias-master-detail`, `proveedores-tab/insumos-tab`, formularios de bodega/menu que cargan opciones.
- **Split**: `carta.$idMesa.tsx` y `_app.servicio.$idMesa.tsx`.

## Orden sugerido de ejecución

1. Crear `query-config.ts` + aplicar presets (cambio mecánico, gran beneficio).
2. Mover `responsive-sheet` y `combobox` a `ui/` + crear `empty-state`/`loading-state`.
3. Migrar lecturas directas a server functions + useQuery con keys estándar.
4. Split de rutas pesadas.

¿Avanzo con los 4 pasos o prefieres que limite el primer pase solo a los pasos 1 y 2 (mayor impacto, menor riesgo) y revisamos antes de seguir?
