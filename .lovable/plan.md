# Plan de optimización de rendimiento

## Diagnóstico

Análisis del proyecto (129 archivos `.tsx`, 24k líneas). Los cuellos de botella más relevantes son:

1. **QueryClient sin defaults**: cada uno de los 28 `useQuery` refetchea en cada mount y al volver el foco. Sin `staleTime` ni `gcTime` globales, la app pide datos constantemente.
2. **0 rutas usan `loader:`** para precargar datos. El patrón actual es "monta componente → spinner → fetch → render", lo que produce flashes de vacío y peor TTI.
3. **Realtime + polling sobre el mismo dato**: 8 canales `supabase.channel(...)` y 18 `refetchInterval` corren en paralelo en varios componentes (`servicio.index`, `bodega/inventario-tab`, `servicio.$idMesa`, etc.). Realtime ya invalida; el polling es duplicado y consume red/CPU.
4. **Rutas gigantes sin code-splitting**:
   - `carta.$idMesa.tsx` — 1223 líneas (menú público que cargan los clientes con QR; debería ser ligero).
   - `_app.servicio.$idMesa.tsx` — 926 líneas.
   - `_app.configuracion.apariencia.tsx` — 595 líneas.
   - `servicio/pagar-sheet.tsx` — 688 líneas.
   Todo se mete en el chunk de la ruta, hay sheets/dialogs que solo se abren a veces pero siempre se descargan.
5. **`supabase.auth.getUser()` duplicado en 4 sitios** (`_app.tsx`, `app-sidebar.tsx`, `index.tsx`, `login.tsx`) — cada mount dispara un fetch; deberían compartir un contexto/hook único.
6. **11 componentes** consultan `supabase.from/rpc` directo en el cliente para *lectura* (recetas, categorías, insumos, productos) — bypasea la caché de React Query y agranda el bundle del cliente con queries de Supabase.
7. **10+ `<img>` sin `loading="lazy"` ni dimensiones**: en `carta.$idMesa` (lista de productos del menú público) generan CLS y descarga simultánea de muchas imágenes.
8. **Listas sin `React.memo`**: `KanbanBoard`, `ProductoCard` del menú público, items de mesas — cada actualización de la query global re-renderiza toda la lista.
9. **Polling sin desactivar en background** ya se arregló parcialmente con `POLL.*`, pero los **8 canales realtime** quedan activos siempre — bien para datos críticos, mal cuando se duplican con polling.

## Estrategia

Optimizar en capas, de **más impacto y menos riesgo** hacia detalle:

### Capa 1 — Defaults globales del QueryClient (impacto: alto, riesgo: bajo)
En `src/router.tsx`:
- `staleTime: 30_000` (datos frescos por 30s por defecto)
- `gcTime: 5 * 60_000` (mantener en cache 5 min después de desmontar)
- `refetchOnWindowFocus: false` (evita ráfagas al cambiar de pestaña/app — los presets `POLL.*` ya cubren refresco)
- `refetchOnReconnect: "always"` (solo refrescar al recuperar red)
- `retry: 1` con `retryDelay` exponencial (menos reintentos en caída → mejor UX)
- Mantener `defaultPreloadStaleTime: 0` como exige TanStack Query.

Esto solo cambia comportamiento por defecto; los presets `POLL.*` siguen sobreescribiendo donde hacen falta.

### Capa 2 — Eliminar polling redundante donde ya hay realtime (impacto: alto)
Auditoría:
| Archivo | Realtime | Polling | Acción |
|---|---|---|---|
| `routes/_app.servicio.index.tsx` (mesas) | Sí | LIVE | Quitar polling (realtime invalida) |
| `routes/_app.servicio.$idMesa.tsx` (sesión) | Sí | NORMAL | Quitar polling de sesión, mantener `catalogoServicio` |
| `components/configuracion/mesas/mesas-tab.tsx` | Sí | — | OK |
| `components/bodega/inventario-tab.tsx` | Sí | — | OK |
| `components/preparacion/kanban-board.tsx` | Sí | — | OK |
| `components/servicio/alertas-mesero-banner.tsx` | Sí | REALTIME | Quitar polling REALTIME (queda canal) |
| `components/servicio/pagos-pendientes-sheet.tsx` | Sí | REALTIME(open) | Bajar a LIVE o quitar; canal ya invalida |
| `routes/_app.bodega.inventario.$id.tsx` (movs) | Sí | — | OK |
| `routes/_app.dashboard.tsx`, `caja`, `operacion` | No | NORMAL/LIVE | Mantener (no hay realtime) |

Reducción estimada de requests: −30 a −50% en pantallas de servicio.

### Capa 3 — Centralizar la sesión de usuario (impacto: medio)
- Crear `src/hooks/use-auth-user.ts` (basado en `supabase.auth.getSession()` + listener `onAuthStateChange`) cacheado en React Query con key `["auth", "user"]` y `staleTime: Infinity`.
- Reemplazar los 4 `useEffect → supabase.auth.getUser()` por `useAuthUser()`. Una sola llamada por sesión en lugar de N.

### Capa 4 — Code-splitting de sheets/dialogs pesados (impacto: alto en TTI)
Convertir a `React.lazy()` + `Suspense` los componentes que solo se abren bajo demanda:
- `servicio/pagar-sheet.tsx` (688 ln) — solo al pagar.
- `servicio/agregar-producto-sheet.tsx`, `item-editor-sheet.tsx`, `editar-item-dialog.tsx`.
- `bodega/compra-form.tsx`, `compra-detail-sheet.tsx`, `ajustar-stock-form.tsx`, `insumo-form.tsx` (360 ln), `proveedor-form.tsx`.
- `menu/receta-builder.tsx` (517 ln) — solo en edición de receta.
- `servicio/pagos-pendientes-sheet.tsx`.

Cada uno deja de pesar en el chunk inicial de su ruta.

### Capa 5 — Optimizar el menú público `carta.$idMesa.tsx` (1223 ln, lo cargan clientes en móvil con 4G)
- Extraer `ProductoCard`, `ProductoDetalleDialog`, `CategoryNav`, `ThemedHeader` a archivos en `src/components/menu-publico/`.
- Hacer `lazy()` el `ProductoDetalleDialog` (solo al hacer tap en un producto).
- Añadir `loading="lazy"`, `decoding="async"` y `width/height` (o `aspect-ratio`) a TODAS las `<img>` del menú.
- `React.memo` en `ProductoCard` (lista típica de 20-80 productos; cada cambio de filtro re-renderiza todo).
- Aplicar mismo tratamiento a las 10 `<img>` que detecté en otras vistas (`operacion`, `bodega/inventario.$id`).

### Capa 6 — Migrar lecturas directas a `createServerFn` + `useQuery` (impacto: medio, esfuerzo medio)
Los 11 componentes que hacen `supabase.from(...)` directo para *lectura* pasan por servidor (mutaciones se quedan como están para minimizar riesgo):
- `menu/receta-builder.tsx` — categorías + subcategorías + insumos
- `menu/categorias-master-detail.tsx` — categorías + subcategorías
- `bodega/compra-form.tsx` — opciones de proveedores/insumos
- (y los que solo hacen mutación: `productos-tab`, `recetas-table`, `insumo-form`, `proveedor-form`, `ajustar-stock-form`, `nueva-mesa-dialog`, `producto-form` → se dejan; ya el plan anterior aclaró este alcance)

Beneficio: cache compartida entre componentes que piden lo mismo + menos JS del SDK en el bundle del cliente.

### Capa 7 — Memoización de listas y cálculos derivados (impacto: medio)
- `React.memo` con comparador shallow en: `ProductoCard` (carta), filas de Kanban (`comanda-card.tsx`), filas de `historial-compras-table` / `historial-movimientos-table`.
- `useMemo` para filtros/ordenamientos en `servicio.index`, `operacion`, `inventario-tab`.

### Capa 8 — Loaders opcionales para datos críticos en navegación (impacto: medio, riesgo bajo)
- En rutas internas con autenticación (`_authenticated` no aplica aquí pero el patrón equivalente es `_app.tsx`), agregar `loader: ({ context }) => context.queryClient.ensureQueryData(...)` para los datos clave de:
  - `_app.servicio.index` → mesas
  - `_app.dashboard` → kpis
  - `_app.caja.index` → estado-caja
- Combinado con `defaultPreloadStaleTime: 0` esto da SWR sin flashes.

## Fuera de alcance

- No cambiar lógica de negocio (RPCs, RLS, triggers, cálculos).
- No tocar el diseño visual de ningún componente.
- No introducir nuevas dependencias.
- No mover los formularios de mutación a server functions (lo evita romper validación/typing existente).
- No cambiar `supabase/config.toml` ni la generación de tipos.

## Orden de ejecución y archivos

1. **Capa 1**: `src/router.tsx`.
2. **Capa 2**: 4 archivos (eliminar `refetchInterval` que se duplica con canal).
3. **Capa 3**: `src/hooks/use-auth-user.ts` (nuevo) + 4 archivos para usar el hook.
4. **Capa 5** (alta prioridad por ser ruta pública con QR): refactor de `carta.$idMesa.tsx` + nuevos archivos en `src/components/menu-publico/`.
5. **Capa 4**: `lazy()` de ~9 sheets/dialogs.
6. **Capa 7**: `React.memo` + `useMemo` puntuales.
7. **Capa 6** (esfuerzo mayor): migrar lecturas directas.
8. **Capa 8**: loaders en 3 rutas internas.

## Recomendación de pase inicial

Capas **1 + 2 + 3 + 5 + 7** son el "golpe seco" — pocos archivos, muy alto impacto, sin riesgo de romper lógica. Las capas 4, 6 y 8 son trabajo más detallado que vale la pena tras validar las primeras.

¿Avanzo con las 5 capas recomendadas, o prefieres todas las 8?
