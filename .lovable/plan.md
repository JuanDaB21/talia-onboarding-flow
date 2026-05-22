## Problema

El stock en BD sí se está actualizando (Tomate = 65 tras dos compras), pero la vista de Inventario se ve vacía porque la consulta de Supabase usa el join embebido `insumos!inner(...)` y PostgREST responde con error 400:

> "Could not find a relationship between 'inventario_actual' and 'insumos' in the schema cache"

Las tablas `inventario_actual`, `detalle_compra`, `compras` y `movimientos_inventario` no tienen llaves foráneas declaradas hacia `insumos` / `proveedores` / `compras`, así que ningún join embebido funciona (afecta también al detalle de inventario, al modal de detalle de compra y al historial por insumo).

## Solución

### 1. Migración: añadir llaves foráneas faltantes
- `inventario_actual.id_insumo` → `insumos.id_insumo` (ON DELETE CASCADE)
- `inventario_actual.id_negocio` → `negocio.id_negocio`
- `detalle_compra.id_compra` → `compras.id_compra` (ON DELETE CASCADE)
- `detalle_compra.id_insumo` → `insumos.id_insumo`
- `compras.id_proveedor` → `proveedores.id_proveedor`
- `compras.id_negocio` → `negocio.id_negocio`
- `movimientos_inventario.id_insumo` → `insumos.id_insumo`
- `movimientos_inventario.id_negocio` → `negocio.id_negocio`

Se ejecuta `NOTIFY pgrst, 'reload schema'` al final para refrescar el caché de PostgREST.

### 2. Sin cambios de UI ni de lógica
La consulta del `InventarioTab` y los demás joins ya están bien escritos; con las FKs declaradas empezarán a resolver y la tabla mostrará el stock real en tiempo real.

## Verificación
- Recargar `/bodega/inventario` y confirmar que aparece "Tomate – 65".
- Abrir el detalle de un insumo (`/bodega/inventario/$id`) y validar que carga historial de compras y movimientos.
- Abrir el modal de detalle de una compra existente para confirmar el listado de ítems.
