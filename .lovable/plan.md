# Plan: Implementar `/login` para Talia

## Objetivo
Reemplazar el stub actual de `src/routes/login.tsx` por un formulario funcional de inicio de sesión con email + contraseña, consistente con el diseño del registro. No se altera nada del flujo `/register` ni de `/dashboard`.

## Alcance
- Solo se modifica `src/routes/login.tsx`.
- Sin cambios en backend, RPC, RLS, esquema, ni en `register.tsx`/`dashboard.tsx`.

## UX
- Card centrada, mobile-first, mismo estilo visual que `/register` (header con "Talia", `Card`, `CardHeader`, `CardContent`).
- Campos: correo, contraseña.
- Validación con Zod + React Hook Form (`mode: "onChange"`).
- Botón "Iniciar sesión" con estado `Loader2` mientras se procesa.
- Enlace al final: "¿No tienes cuenta? Crear cuenta" → `/register`.
- Toasts (`sonner`) para éxito y error.
- Si el usuario ya está autenticado al entrar a `/login`, redirigir a `/dashboard` (chequeo con `supabase.auth.getUser()` en `useEffect`).

## Lógica
1. `supabase.auth.signInWithPassword({ email, password })`.
2. Si error → `toast.error` con mensaje legible (mapear `Invalid login credentials` → "Correo o contraseña incorrectos").
3. Si éxito → `toast.success` + `navigate({ to: "/dashboard" })`.

## Esquema Zod (inline en el archivo, sin tocar `register-schemas.ts`)
```ts
const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo no válido").max(255),
  password: z.string().min(1, "Requerido").max(72),
});
```

## Archivos
- Editar: `src/routes/login.tsx` (reemplazo completo del stub).

## Fuera de alcance
- Recuperación de contraseña (`/reset-password`).
- OAuth (Google, etc.).
- Cambios en guards de ruta o en `__root.tsx`.
