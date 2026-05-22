## Objetivo

Reestructurar la navegación de la app: la ruta `/` ahora será el login (si no hay sesión) o un dashboard inicial (si ya estás logeado), y todo el área autenticada compartirá un layout con un sidebar persistente al estilo ShadCN.

## Cambios

### 1. Ruta raíz `/` — `src/routes/index.tsx` (NUEVA)
- Comprueba sesión con `supabase.auth.getUser()`.
- Sin sesión → `<Navigate to="/login" replace />`.
- Con sesión → `<Navigate to="/dashboard" replace />`.
- Muestra un loader mientras chequea.

### 2. Layout autenticado pathless — `src/routes/_app.tsx` (NUEVO)
- Hace el chequeo de sesión una sola vez (mueve la lógica que hoy vive en `bodega.tsx`).
- Renderiza `SidebarProvider` + `AppSidebar` + `<Outlet/>` para todos los hijos.
- Header superior mínimo con `SidebarTrigger` (para colapsar) en mobile/desktop.

### 3. Sidebar — `src/components/app-sidebar.tsx` (NUEVO)
Usa el componente ShadCN `Sidebar` (`collapsible="icon"`).

- **Header (arriba):** logo + texto "Talia". El logo es un placeholder simple (ícono `ChefHat` de lucide dentro de un cuadro con `bg-primary`) hasta que se suba un asset real.
- **Content:** un único `SidebarGroup` con `SidebarGroupLabel="Bodega"` (no interactivo) y tres `SidebarMenuItem`:
  - Proveedores e Insumos → `/bodega/proveedores-insumos` (icon `Boxes`)
  - Compras → `/bodega/compras` (icon `ShoppingCart`)
  - Inventario → `/bodega/inventario` (icon `Warehouse`)
- Estado activo con `useRouterState` + `data-status="active"`.
- **Footer (abajo):** `SidebarMenuButton` con avatar + email + chevron, que abre un `DropdownMenu` con:
  - Email del usuario (header del menú, no clickeable).
  - "Cerrar sesión" → `supabase.auth.signOut()` y navega a `/login`.

### 4. Dashboard inicial — `src/routes/_app/dashboard.tsx` (NUEVO)
- Placeholder: título "Dashboard" + texto "Próximamente verás aquí un resumen de tu operación".
- Sin lógica de datos por ahora.

### 5. Mover rutas de Bodega bajo el layout `_app`
Renombrar (sin tocar contenido interno) para que hereden el sidebar:
- `bodega.tsx` → `_app/bodega.tsx` (eliminar el sidebar interno y el chequeo de auth; queda solo como wrapper con `<Outlet/>`, o se elimina y se aplanan los hijos).
- `bodega.index.tsx` → `_app/bodega.index.tsx`
- `bodega.proveedores-insumos.tsx` → `_app/bodega.proveedores-insumos.tsx`
- `bodega.compras.tsx` → `_app/bodega.compras.tsx`
- `bodega.compras.nueva.tsx` → `_app/bodega.compras.nueva.tsx`
- `bodega.inventario.tsx` → `_app/bodega.inventario.tsx`
- `bodega.inventario.$id.tsx` → `_app/bodega.inventario.$id.tsx`

Propuesta: eliminar el componente layout interno de `bodega.tsx` (ya no aporta porque el sidebar global cubre todo) y dejar `_app/bodega.tsx` solo como `() => <Outlet/>`. Las URLs públicas no cambian: siguen siendo `/bodega/proveedores-insumos`, etc.

### 6. `login.tsx` y `register.tsx`
- Tras login exitoso → navega a `/dashboard` (en lugar de `/bodega`).
- El chequeo "si ya hay sesión, redirige" pasa a `/dashboard`.

### 7. `__root.tsx`
- Solo ajustar los enlaces de los componentes 404/Error: `to="/"` en vez de `to="/login"` (la raíz ya decide).

## Fuera de alcance

- No se tocan migraciones, esquemas de DB, ni los formularios/CRUD de Proveedores, Insumos, Compras o Inventario.
- No se construye el contenido real del dashboard (solo placeholder).
- No se sube un logo real — se usa un ícono de lucide como placeholder.

## Detalles técnicos

- TanStack Router file-based: el guion bajo en `_app.tsx` lo convierte en pathless layout route; los hijos quedan en `src/routes/_app/*.tsx` y conservan sus URLs.
- El chequeo de auth se hace en el componente con `supabase.auth.getUser()` + estado local (mismo patrón que el `bodega.tsx` actual) para mantener consistencia con la app existente. No se introduce `beforeLoad`/router context para no expandir el alcance.
- `routeTree.gen.ts` se regenera automáticamente, no se edita a mano.
