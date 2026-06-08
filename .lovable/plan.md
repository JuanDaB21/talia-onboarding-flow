## Nuevo rol: CAJERO

Agregar un rol `CAJERO` que pueda crearse desde Configuración → Usuarios y que tenga acceso a Operación, Mesas en servicio y Caja.

### 1. Base de datos
- Migración: `ALTER TYPE rol_staff ADD VALUE IF NOT EXISTS 'CAJERO';`

### 2. Esquemas y tipos
- `src/lib/configuracion-schemas.ts`: añadir `"CAJERO"` a `ROLES_UI`.
- `src/lib/usuarios.functions.ts`: añadir `"CAJERO"` al `ROLES_UI` local.
- `src/components/configuracion/usuarios-tab.tsx`: extender el union de `rol` para incluir `"CAJERO"`.
- Los tipos generados de Supabase se regeneran solos tras la migración.

### 3. Formulario de usuarios
- `usuario-form.tsx` ya mapea `ROLES_UI`, así que el nuevo rol aparecerá automáticamente en el `Select` al actualizar el array. Añadir etiqueta legible si hace falta (e.g. "Cajero").

### 4. Sidebar (visibilidad por rol)
`src/components/app-sidebar.tsx` → `gruposPorRol`:
- Para `CAJERO`:
  - `admin: true` pero filtrando `ADMIN_NAV` para mostrar solo **Caja** (ocultar Dashboard).
  - `servicio: true` para mostrar el grupo Servicio con **Operación** y **Mesas en servicio** (ocultar Cocina/Barra).
- Implementación: cambiar `gruposPorRol` para devolver además qué items del grupo mostrar, o introducir una función `itemsPermitidos(rol, item)` que filtra por `to` similar a lo que ya se hace para meseros/cocina/barra en Servicio.
- `mostrarTurno`: incluir `CAJERO` para que pueda iniciar/finalizar turno (consistente con los otros roles operativos).

### 5. Gates de acceso
- `src/components/admin/admin-gate.tsx`: actualmente bloquea todo lo que no sea ADMIN/SUPERADMIN. Las páginas `/operacion`, `/caja`, `/caja/cierre`, `/caja/cierres/$id` usan `AdminGate`.
  - Opción elegida: crear un `RoleGate` reutilizable que reciba `roles: Rol[]` y reemplazar `AdminGate` en `/operacion`, `/caja/*` por `<RoleGate roles={["ADMIN","SUPERADMIN","CAJERO"]}>`. Mantener `AdminGate` para módulos solo-admin (Configuración).
- `src/lib/pagos.functions.ts` (`confirmarPago`) y cualquier server fn que valide `esAdmin` y sea necesaria para cajero: ampliar el chequeo a `["ADMIN","SUPERADMIN","CAJERO"]` para que el cajero pueda aprobar/rechazar pagos desde Operación y operar caja.
- `src/lib/servicio.functions.ts` y `src/lib/bonos.functions.ts` se mantienen restringidos a ADMIN (cajero no administra mesas ni bonos), salvo que se requiera lo contrario.

### 6. Configuración
- `src/routes/_app.configuracion.*`: sigue protegido por AdminGate (solo ADMIN crea usuarios), por lo que cajero no verá Configuración. No requiere cambios.

### Resumen de cambios
- 1 migración SQL.
- Edición de: `configuracion-schemas.ts`, `usuarios.functions.ts`, `usuarios-tab.tsx`, `app-sidebar.tsx`, `pagos.functions.ts`.
- Nuevo componente: `src/components/admin/role-gate.tsx`.
- Reemplazo de `<AdminGate>` por `<RoleGate>` en `_app.operacion.tsx`, `_app.caja.index.tsx`, `_app.caja.cierre.tsx`, `_app.caja.cierres.$id.tsx`.
