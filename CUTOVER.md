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

**Supabase: 0% (rama `deployment`/PR #10).** Ya no queda ningún acceso a Supabase en el front:
- `@supabase/supabase-js` eliminado de `package.json`; `src/integrations/supabase/*` borrado.
- **Storage** de imágenes también migrado: `src/lib/storage.ts` usa el backend Talia (URL prefirmada
  al bucket + proxy `/storage/pub|priv`). Ya **no** depende de Supabase Storage.
- `comanda-print.ts` repuntado a `getNegocioConfig()` (REST); auth shim `requireSupabaseAuth` retirado.
- `grep -i supabase src` = solo **comentarios** históricos (0 usos de `supabase.`).

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
- [x] **bodega — inventario** → todo `src/components/bodega/*` + `_app.bodega.*` a
      `@/lib/bodega.functions` (+ realtime por `@/lib/realtime-client`). Backend agregó lecturas de
      detalle (`/bodega/inventario-bodega`, `/bodega/insumos/:id[/stock-por-bodega|/compras|/movimientos]`),
      `DELETE /bodega/insumos/:id` y `/bodega/proveedores/:id`, y realtime de `inventario_bodega` (0007).
- [x] **impresión** → config `espacio_impresora` por REST (backend §11).
- [x] **Storage de imágenes** → `src/lib/storage.ts` usado por QR, comprobantes, **producto**
      (`producto-form`) y **logo** (`configuracion/apariencia`).

---

## Repunte pendiente (backend listo — ejecutar en la próxima sesión)

> ✅ **COMPLETO.** Ambos módulos repuntados a REST en esta rama (`usuarios.functions.ts` y
> `analytics.functions.ts` sin `supabase`, sin `createServerFn`/`requireSupabaseAuth`). Los call-sites
> ya llaman `fn(x)` directo: `usuarios-tab`, `usuario-form`, `caja-turno-card`, `_app.operacion` y los
> 4 paneles de dashboard (`rentabilidad`, `cliente`, `operacion`, `alertas`). El detalle de contrato
> se conserva abajo como referencia. `npx tsc --noEmit` verde.

- [x] **usuarios** → `src/lib/usuarios.functions.ts` repuntado a REST (+ `listarUsuariosStaff` →
      `GET /usuarios`, filtrando `SUPERADMIN` en el front). Preserva las 4 firmas
      (`crearUsuarioStaff`, `actualizarUsuarioStaff`, `eliminarUsuarioStaff`, `inhabilitarStaff`).
      Mapa endpoint:
      - `crearUsuarioStaff(input)` → `api.post("/usuarios", input)`; input tal cual
        `{nombre, correo, password, rol, id_espacio_asignado?, estado:boolean, recibe_propinas:boolean}`.
        Devuelve `{ id_usuario }`.
      - `actualizarUsuarioStaff({id_usuario, ...rest})` → `api.patch("/usuarios/" + id_usuario, rest)`
        con `{nombre, rol, id_espacio_asignado?, estado:boolean, recibe_propinas:boolean, password?}`.
      - `eliminarUsuarioStaff({id_usuario})` → `api.del("/usuarios/" + id_usuario)`.
      - `inhabilitarStaff({id_usuario?})` → si viene `id_usuario`: `api.post("/usuarios/" + id_usuario + "/inhabilitar")`;
        si no (auto): `api.post("/usuarios/inhabilitar")`.
      - `GET` de la lista (en `usuarios-tab.tsx`, hoy `supabase.from("usuarios_staff").select(...)`) →
        `api.get("/usuarios")`. El backend ya devuelve `id_usuario, nombre, correo, rol, estado,
        recibe_propinas, id_espacio_asignado, esta_en_turno`.
      - Notas: el backend **valida las mismas reglas** (password 8–72 mayús/minús/dígito; espacio
        obligatorio si COCINA/BARRA/ESTACION; bloquea SUPERADMIN → 403). Las validaciones del form
        pueden quedarse. Ya no se crea usuario en Supabase Auth (el backend inserta con `password_hash`).
      - Call-sites: `configuracion/usuarios-tab.tsx`, `configuracion/usuario-form.tsx`.

- [x] **analítica avanzada** → `src/lib/analytics.functions.ts` repuntado a REST. Las 4 funciones son
      `POST { desde, hasta }` con la **misma forma de salida** (tipos `IngenieriaMenu`,
      `ComportamientoCliente`, `EficienciaOperativa`, `AlertasFugas` se conservan tal cual):
      - `getIngenieriaMenu(r)` → `api.post("/analytics/ingenieria-menu", r)`.
      - `getComportamientoCliente(r)` → `api.post("/analytics/comportamiento-cliente", r)`.
      - `getEficienciaOperativa(r)` → `api.post("/analytics/eficiencia-operativa", r)`.
      - `getAlertasFugas(r)` → `api.post("/analytics/alertas-fugas", r)`.
      - El backend ya devuelve el JSON con los mismos campos (heatmap 7×24, cuadrantes,
        productos_lentos, desviaciones, etc.), así que el componente consumidor no cambia de shape.
      - Con esto se elimina el import de `supabase` en `analytics.functions.ts`.

### Cierre final (0% Supabase) — LISTO (rama `feat/cutover-usuarios-analytics-front`, PR #10)

Hecho en esta pasada:
- [x] **Chat IA** → el backend ya sirve `/api/chat` (mismos tools/auth). `chat-panel.tsx` repuntado
      a `${api.url}/chat` con `Authorization: Bearer` (ya no usa la ruta local). Borrada la ruta
      duplicada `src/routes/api/chat.ts`.
- [x] **Cron cerrar-turnos** → lo corre el backend (`cron/cerrar-turnos.ts`). Borrado el hook
      duplicado `src/routes/api/public/hooks/cerrar-turnos.ts`.
- [x] **comanda-print.ts** → `supabase.from("negocio")` → `getNegocioConfig()` (REST).
- [x] **start.ts** → quitado `attachSupabaseAuth` del `functionMiddleware` (ya no hay server functions).
- [x] Eliminado `src/integrations/supabase/*` (client, client.server, auth-middleware, auth-attacher, types).
- [x] Quitado `@supabase/supabase-js` del `package.json` (+ `npm install`, -9 paquetes).
- [x] Quitado `VITE_SUPABASE_*` de `.env.example`.
- [x] `grep -r "supabase" src` = **vacío** (solo quedaban comentarios, ya limpiados).

> ✅ **CERRADO** (sesión 2026-07-06):
> 1. **`src/routeTree.gen.ts` regenerado** con el router-plugin (`npx vite dev` un momento). Ya no
>    referencia el borrado `/api/chat`: `grep -c "ApiChat\|api/chat" src/routeTree.gen.ts` = **0**.
> 2. `npx tsc --noEmit` **verde**. La regeneración destapó un error latente que el routeTree viejo
>    enmascaraba: `_app.menu.productos.tsx` leía `useSearch({strict:false}).editar` sin que ninguna
>    ruta declarara ese search param. Arreglado de forma idiomática: la ruta ahora declara
>    `validateSearch` con `editar: z.string().optional()` y usa `Route.useSearch()` (estilo del repo,
>    cf. `_app.bodega.inventario.index.tsx`). Comportamiento del deep-link `?editar=<id>` intacto.
> 3. ⏭️ **Verificación en app viva** (requiere `VITE_API_URL` → backend de Railway + login): pendiente
>    de correr manualmente — **chat** admin responde/usa tools; **espacios** ya no duplicados. El dev
>    server arranca limpio; el resto es runtime contra el backend.
> 4. `grep -i supabase src` = solo **comentarios** históricos (sin `supabase.` real); 0% data-access.

> 🔒 **Backend — fix de aislamiento por tenant (RLS)** — rama `talia:fix/rls-tenant-isolation` (PR aparte).
> Causa del bug "espacios duplicados": el backend conectaba como `postgres` (SUPERUSER+BYPASSRLS),
> anulando RLS → `GET /espacios` (y otras lecturas RLS-only) devolvían filas de **todos** los negocios.
> Fix: `withTenant` hace `SET LOCAL ROLE authenticated` + migración `0008_grant_authenticated.sql`
> (completa GRANTs). **Ya aplicado a la DB dev de Railway y validado** (cada negocio ve solo lo suyo).
> Al desplegar el backend, asegurar que `db:migrate` corre 0008 antes de servir con el código nuevo.

## Deploy del front en Railway — RESUELTO (desplegándose en Railway)

✅ **Decidido y en producción: el front se despliega en Railway** (node-server). No hay opción B.
El wrapper `@lovable.dev/vite-tanstack-config` incluye el plugin de Cloudflare solo para el sandbox
de Lovable; fuera de él, [`vite.config.ts`](vite.config.ts) fuerza `nitro: { preset: "node-server" }`,
que genera un server autónomo en `.output/server/index.mjs`. Config de deploy en
[`railway.json`](railway.json):
- **build** (nixpacks): `bun run build` → produce `.output/server/index.mjs`.
- **start**: `node .output/server/index.mjs` (escucha en `PORT` que inyecta Railway).
- **healthcheck**: `/`.

Requisitos de entorno en el servicio de Railway: `VITE_API_URL` (y `VITE_WS_URL`, `VITE_APP_ENV`)
apuntando al backend. El preview de Lovable sigue disponible como entorno de prueba alternativo.
