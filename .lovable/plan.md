# Módulo Inventario — Bodega

Implementación de la vista de Inventario, búsqueda/filtros, ruta dedicada de detalle por insumo con historial de compras multi-proveedor, y ajuste manual de stock con auditoría.

## Backend (migración Supabase)

Las tablas `inventario_actual`, `compras`, `detalle_compra` y `movimientos_inventario` aún no existen. Se crean con RLS por `id_negocio` (mismo patrón que `insumos`/`proveedores`).

- **inventario_actual**: `id_insumo` (PK), `id_negocio`, `cantidad_actual`, `ultima_actualizacion`. Trigger para auto-insertar fila al crear un insumo.
- **compras**: `id_compra` (PK), `id_negocio`, `id_proveedor`, `numero_factura`, `fecha_compra`, `estado`, `total`.
- **detalle_compra**: `id_detalle` (PK), `id_compra`, `id_insumo`, `cantidad`, `precio_unitario_compra`, `subtotal`.
- **movimientos_inventario**: `id_movimiento`, `id_negocio`, `id_insumo`, `tipo_movimiento` (enum: `COMPRA`, `AJUSTE_MANUAL`, `CONSUMO`, `MERMA`), `cantidad`, `cantidad_anterior`, `cantidad_nueva`, `motivo`, `id_usuario`, `created_at`.
- **RPC `ajustar_stock_manual(id_insumo, nueva_cantidad, motivo)`**: actualiza `inventario_actual.cantidad_actual` e inserta movimiento de auditoría en una sola transacción.
- Datos seed mínimos (opcional): filas de `inventario_actual` para insumos existentes vía backfill en la migración.

## Frontend

Toda la UI se queda dentro de `src/components/bodega/` y `src/routes/bodega.*`. Reutiliza `ResponsiveSheet`, `InsumoForm` y los componentes de tabla ya existentes.

### 1. Tabla de Inventario — `/bodega/inventario`

Reemplaza el placeholder de `src/routes/bodega.inventario.tsx` por un nuevo componente `InventarioTab`:

- Consulta `inventario_actual` con JOIN a `insumos` (`select("cantidad_actual, insumos!inner(id_insumo, nombre_insumo, unidad_medida, stock_minimo)")`).
- **Buscador**: `<Input>` con filtrado en tiempo real por `nombre_insumo` (lower-case includes).
- **Filtros** (`<Select>` shadcn):
  - Unidad de medida (opciones derivadas de los datos cargados).
  - Estado de stock: Todos / Stock bajo (`cantidad_actual <= stock_minimo`) / Sin alerta.
- **Columnas**: Insumo · Cantidad actual · Unidad · Stock mínimo · Badge "Alerta" cuando aplica.
- Click en fila → `navigate({ to: "/bodega/inventario/$id", params: { id: id_insumo } })`.
- Misma estética de tabla que `InsumosTab` / `ProveedoresTab`.

### 2. Navegación cruzada Insumo → Inventario

En `InsumoForm` (modal de edición), agregar botón secundario **"Ver en Inventario"** (solo en modo edición) que navega a `/bodega/inventario/$id` y cierra el sheet.

### 3. Ruta dedicada de detalle — `/bodega/inventario/$id`

Nuevo archivo `src/routes/bodega.inventario.$id.tsx` con loader que trae insumo + inventario.

Layout:
- **Header**: nombre del insumo + breadcrumb "Inventario / {nombre}".
- **Hero**: `cantidad_actual` en tamaño gigante (e.g. `text-7xl font-bold`) con `unidad_medida` al lado. Badge de alerta si `<= stock_minimo`.
- **Acciones rápidas** (dos botones):
  - "Editar insumo" → abre `ResponsiveSheet` con `InsumoForm` precargado (reutilizando el componente existente).
  - "Modificar stock actual" → abre `ResponsiveSheet` con nuevo `AjustarStockForm` (campos: modo *Nueva cantidad* o *Diferencial*, motivo). Llama al RPC `ajustar_stock_manual`.
- **Historial de compras** (tabla): consulta a `detalle_compra` filtrada por `id_insumo`, con JOIN a `compras` y `proveedores`. Orden cronológico descendente. Columnas: Fecha · # Factura · Proveedor · Cantidad · Valor unitario. Click en fila → abre Sheet de detalle de compra.

### 4. Sheet de Detalle de Compra (nivel final)

Nuevo componente `CompraDetailSheet` montado en la página de detalle. Usa `ResponsiveSheet` existente (ya maneja `side="right"` en desktop y `side="bottom"` en mobile).

Contenido: cabecera de compra (proveedor, fecha, # factura, estado, total) + tabla de todos los `detalle_compra` de esa compra. Al cerrar, el usuario permanece en `/bodega/inventario/$id`.

## Componentes nuevos / modificados

| Archivo | Acción |
|---|---|
| `src/components/bodega/inventario-tab.tsx` | nuevo |
| `src/components/bodega/ajustar-stock-form.tsx` | nuevo |
| `src/components/bodega/compra-detail-sheet.tsx` | nuevo |
| `src/components/bodega/historial-compras-table.tsx` | nuevo |
| `src/routes/bodega.inventario.tsx` | reemplazar placeholder → renderiza `InventarioTab` |
| `src/routes/bodega.inventario.$id.tsx` | nuevo (página de detalle) |
| `src/components/bodega/insumo-form.tsx` | agregar botón "Ver en Inventario" en modo edición |

No se tocan: rutas de auth, `__root.tsx`, componentes de Proveedores ni CRUD de Insumos (solo se extiende `InsumoForm` con un botón).

## Orden de ejecución

1. Migración Supabase (tablas + RLS + RPC + trigger backfill).
2. Componentes de tabla y filtros (`InventarioTab`).
3. Ruta de detalle + hero + acciones.
4. Historial de compras + Sheet de detalle de compra.
5. Botón cruzado en `InsumoForm`.
