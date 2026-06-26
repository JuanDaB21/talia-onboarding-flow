## Vista resumida / detallada del pedido (mesero y admin)

En `src/routes/_app.servicio.$idMesa.tsx`, dentro del componente de tarjeta de pedido activo (`PedidoCard`), agregar un toggle de dos opciones —**Detallado** | **Resumen**— en el header de cada tarjeta de pedido. Por defecto: **Detallado** (comportamiento actual sin cambios).

### Detallado
Igual a hoy: lista de items con estado, acciones de editar/eliminar, alergia, extras, etc.

### Resumen
Lista compacta de líneas `Nombre x N`, agrupando items por la firma:
`id_producto + nota (normalizada) + extras (ordenados) + exclusiones (ordenadas) + variantes (ordenadas)`.

Formato de cada línea:
- Sin modificaciones: `Hamburguesa clásica x2`
- Con modificaciones: `Hamburguesa clásica (con nota) x1` y debajo, en texto pequeño, las modificaciones (`Nota: sin cebolla`, extras y variantes si los hay).

La etiqueta `(con nota)` aparece cuando el grupo tiene nota, extras, exclusiones o variantes — es decir, cualquier cosa que lo separe del item "base". El resumen es solo lectura: sin botones de editar/entregar/imprimir (esos siguen en Detallado).

### Cocina y barra
Sin cambios. La modificación es exclusiva de `_app.servicio.$idMesa.tsx`.

### Detalles técnicos
- Estado local `vista: "detallado" | "resumen"` por instancia de `PedidoCard` (`useState`).
- UI del toggle: `Tabs` de shadcn (ya usado en el proyecto) o un `ToggleGroup` pequeño junto al chevron del header.
- Función pura `agruparItemsResumen(items)` colocada en el mismo archivo (o en `src/lib/format.ts` si conviene reutilizar) que devuelve `{ key, nombre, cantidad, nota, extras, exclusiones, variantes, tieneModificaciones }[]`.
- Sin cambios en server functions, schemas, ni en preparación/cocina/barra.

### Archivos
- `src/routes/_app.servicio.$idMesa.tsx` — toggle + componente `ResumenList` + helper de agrupación.
