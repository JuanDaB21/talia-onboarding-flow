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

**Cobertura del backend (a hoy):** listos `servicio` (incl. catálogo/opciones/sesión), `pagos`
(incl. pendientes/resumen-turno), `caja` (incl. getCierre), `menu`/`carta`, `preparacion`, `turno`,
`bodega` (incl. movimientos/compras/CRUD), `usuarios`, `negocio`, `reservas`, `prepedido` (público).
**Aún en Supabase** (backend no los expone): `analytics`, `bonos`, `metodos-pago`, `espacios`,
`variantes`, `admin`, `propinas`. REST y Supabase conviven hasta que el backend los cubra.

## Deploy del front en Railway — pendiente de decisión

⚠️ El build usa `@lovable.dev/vite-tanstack-config`, que **incluye el plugin de Cloudflare
(build-only)**. Para Railway (node-server) hay que **ejectar** ese wrapper en esta rama:
sustituirlo por la config estándar de TanStack Start + Vite con target de servidor Node, arrancar con
el server de Nitro, y neutralizar `wrangler.jsonc`. Alternativas:
- **(A)** Ejectar a node-server y desplegar en Railway (unifica todo en Railway; requiere validar el build).
- **(B)** Desplegar el front en **Cloudflare** (para lo que ya está armado) y dejar solo el backend en Railway.

Decidir con el backend ya desplegado. Mientras tanto, el front se puede probar desde el **preview de
Lovable** apuntando `VITE_API_URL` a la API de Railway.
