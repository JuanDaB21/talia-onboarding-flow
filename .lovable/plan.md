## Nueva sección: Configuración → Usuarios (Mesas pendiente)

### 1. Sidebar
**`src/components/app-sidebar.tsx`**
- Agregar nuevo grupo "Configuración" con dos entradas:
  - `Usuarios` → `/configuracion/usuarios` (icono `Users`)
  - `Mesas` → `/configuracion/mesas` (icono `Utensils` o `LayoutGrid`)

### 2. Rutas
- **`src/routes/_app.configuracion.tsx`** — layout con `<Outlet />` (igual a `_app.bodega.tsx`/`_app.menu.tsx`).
- **`src/routes/_app.configuracion.index.tsx`** — redirige a `/configuracion/usuarios`.
- **`src/routes/_app.configuracion.usuarios.tsx`** — header "Usuarios" + `<UsuariosTab idNegocio={...} />`. Usa `useCurrentNegocio`.
- **`src/routes/_app.configuracion.mesas.tsx`** — placeholder "Próximamente".

### 3. Migración SQL
- `ALTER TYPE rol_staff ADD VALUE IF NOT EXISTS 'BARRA';` (roles permitidos en UI: ADMIN, MESERO, COCINA, BARRA — **SUPERADMIN nunca seleccionable**).
- Permitir DELETE en `usuarios_staff` solo para el mismo negocio y solo si el target NO es SUPERADMIN:
  ```sql
  CREATE POLICY staff_delete_own_negocio ON usuarios_staff
    FOR DELETE TO authenticated
    USING (id_negocio = current_user_negocio() AND rol <> 'SUPERADMIN');
  ```
- Ampliar `staff_update_self` o añadir `staff_update_own_negocio` para que un ADMIN/SUPERADMIN pueda cambiar `rol` y `estado` de otros usuarios del mismo negocio (excluyendo modificar SUPERADMIN).

### 4. Server functions (crear/eliminar usuario requieren service role)
**`src/lib/usuarios.functions.ts`** (con `requireSupabaseAuth` + `supabaseAdmin`):
- `crearUsuarioStaff({ nombre, correo, password, rol })`:
  1. Verificar que el caller pertenece a un negocio y que `rol ∈ {ADMIN, MESERO, COCINA, BARRA}`.
  2. `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`.
  3. `INSERT INTO usuarios_staff (id_usuario, id_negocio, nombre, correo, rol, estado='ACTIVO')`.
  4. Rollback (`auth.admin.deleteUser`) si el insert falla.
- `eliminarUsuarioStaff({ id_usuario })`:
  1. Verificar que el target pertenece al mismo `id_negocio` del caller y no es SUPERADMIN.
  2. `DELETE FROM usuarios_staff WHERE id_usuario = ...`.
  3. `supabaseAdmin.auth.admin.deleteUser(id_usuario)`.
- `actualizarUsuarioStaff({ id_usuario, nombre, rol, estado, password? })`:
  1. Verificar mismo negocio + target no SUPERADMIN + rol válido.
  2. `UPDATE usuarios_staff SET nombre, rol, estado WHERE id_usuario`.
  3. Si `password` no vacío → `supabaseAdmin.auth.admin.updateUserById(id_usuario, { password })`.

Validación con Zod (nombre 2–80, correo email, password ≥8 con may/min/num — reusar reglas de `register-schemas`).

### 5. UI — espejo de Proveedores
**`src/lib/configuracion-schemas.ts`** (nuevo)
- `rolStaffUiSchema = z.enum(['ADMIN','MESERO','COCINA','BARRA'])`.
- `usuarioCreateSchema`: nombre, correo, password (con reglas fuertes), rol, estado(bool→ACTIVO/INACTIVO).
- `usuarioUpdateSchema`: nombre, rol, estado, password opcional (vacío = no cambiar; si tiene valor aplicar reglas).

**`src/components/configuracion/usuarios-tab.tsx`** (espejo de `proveedores-tab.tsx`)
- Tabla con columnas: Nombre, Correo, Rol (Badge), Estado (Badge Activo/Inactivo).
- **Filtra SUPERADMIN del listado** (no se muestra).
- Botón "Nuevo" → abre `ResponsiveSheet` con `UsuarioForm`.
- Click en fila → editar.
- `load()` consulta `usuarios_staff` filtrando `rol <> 'SUPERADMIN'` y `order by created_at desc`.

**`src/components/configuracion/usuario-form.tsx`** (espejo de `proveedor-form.tsx`)
- Campos:
  - Nombre (input)
  - Correo (input, **readonly en modo edit**)
  - Password (input password) — requerido en create, opcional en edit con placeholder "Dejar en blanco para no cambiar"
  - Rol (`Select` con ADMIN/MESERO/COCINA/BARRA)
  - Switch "Estado activo" (mapea a ACTIVO/INACTIVO)
- Botones idénticos a proveedor-form: Cancelar / Eliminar (solo edit) / Guardar.
- Botón Guardar se habilita sólo si `isDirty` en modo edit (mismo patrón que proveedores).
- Llama a `crearUsuarioStaff` / `actualizarUsuarioStaff` / `eliminarUsuarioStaff` vía `useServerFn`.

### 6. Wiring serverFn
Confirmar que `src/start.ts` ya incluye `attachSupabaseAuth` (necesario para `requireSupabaseAuth`). Si no, agregarlo.

### Notas técnicas
- No se permite que el usuario edite su propio rol/estado desde esta UI (la lista se filtra ocultando al caller para evitar auto-degradación). Pequeña salvaguarda; opcional pero recomendada.
- La opción "Mesas" queda como ruta con placeholder; se implementará después.
- No se introducen cambios en módulos existentes (bodega/menu).
