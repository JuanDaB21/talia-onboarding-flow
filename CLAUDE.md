# CLAUDE.md — Memoria del front de Talia

> Lee este archivo primero. Evita re-explorar todo el código en cada sesión.
> Proceso de trabajo: `.claude/README.md`. Cutover y reglas de rama: `CUTOVER.md`.

## Qué es

Front de **Talia**, app web multi-tenant de gestión integral de restaurantes (SaaS). Cada
restaurante es un **tenant** (`id_negocio`). Módulos: carta pública (QR), servicio/meseros,
cocina/barra (estaciones), caja, bodega/inventario, menú/recetas, reservas, clientes,
configuración, dashboard e IA (asistente de solo lectura).

**Stack:** TanStack Start (React + TanStack Router + TanStack Query) · Vite · Tailwind +
shadcn/ui (Radix) · zod · Bun para el build. Desplegado en Railway (Nixpacks,
`node .output/server/index.mjs`).

## Topología: dos repos

| Repo | Qué es | Rama |
|---|---|---|
| **este** (`JuanDaB21/talia-onboarding-flow`) | front | `main` = Lovable · **`deployment` = la que se despliega** |
| `Jeftewan/talia-backend` | API Fastify + Postgres (Railway) | `main` |

El contrato compartido es `SPEC.md` **del repo del backend**. Este front consume esa API por
`VITE_API_URL` (REST) y `VITE_WS_URL` (WebSocket). **No hay Supabase en la capa de datos.**

## Reglas de oro

1. **Rama `deployment`.** `main` la edita Lovable contra Supabase. Todo lo desplegable vive en
   `deployment`. Al traer `main → deployment` se re-aplica el cutover (skill `merge-lovable`).
2. **Anti-regresión Supabase.** Todo acceso a datos pasa por `src/lib/*.functions.ts` →
   `@/lib/api-client`. Prohibido reintroducir `supabase.rpc()` / `.from()` para lógica de
   negocio. Hoy `src/` no tiene una sola referencia a Supabase: mantenlo así.
3. **Sin data-access en componentes** (contrato T5): los componentes llaman funciones de
   `src/lib/<modulo>.functions.ts`, nunca `fetch` ni `api.*` directo.
4. **Realtime incremental** (contrato P3): el evento parchea el cache de TanStack Query. Nunca
   `refetch()` total ni `invalidateQueries` de un módulo entero por cada evento.
5. **Multi-tenant:** el `id_negocio` viaja en el JWT; el front nunca lo manda como filtro de
   confianza. Si un endpoint lo pide, es porque el backend lo valida contra el token.

## Layout

```
src/
├── routes/             rutas de TanStack Router (file-based). `_app.*` = área autenticada,
│                       `carta.$idMesa` y `carta-publica.$idNegocio` = carta pública QR,
│                       `login` / `register`. `_app.tsx` monta el guard de rol (RoleRedirect).
├── lib/
│   ├── api-client.ts        fetch + JWT Bearer + refresh automático + timeout + ApiError
│   ├── auth.ts              login/register/logout/getMe/isAuthenticated (JWT propio)
│   ├── realtime-client.ts   WebSocket con API tipo Supabase: channel().on("postgres_changes")
│   ├── query-config.ts      presets de polling: REALTIME 10s · LIVE 15s · NORMAL 30s · SLOW 60s
│   ├── *.functions.ts       ← ÚNICA capa de acceso a datos (una por módulo)
│   └── *-schemas.ts         schemas zod de formularios
├── hooks/              use-auth-user, use-current-negocio, use-mi-staff, use-espacios, ...
├── components/         ui/ (shadcn) + una carpeta por módulo (servicio, caja, bodega, menu,
│                       reservas, preparacion, operacion, configuracion, dashboard, chat, ...)
└── server.ts / start.ts / router.tsx
```

`supabase/` en la raíz es **legado de referencia** (migraciones originales). No se usa en runtime.

## Convenciones que ya existen — respétalas

- **queryKeys:** `[<modulo>, <recurso>, ...filtros]` — ej. `["servicio","mesas",negocioId]`.
- **Presets de polling:** usa los de `query-config.ts`, no inventes intervalos. Todos desactivan
  el refetch con la pestaña en background.
- **Errores:** `ApiError` de `api-client`; el backend responde `{ error: { code, message } }`.
- **Sesión expirada:** `onAuthExpired` (EventTarget de `api-client`) — no manejes el 401 a mano
  en cada pantalla.
- **Imágenes:** `storage-image.tsx` + `image-compress.ts` antes de subir.

## Entorno

`.env` (gitignored) a partir de `.env.example`:
`VITE_API_URL` (con sufijo `/api`), `VITE_WS_URL` (**debe incluir `/realtime`**), `VITE_APP_ENV`.

## Comandos

```bash
npm run dev        # vite dev
npm run build      # vite build (Railway usa bun run build)
npm run lint
npm run format
```

## Metodología (skills, commands, agents)

Versionada en `.claude/` — ver `.claude/README.md`:

- **Skills:** `modulo-datos`, `realtime-incremental`, `merge-lovable`, `revision-front`, `ahorro-contexto`.
- **Commands:** `/merge-lovable`, `/contratos-front`, `/sync`.
- **Agent:** `revisor-front` (solo lectura).
- Sin hooks propios; nada de terceros se instala sin aprobación explícita.
