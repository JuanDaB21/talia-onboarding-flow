# Auto-descuento de inventario al iniciar preparación

## 1. Backend — descuento automático

### Nueva función `descontar_inventario_item(p_id_item uuid)` (SECURITY DEFINER)
Toma un `pedido_items` y, **en la unidad de receta** (gramos, mililitros, unidades base):

1. Carga la receta del producto del item.
2. Para cada `receta_detalle (id_insumo, cantidad)`:
   - **Salta** los insumos presentes en `pedido_item_exclusiones` del item (cliente pidió "sin X").
   - Consumo = `cantidad_receta × item.cantidad` (cantidad siempre es 1 con la separación por unidad ya implementada, pero respetamos el campo).
3. Suma los `pedido_item_extras` del item (`cantidad_porcion × item.cantidad`) al insumo correspondiente.
4. Para cada insumo agregado: `SELECT ... FOR UPDATE` sobre `inventario_actual`, descuenta, registra `movimientos_inventario` con:
   - `tipo_movimiento = 'CONSUMO_PREPARACION'`
   - `cantidad = -consumo`
   - `referencia_id = id_item`
   - `motivo = 'Preparación item ' || id_item`
5. Permite stock negativo (no bloquea la cocina, solo lo refleja en `cantidad_actual`).

### Idempotencia
`avanzar_estado_item` y `iniciar_comanda_estacion` solo descuentan cuando el item transita por **primera vez** a `EN_PREPARACION` (guard `iniciado_at IS NULL` antes del UPDATE). Así no se duplica si se llama dos veces.

### Integración
- `avanzar_estado_item`: en la rama `EN_COLA → EN_PREPARACION`, ejecuta `PERFORM descontar_inventario_item(p_id_item)` antes del UPDATE.
- `iniciar_comanda_estacion`: hace un `FOR id IN SELECT id_item ...` de los items que va a transicionar y los descuenta uno a uno antes del bulk UPDATE.

### Realtime
La UI de bodega ya consulta `inventario_actual`. Para que el descuento se refleje en vivo, agregamos esa tabla a la publicación `supabase_realtime` y un canal en `inventario-tab.tsx` que invalida la query al recibir cambios.

## 2. Frontend — formato inteligente de cantidades

### Nueva utilidad `formatStockInteligente(cantidad, unidad_receta, unidad_compra, factor_conversion)` en `src/lib/unidades.ts`

Devuelve un string legible según la familia:

- **PESO** (cantidad en gramos): si `>= 1000` g → `"19 kg 750 g"`. Si `< 1000` → `"750 g"`. La unidad mayor se elige según `unidad_compra` (kg, lb u oz) cuando esté en la misma familia; default kg.
- **VOLUMEN** (cantidad en ml): análogo — `"3 L 250 ml"` o `"250 ml"`. Mayor según `unidad_compra` (Galón, Litro) cuando aplique.
- **UNIDAD con factor manual** (Caja, Paquete, Bandeja, Docena con `factor_conversion > 1`):
  - `enteras = floor(cantidad / factor)`, `sueltas = cantidad - enteras * factor`.
  - Resultado: `"2 cajas y 18 unidades"`, `"3 docenas"`, `"18 unidades"` según corresponda.
- **UNIDAD simple**: `"N unidades"` (singular si N=1).
- Decimales residuales se redondean a entero cuando es UNIDAD; en PESO/VOLUMEN se muestran con 0 decimales en la unidad menor.

### Aplicación
- `src/components/bodega/inventario-tab.tsx`: reemplazar `{Number(r.cantidad_actual).toLocaleString()} {labelDe(unidad_receta)}` por `formatStockInteligente(...)`. Igual para el umbral `stock_minimo`.
- `src/routes/_app.bodega.inventario.$id.tsx`: usar el helper para mostrar stock actual y en el historial de movimientos.

## 3. Detalles técnicos

```text
DB:
  - migración: CREATE FUNCTION descontar_inventario_item(uuid) ...
  - migración: REPLACE avanzar_estado_item + iniciar_comanda_estacion (mismo cuerpo + llamada)
  - migración: ALTER PUBLICATION supabase_realtime ADD TABLE inventario_actual
Frontend:
  - src/lib/unidades.ts  → formatStockInteligente()
  - src/components/bodega/inventario-tab.tsx  → render + canal realtime
  - src/routes/_app.bodega.inventario.$id.tsx → render
```

## Fuera de alcance
- Revertir el descuento si el item se cancela/elimina después de iniciar preparación (hoy `eliminar_item_pedido` ya bloquea borrar items que no estén `EN_COLA`, así que el caso no se da).
- Alertas push de stock bajo (lo dejamos solo en el badge existente).
