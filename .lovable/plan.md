# Unificar detalle con el modal existente (Bodega)

## Objetivo

Reemplazar las páginas de detalle (`/bodega/proveedores/$id`, `/bodega/insumos/$id`) por el mismo `ResponsiveSheet` que ya se usa para "Nuevo". El sheet servirá tanto para crear como para editar/eliminar, mostrando el botón **Guardar cambios** sólo cuando haya cambios reales, y un botón **Eliminar** dentro del modal.

## Cambios

### 1. Formularios (lógica reutilizable)

- `src/components/bodega/proveedor-form.tsx` y `insumo-form.tsx`
  - Agregar prop opcional `onDelete?: () => void`.
  - Usar `formState.isDirty` de react-hook-form para deshabilitar el botón principal cuando no haya cambios (sólo en modo edición).
  - Cuando `isEdit && onDelete`, renderizar un botón **Eliminar** (variant `destructive`, ghost o secundario) dentro del footer del form, envuelto en `AlertDialog` de confirmación.
  - Conservar la lógica actual de insert/update.

### 2. Tabs (orquestación)

- `src/components/bodega/proveedores-tab.tsx` e `insumos-tab.tsx`
  - Quitar `useNavigate` y la navegación al detalle.
  - Estado `selected: Item | null` además de `open`.
  - Click en una fila → `setSelected(item); setOpen(true)`.
  - El `ResponsiveSheet` cambia título/descripcion según `selected` (Nuevo vs Editar).
  - Pasar `initialValues`, `idProveedor`/`idInsumo` y `onDelete` (que ejecuta `supabase.delete()` + cierra sheet + recarga) al form.

### 3. Eliminar rutas de detalle

- Borrar `src/routes/bodega.proveedores.$id.tsx`.
- Borrar `src/routes/bodega.insumos.$id.tsx`.
- TanStack Router regenerará `routeTree.gen.ts` automáticamente.

## Detalles técnicos

- `isDirty` se obtiene de `useForm({ defaultValues })`. Como los `defaultValues` provienen de `initialValues` (mismo objeto), `isDirty` será `false` hasta que el usuario edite un campo.
- El botón submit:
  - Crear: siempre habilitado (salvo `isSubmitting`).
  - Editar: `disabled={!isDirty || isSubmitting}`.
- La confirmación de borrado se mantiene con `AlertDialog` de shadcn dentro del form para no acoplar el tab a esa lógica.
- No se tocan migraciones, esquemas Zod, ni RLS.

## Fuera de alcance

- Cambios en `login`, `register`, `dashboard` o el resto de Bodega.
- Cambios visuales más allá de los necesarios para acomodar el botón Eliminar.
