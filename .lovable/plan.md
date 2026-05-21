# Plan: V1 Registro `/register` para Talia

Flujo de alta atómico Negocio + Usuario SUPERADMIN, mobile-first, con RPC transaccional en Supabase. Sin tocar lógica fuera de `/register`.

## Alcance

- Habilitar Lovable Cloud (provisiona Supabase + cliente en `src/integrations/supabase/`).
- Migración SQL: enums, tablas `negocio` y `usuarios_staff`, RLS, función `registrar_negocio_y_admin`.
- Ruta `/register` con wizard de 2 pasos, validación Zod + React Hook Form.
- Stubs mínimos `/login` y `/dashboard` (solo placeholder) para que el redirect post-registro funcione.
- Auto-confirm de email activado para que `signUp` devuelva sesión inmediata.

Fuera de alcance: diseño completo de `/login`, `/dashboard`, roles distintos a SUPERADMIN, subida real de logo (campo opcional, se deja `url_logo NULL` en V1).

## UX del wizard (`/register`)

Mobile-first usando solo breakpoints `sm md lg`. Card centrada, stepper superior (1 Cuenta · 2 Negocio), barra de progreso, botones Atrás / Siguiente / Crear cuenta.

- **Paso 1 — Cuenta**: `nombre`, `correo`, `contraseña` (+ confirmar). Validación en vivo; no avanza si hay errores.
- **Paso 2 — Negocio**: `nombre_comercial`, `razon_social`, `documento_tributario`, `telefono_contacto`, `direccion`. Logo omitido en V1.
- Estado de envío con loader, errores inline y toast global. Bloquea acceso si la RPC falla.

## Backend (SQL)

```sql
-- Enums
create type rol_staff as enum ('SUPERADMIN','ADMIN','MESERO','COCINA');
create type estado_staff as enum ('ACTIVO','INACTIVO','SUSPENDIDO');

-- NEGOCIO
create table public.negocio (
  id_negocio uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text not null,
  documento_tributario text not null,
  url_logo text,
  telefono_contacto text not null,
  direccion text not null,
  estado boolean not null default true,
  created_at timestamptz not null default now()
);

-- USUARIOS_STAFF
create table public.usuarios_staff (
  id_usuario uuid primary key references auth.users(id) on delete cascade,
  id_negocio uuid not null references public.negocio(id_negocio) on delete restrict,
  nombre text not null,
  correo text not null unique,
  rol rol_staff not null,
  estado estado_staff not null default 'ACTIVO',
  esta_en_turno boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.negocio enable row level security;
alter table public.usuarios_staff enable row level security;
-- Policies: cada staff lee/edita filas de su mismo id_negocio (SECURITY DEFINER helper).
```

### RPC transaccional

`registrar_negocio_y_admin(p_user_id uuid, p_nombre text, p_correo text, p_nombre_comercial text, p_razon_social text, p_documento_tributario text, p_telefono text, p_direccion text) returns uuid`

- `language plpgsql`, `security definer`, `set search_path = public`.
- Cuerpo en bloque `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE;` — todo el bloque corre en la misma transacción del cliente, por lo que cualquier fallo (FK, unique, check) hace ROLLBACK atómico.
- Paso 1: `INSERT INTO negocio (...) RETURNING id_negocio INTO v_id`.
- Paso 2: `INSERT INTO usuarios_staff (id_usuario, id_negocio, nombre, correo, rol) VALUES (p_user_id, v_id, p_nombre, p_correo, 'SUPERADMIN')`.
- `RETURN v_id`.
- `GRANT EXECUTE` a `authenticated` únicamente; valida internamente que `p_user_id = auth.uid()` para impedir suplantación.

### Garantía anti-huérfanos

- Si el `INSERT` de `usuarios_staff` falla, el `INSERT` previo de `negocio` se revierte automáticamente (misma transacción).
- Si `signUp` crea un `auth.users` pero la RPC falla: se muestra error y se bloquea avance. Riesgo residual mitigado con un trigger opcional en V2 que limpie `auth.users` huérfanos; en V1 se documenta y se permite reintento (el correo seguirá unique-libre porque no se insertó en `usuarios_staff`). Reintento desde el mismo formulario reusa el `user.id` ya creado iniciando sesión.

## Flujo frontend

1. Validar ambos pasos con Zod.
2. `supabase.auth.signUp({ email, password, options: { data: { nombre } } })`.
3. Con `data.user.id` → `supabase.rpc('registrar_negocio_y_admin', { ... })`.
4. Éxito → `navigate('/dashboard')`. Fallo → toast + mantener wizard.

## Archivos a crear / tocar

- `supabase` migration (vía herramienta de migraciones).
- `src/routes/register.tsx` (wizard).
- `src/components/register/Step1Cuenta.tsx`, `Step2Negocio.tsx`, `Stepper.tsx`.
- `src/lib/register-schemas.ts` (Zod).
- `src/routes/login.tsx` y `src/routes/dashboard.tsx` (stubs mínimos, no diseño).
- Cliente Supabase: generado automáticamente por Lovable Cloud en `src/integrations/supabase/`.

No se modifica ningún otro archivo existente.

## Detalles técnicos

- React Hook Form con `zodResolver`, modo `onChange` para validación en vivo.
- Componentes ShadCN: `Card`, `Input`, `Label`, `Button`, `Progress`, `Form`.
- Auto-confirm: se activará en Auth settings (Lovable Cloud) para evitar el paso de verificación en V1.
- RLS helper `has_negocio(uid uuid) returns uuid` con `security definer` para evitar recursión en policies.
