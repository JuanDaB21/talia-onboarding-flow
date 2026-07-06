# CUTOVER — Front a la API de Talia (rama `deployment`)

Este repo lo edita **Lovable en `main`** (sigue hablando con Supabase). El despliegue en Railway
sale de la rama **`deployment`**, donde se repunta la capa de datos a la API REST del backend
(`talia-backend`) y se ajusta el build para Railway. **No** se toca `main`.

## Estrategia de ramas

- `main` → Lovable / desarrollo del front (Supabase). Intacta.
- `deployment` → rama desplegada en Railway. Aquí vive el cutover + config de deploy.
- Flujo: cuando Lovable avanza en `main`, hacer `git checkout deployment && git merge main` y
  re-aplicar/conservar el cutover (ver reglas abajo). El servicio de Railway apunta a `deployment`.

## Regla anti-regresión

> Todo acceso a **datos** pasa por `src/lib/*.functions.ts` → API REST (`@/lib/api-client`).
> **No** volver a meter `supabase.rpc()/from()` para lógica de negocio. Supabase queda **solo para
> Storage** de imágenes. Si Lovable regenera un componente con `supabase`, corregirlo hacia la
> función `lib/*.functions.ts` correspondiente al mergear `main → deployment`.

## Infra ya colocada en esta rama

- `src/lib/api-client.ts` — fetch + JWT Bearer + refresh automático.
- `src/lib/auth.ts` — login/register/logout/me con el JWT propio.
- `src/lib/realtime-client.ts` — WebSocket con API tipo Supabase (`channel().on("postgres_changes")`).
- `.env.example` + `.env` gitignored (`VITE_API_URL`, `VITE_WS_URL`, `VITE_APP_ENV`).

Las versiones REST de los data-access están en el repo del backend en `front-cutover/lib/*.functions.ts`
(mismas firmas que los `src/lib/*.functions.ts` de aquí). Copiarlas por módulo al hacer el cutover.

## Cutover módulo por módulo (hacer con el backend YA vivo en Railway, para verificar)

Por cada módulo (empezar por `servicio` o `caja`):
1. Reemplazar `src/lib/<modulo>.functions.ts` por la versión REST de `talia-backend/front-cutover/lib/`.
2. En los componentes que lo usan: `useServerFn(fn)` → llamar `fn` directo (cliente→API).
3. Realtime: cambiar el import `@/integrations/supabase/client` → `@/lib/realtime-client`
   (solo el import; la API `channel().on("postgres_changes")` se mantiene).
4. Auth/login: usar `@/lib/auth` en vez de `supabase.auth`.
5. Probar el flujo del módulo contra la API de Railway.

## Estado del cutover

**Ya en REST (`@/lib/api-client`):** `servicio` (incl. catálogo/opciones/sesión), `pagos`
(incl. pendientes/resumen-turno), `turno`, `caja` (incl. getCierre), `negocio` (config/apariencia
+ **propinas**), `reservas`, `preparacion` (+ realtime por `@/lib/realtime-client`),
`propinas`, `espacios`, `bodegas` (gestión), `bonos`, `admin`/analítica, `metodos-pago`,
`mesas` (configuración, + realtime), `impresión`. **Storage** helper `src/lib/storage.ts`
(subida prefirmada + proxy priv autenticado); ya en uso por métodos-pago (QR) y comprobantes de pago.

**Aún en Supabase** (con su razón):
- **Bodega — inventario** (fuera del alcance de este cutover-config): `insumos`, `compras`,
  `proveedores`, `ajustar-stock`, `movimientos`, `inventario`. Los endpoints ya existen (`/bodega/*`,
  ver CUTOVER-BACKEND §0), pero los componentes `src/components/bodega/*` + `_app.bodega.*` siguen con
  `supabase.from/rpc` inline. Pendiente de repunte.
- **Usuarios** (`configuracion/usuarios-tab`, `usuarios.functions.ts`) — pendiente de repunte.
- Residuos: `analytics.functions.ts`, `preparacion/comanda-print.ts` importan `supabase` (revisar si
  es tipo/uso real).
- **Auth shim** (`requireSupabaseAuth`) — mientras queden server functions Supabase.

## Pendiente para llegar a 0% Supabase

> El backend es quien bloquea la mayoría. El plan de endpoints a construir está en el repo del
> backend: **`talia-backend/docs/CUTOVER-BACKEND.md`** (secciones §1–§11). Este checklist es la
> parte del **front** una vez cada endpoint exista.

Por cada módulo, cuando el endpoint esté vivo en Railway: reemplazar la versión Supabase por la REST
(mismo patrón que caja/reservas/preparación), quitar `useServerFn`, y actualizar consumidores.

- [x] **propinas** → `getPropinasPorUsuario` a `GET /propinas/por-usuario`; `updateNegocioPropinas`
      a `PATCH /negocio` (backend §6). Elimina la última excepción de `negocio`.
- [x] **espacios** → `/espacios` CRUD (backend §3).
- [x] **metodos-pago** → `/metodos-pago` CRUD + subir QR por `/storage/upload-url` (backend §4).
- [x] **menú (categorías/subcategorías/productos)** → migrado a `/menu/*` vía `src/lib/menu.functions.ts`
      (`categorias-master-detail`, `productos-tab`, `producto-form`, `receta-builder`, `recetas-table`).
      Imagen de producto por `uploadToStorage("producto")` + `publicUrl`. Backend agregó lecturas
      `GET /menu/subcategorias`, `GET /menu/recetas/:id` (detalle para editar) y `unidad_receta` en
      `GET /bodega/insumos`.
- [x] **variantes de receta** → `variantes.functions.ts` repuntado a `/variantes/recetas/:id`
      (`GET` grupos+opciones, `PUT` guardar); insumos-opción desde `/bodega/insumos`.
      `variantes-builder.tsx` sin `useServerFn`. Backend: `routes/variantes.ts`.
- [x] **bodegas (gestión)** → `/bodega/bodegas` (crear/renombrar/toggle) + `espacios_principales`
      en el listado (backend §1).
- [x] **bonos** → `/bonos` CRUD + previsualizar + historial (backend §5).
- [x] **admin/analítica** → `/analytics/*` (backend §7).
- [x] **mesas (configuración)** → `/mesas` CRUD (backend §8).
- [x] **carta pública / menu-publico** → `menu-publico.functions.ts` repuntado a `/carta/:idMesa/state`
      y `/cuenta` (+ `llamar-mesero`/`solicitar`). Imágenes con `publicUrl`.
- [x] **prepedido** → flujo público (`unirse`/`estado`/`opciones`/`agregar`/`editar`/`eliminar`) a
      `/prepedido/public/*`; `aceptarPrepedido` a `POST /prepedido/mesas/:id/aceptar`; `getPrepedidoMesa`
      a `GET /prepedido/mesas/:id`. **Staff edita/elimina item de OTRO comensal**:
      `editarItemPrepedidoStaff` → `PATCH /prepedido/items/:id`, `eliminarItemPrepedidoStaff` →
      `POST /prepedido/items/:id/eliminar` (backend 0006, SECURITY DEFINER valida negocio de la mesa).
      `prepedido-en-vivo-card.tsx` / `prepedido-item-editor-staff.tsx` sin `useServerFn`.
- [x] **impresión** → config `espacio_impresora` por REST (backend §11).
- [x] **Storage de imágenes** → `src/lib/storage.ts` usado por QR, comprobantes, **producto**
      (`producto-form`) y **logo** (`configuracion/apariencia`).

### Cierre final (cuando no quede ningún `supabase.*`)

- [ ] Eliminar `src/integrations/supabase/*` (`client`, `client.server`, `auth-middleware`,
      `auth-attacher`) y todas las server functions restantes.
- [ ] Quitar la dependencia `@supabase/supabase-js` del `package.json`.
- [ ] Verificar que `VITE_SUPABASE_*` ya no se usa; borrar de `.env`/`.env.example`.
- [ ] `grep -r "supabase" src` debe quedar vacío. `npx tsc --noEmit` verde.

## Deploy del front en Railway — pendiente de decisión

⚠️ El build usa `@lovable.dev/vite-tanstack-config`, que **incluye el plugin de Cloudflare
(build-only)**. Para Railway (node-server) hay que **ejectar** ese wrapper en esta rama:
sustituirlo por la config estándar de TanStack Start + Vite con target de servidor Node, arrancar con
el server de Nitro, y neutralizar `wrangler.jsonc`. Alternativas:
- **(A)** Ejectar a node-server y desplegar en Railway (unifica todo en Railway; requiere validar el build).
- **(B)** Desplegar el front en **Cloudflare** (para lo que ya está armado) y dejar solo el backend en Railway.

Decidir con el backend ya desplegado. Mientras tanto, el front se puede probar desde el **preview de
Lovable** apuntando `VITE_API_URL` a la API de Railway.
