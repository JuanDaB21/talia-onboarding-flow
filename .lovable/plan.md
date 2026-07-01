Limpiar movimientos y stock del inventario del negocio **DINASTIA ROOFTOP** (`id_negocio = 7323d4f0-8b20-432b-abb4-a6ad3e7382a4`) en producción, sin tocar catálogo (insumos, proveedores, bodegas, compras).

## Alcance

- Negocio: solo `DINASTIA ROOFTOP`.
- Datos actuales: 49 filas en `inventario_bodega`, 53 filas en `movimientos_inventario`.

## Cambios a ejecutar (una sola transacción)

1. `DELETE FROM movimientos_inventario WHERE id_negocio = '7323d4f0-8b20-432b-abb4-a6ad3e7382a4';`
2. `UPDATE inventario_bodega SET cantidad_actual = 0, updated_at = now() WHERE id_negocio = '7323d4f0-8b20-432b-abb4-a6ad3e7382a4';`

Nada más se toca: `insumos`, `proveedores`, `bodegas`, `compras`, `detalle_compra`, `recetas`, `productos`, `pedidos`, etc. quedan intactos. El otro negocio `Dinastia` no se toca.

## Verificación posterior

- `SELECT COUNT(*) FROM movimientos_inventario WHERE id_negocio = '7323d4f0...'` → 0
- `SELECT COUNT(*) FILTER (WHERE cantidad_actual <> 0) FROM inventario_bodega WHERE id_negocio = '7323d4f0...'` → 0
- Confirmar que `Dinastia` (`fefe6ffe...`) mantiene sus contadores (1 mov, 1 inv).

Se ejecuta con la herramienta de escritura de datos (no es cambio de esquema).