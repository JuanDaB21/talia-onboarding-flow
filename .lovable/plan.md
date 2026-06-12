## Problema

El catálogo de unidades fuerza que `unidad_compra` y `unidad_receta` pertenezcan a la misma familia (PESO/VOLUMEN/UNIDAD). Esto rompe casos reales como:

- **Carne porcionada**: se compra por **Libra** (PESO) pero se vende/descuenta por **Unidad** porcionada (~350 g aprox, no exacto).
- Otros casos análogos: pollo entero comprado por kg y servido por presa, queso comprado por kg y servido en porciones, etc.

Hoy `insumoSchema.superRefine` rechaza la combinación y la UI auto-resetea `unidad_receta` al cambiar la familia de compra.

## Solución propuesta

Permitir **cross-family** cuando la `unidad_receta` es **Unidad** (la única que tiene sentido para porciones discretas), tratándolo como **factor manual** que el usuario ingresa: "¿Cuántas unidades porcionadas obtienes en promedio de 1 Libra/Kg/Litro?".

Para el caso del usuario:
- `unidad_compra = Libra`, `unidad_receta = Unidad`, `factor = 1.3` (≈ 1 lb / 350 g)
- Compra 10 lb → inventario sube 13 unidades porcionadas
- Cada item del menú descuenta 1 unidad del inventario

El cobro al cliente sigue siendo independiente (precio de venta del producto), así que no se ve afectado.

### Reglas

1. **Combinaciones permitidas**
   - Misma familia (comportamiento actual, factor auto/manual según hoy).
   - **Compra PESO/VOLUMEN/UNIDAD-manual → Receta `Unidad`** ⇒ factor manual con etiqueta "porciones por unidad de compra".
   - Sigue prohibido: PESO ↔ VOLUMEN, o Receta no-Unidad de distinta familia que compra.

2. **Factor** se almacena igual (`factor_conversion`, ya numérico) — solo cambia su interpretación cuando es cross-family-a-Unidad: "cuántas porciones promedio salen de 1 unidad de compra".

3. **Inventario, compras y consumo** ya operan multiplicando por `factor_conversion`; no necesitan cambios. La función `registrar_compra` ya hace `cantidad * factor` y guarda en unidades de receta. `descontar_inventario_item` consume en unidades de receta. Todo sigue funcionando.

4. **Visualización (`formatStockInteligente`)**: cuando receta = Unidad y compra es PESO/VOLUMEN, mostrar simplemente "N unidades" (no intentar combinar "2 libras y 3 unidades", porque la equivalencia es aproximada y confundiría). La unidad de compra se sigue mostrando en historial de compras como hoy.

## Cambios técnicos

### 1. `src/lib/unidades.ts`
- Nueva helper `combinacionPermitida(unidadCompra, unidadReceta): boolean` que codifica las reglas.
- `requiereFactorManual` ahora también devuelve `true` cuando es cross-family-a-Unidad.
- `calcularFactor` devuelve `null` (manual) para cross-family-a-Unidad.
- `unidadesDeFamilia` se complementa con un helper `unidadesPermitidasParaReceta(unidadCompra)` que incluye todas las de su familia **+ `Unidad`** si la compra no es ya UNIDAD-Unidad.

### 2. `src/lib/bodega-schemas.ts`
- Reemplazar el chequeo "misma familia" por `combinacionPermitida(...)`.

### 3. `src/components/bodega/insumo-form.tsx`
- Usar `unidadesPermitidasParaReceta(unidadCompra)` en el `Select` de unidad de receta (sin agrupar por familia cuando se mezclan; mostrar las de la familia y luego una sección "Otras → Unidad").
- Quitar el `useEffect` que fuerza el reset cuando cambia la familia; reemplazarlo por: si la combinación actual deja de ser permitida, setear a la unidad base de la familia de compra.
- Ajustar `factorHelp` para el caso cross-family-a-Unidad: "¿Cuántas unidades en promedio salen de 1 {labelCompra}? (puede ser aproximado)".
- Permitir editar el factor (input no deshabilitado) en este caso.

### 4. `src/lib/unidades.ts → formatStockInteligente`
- Branch adicional: si `unidad_receta = Unidad` y `unidad_compra` no es UNIDAD, formatear solo como "N unidades" (sin intentar reconstruir libras/kg desde el factor aproximado).

### 5. DB
- **Sin migración**. El esquema actual ya guarda `unidad_compra`, `unidad_receta` y `factor_conversion` como texto/numérico libre. Ninguna RPC valida familias; solo usan el factor.

## Casos de prueba mentales

1. Carne: compra Libra, receta Unidad, factor 1.3. Compra 10 lb → inventario = 13 u. Receta de "Bistec" usa 1 u → cobra precio_venta del producto. ✅
2. Tomate (sin cambios): compra Kilogramo, receta Gramo, factor 1000 auto. ✅
3. Caja de cervezas (sin cambios): compra Caja, receta Unidad, factor 24 manual. ✅
4. Inválido bloqueado: compra Litro, receta Gramo → schema rechaza. ✅

## Fuera de alcance

- Reportería de "merma" cuando la porción real difiere del promedio (futuro: ajuste manual de stock ya cubre el caso).
- Cambiar la forma de cobrar al cliente (sigue siendo `precio_venta` por producto).