## Problema
El campo `stock_minimo` se interpreta hoy en **unidades de receta** (ej. gramos, ml). El usuario lo capturó con la intención de **unidades de compra** (kg, lb, caja, etc.), que es la misma unidad de inventario y de las compras al proveedor.

## Objetivo
Tratar `stock_minimo` como un valor en **unidad de compra**, manteniendo los datos ya capturados pero re-interpretándolos correctamente. Las alarmas de stock bajo deben dispararse cuando el inventario disponible (convertido a unidad de compra) sea ≤ `stock_minimo`.

## Cambios

### 1. Migración de datos (sin perder valores)
Los valores actuales fueron digitados como números "razonables" en unidad de compra (ej. "5" pensando 5 kg), pero la app los guardó como si fueran 5 gramos. La columna sigue siendo `decimal(14,4)`, solo cambia el **significado**. Por lo tanto:

- **No se modifican los valores existentes** en `insumos.stock_minimo` — el número que el usuario escribió queda igual y ahora se interpreta como unidad de compra. Esto preserva exactamente lo que el usuario digitó.
- Se agrega un comentario a la columna documentando el cambio de unidad.

(Si en algún caso aislado el usuario hubiera escrito el valor en gramos a propósito, podrá editarlo manualmente; la app ahora muestra claramente la unidad en el formulario y en la vista de inventario.)

### 2. Formulario `InsumoForm`
- Etiqueta del campo: **"Stock mínimo (en {unidad_compra})"**, actualizada dinámicamente cuando cambia la unidad de compra (ej. "Stock mínimo (en Kilogramo)", "Stock mínimo (en Caja)").
- Texto de ayuda: "Se generará alerta cuando el inventario disponible sea menor o igual a este valor, expresado en {unidad de compra}."
- Sin cambios en el schema ni en cómo se guarda el número.

### 3. Lógica de alarmas (comparación)
Cambiar la comparación en todos los puntos donde se evalúa stock bajo. Hoy es:
```ts
cantidad_actual <= stock_minimo   // ambos asumidos en receta
```
Pasa a ser:
```ts
cantidad_actual <= stock_minimo * factor_conversion
```
porque `cantidad_actual` se mantiene en unidad de receta (no se toca el inventario) y `stock_minimo` ahora está en unidad de compra.

Archivos afectados:
- `src/components/bodega/inventario-tab.tsx` (filtro `low` y badge en tabla)
- `src/routes/_app.bodega.inventario.$id.tsx` (badge "Stock bajo" en detalle)
- `src/routes/api/chat.ts` (contexto que Talia usa para alertas: comparar con `stock_minimo * factor_conversion`, y reportar el mínimo en unidad de compra)

### 4. Presentación del "Stock mínimo"
Donde se muestra el stock mínimo, dejar de usar `formatStockInteligente` (que asume receta) y mostrarlo simple: `{stock_minimo} {labelDe(unidad_compra)}`. Aplica en:
- Tabla de inventario (columna "Stock mínimo")
- Cabecera del detalle de inventario ("Stock mínimo: …")
- Cualquier referencia en `insumos-tab.tsx` (texto de stock mínimo en la lista)

La "Cantidad disponible" sigue mostrándose con `formatStockInteligente` (en unidades de receta y compra combinadas, como ya funciona).

## Archivos a tocar
- Migración SQL: COMMENT ON COLUMN `public.insumos.stock_minimo`.
- `src/components/bodega/insumo-form.tsx` (label y helper text dinámicos).
- `src/components/bodega/inventario-tab.tsx` (comparación + presentación).
- `src/components/bodega/insumos-tab.tsx` (presentación de stock mínimo).
- `src/routes/_app.bodega.inventario.$id.tsx` (comparación + presentación).
- `src/routes/api/chat.ts` (comparación y unidad reportada en el contexto a Talia).

## Lo que NO se toca
- Datos de `insumos.stock_minimo` (se preservan tal cual).
- `inventario_actual.cantidad_actual` ni `factor_conversion`.
- Schemas Zod ni columna en BD (mismo tipo y default).
- Recetas, compras, movimientos.
