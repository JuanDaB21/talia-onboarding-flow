# Turnos y acceso por rol

Añadir un sistema de turnos (Iniciar/Finalizar) para MESERO, COCINA y BARRA, con bloqueo de las pantallas operativas si el usuario no está en turno, y restringir el sidebar para que cada rol solo vea sus módulos.

## Backend

**Migración SQL:**
- RPC `iniciar_turno()` (SECURITY DEFINER, sin parámetros): toma `auth.uid()`, valida que el usuario sea staff del negocio y rol ∈ (MESERO, COCINA, BARRA, ADMIN), set `esta_en_turno = true`. Idempotente.
- RPC `finalizar_turno()`:
  1. Si rol = MESERO → cuenta mesas con `id_mesero_asignado = uid` y `estado <> 'LIBRE'`. Si > 0 → error `"No puedes salir de turno: tienes N mesa(s) con cuenta abierta"`.
  2. Set `esta_en_turno = false`.
- Nueva columna opcional `usuarios_staff.turno_iniciado_at timestamptz` para registro histórico (se actualiza en iniciar/finalizar, queda en NULL cuando está fuera de turno).

**Server functions (`src/lib/turno.functions.ts`, nuevo):**
- `iniciarTurno()` → `rpc('iniciar_turno')`.
- `finalizarTurno()` → `rpc('finalizar_turno')`, devuelve también lista de mesas bloqueantes cuando falla (consulta auxiliar antes de llamar la RPC para mostrar al usuario).
- `getMiStaff()` → devuelve `{ rol, esta_en_turno, turno_iniciado_at, nombre }` del usuario actual desde `usuarios_staff`.

## Frontend

**`src/hooks/use-mi-staff.ts` (nuevo):**
- Hook con `useQuery(['mi-staff'])` que llama `getMiStaff`. Expone `{ rol, enTurno, loading, refetch }`. Se invalida tras iniciar/finalizar turno.

**Gate de turno (`src/components/turno/turno-gate.tsx`, nuevo):**
- Wrapper que recibe `rolesRequeridos: ('MESERO'|'COCINA'|'BARRA')[]` y children.
- Si rol = ADMIN → pasa directo (admin no necesita turno).
- Si rol no incluido → redirige a `/` con toast "Sin acceso".
- Si rol incluido y `enTurno = false` → renderiza pantalla bloqueante con: icono grande, "Inicia tu turno para continuar", botón "Iniciar turno" que llama `iniciarTurno` + invalida hook + toast.
- Si `enTurno = true` → renderiza children.

**Aplicar gate:**
- `src/routes/_app.servicio.tsx` → envolver `<Outlet/>` con `<TurnoGate rolesRequeridos={['MESERO']}>`.
- `src/routes/_app.cocina.tsx` → `<TurnoGate rolesRequeridos={['COCINA']}>` alrededor del KanbanBoard.
- `src/routes/_app.barra.tsx` → `<TurnoGate rolesRequeridos={['BARRA']}>` alrededor del KanbanBoard.

**Sidebar por rol (`src/components/app-sidebar.tsx`):**
- Leer rol con `useMiStaff`.
- Mostrar grupos según matriz:
  - ADMIN: todos los grupos actuales.
  - MESERO: solo grupo "Servicio".
  - COCINA: solo grupo "Preparación" → item Cocina.
  - BARRA: solo grupo "Preparación" → item Barra.
- En el footer del perfil añadir, debajo de "Cerrar sesión", un item dinámico:
  - Si rol ≠ ADMIN y `enTurno = false` → **"Iniciar turno"** (verde) → llama `iniciarTurno`.
  - Si rol ≠ ADMIN y `enTurno = true` → **"Finalizar turno"** (rojo) → AlertDialog confirmando; si la RPC falla con mesas pendientes, muestra el conteo y bloquea.
  - Mostrar también badge "En turno desde HH:mm" cuando aplica.

**Redirección de entrada (`src/routes/_app.tsx`):**
- Tras validar sesión, si rol = MESERO redirigir a `/servicio`, COCINA → `/cocina`, BARRA → `/barra`, ADMIN se queda en `/dashboard` (comportamiento actual).
- Solo redirigir cuando el path actual es `/dashboard` o no pertenece a las rutas permitidas del rol.

## Resumen del flujo final

```text
Login → _app valida sesión → lee rol
  ├─ ADMIN  → /dashboard, sidebar completo
  ├─ MESERO → /servicio  → TurnoGate → si fuera de turno: pantalla "Iniciar turno"
  ├─ COCINA → /cocina    → TurnoGate (idem)
  └─ BARRA  → /barra     → TurnoGate (idem)

Footer perfil: botón Iniciar/Finalizar turno (no ADMIN)
Finalizar MESERO con mesas activas → bloqueado con mensaje
```

La lógica de asignación automática ya respeta `esta_en_turno` (RPC `asignar_mesero_a_mesa` existente), así que al cambiar este flag el algoritmo se ajusta solo.