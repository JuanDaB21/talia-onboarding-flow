## Funcionalidad: Múltiples bodegas

### Modelo de datos (migración)

Nuevas tablas:

- **`bodegas`**: `id_bodega`, `id_negocio`, `nombre`, `activa`, `orden`, timestamps. Unique `(id_negocio, nombre)`.
- **`espacios_bodega_principal`**: relación 1-a-1 `id_espacio → id_bodega` (la bodega de la que se descuenta el consumo de recetas del espacio). PK `id_espacio`. Vínculo bidireccional: editable desde el espacio o desde la bodega.
- **`inventario_bodega`** (reemplaza el rol de `inventario_actual` por bodega): `id_inventario`, `id_negocio`, `id_bodega`, `id_insumo`, `cantidad_actual`, timestamps. Unique `(id_bodega, id_insumo)`.
- **`movimientos_inventario`** agrega `id_bodega_origen uuid NULL`, `id_bodega_destino uuid NULL` y nuevo `tipo_movimiento = 'TRASLADO'`. Conserva trazabilidad (fecha, usuario, motivo).

`inventario_actual` se mantiene como **vista** sumando `inventario_bodega` por insumo para no romper código existente que lo lee (panel de inventario actual, alertas, dashboard).

`detalle_compra` agrega `id_bodega_destino` (NULL = usar la bodega global elegida en la compra; permite override por línea).

### Migración de datos existente

Por cada `id_negocio`:
1. Crear una bodega `"Bodega <Nombre Espacio>"` por cada espacio activo, marcando la primera como principal de ese espacio.
2. Mover todo el stock actual de `inventario_actual` a la bodega del **primer espacio del sistema** (Cocina por defecto). El usuario reorganiza después con traslados.
3. Trigger reemplazado: al crear un insumo nuevo, se inicializa fila en `inventario_bodega` para cada bodega activa con cantidad 0.

### Funciones RPC

- `crear_bodega(nombre)`, `renombrar_bodega`, `eliminar_bodega` (solo si stock = 0).
- `set_bodega_principal_espacio(id_espacio, id_bodega)` — usable desde ambos lados.
- `trasladar_inventario(id_insumo, id_bodega_origen, id_bodega_destino, cantidad, motivo)` — valida stock origen, crea 2 movimientos (SALIDA_TRASLADO, ENTRADA_TRASLADO) con `referencia_id` cruzada.
- `registrar_compra` extendida: nuevo parámetro `p_id_bodega_default uuid`; cada item puede traer `id_bodega_destino` opcional que sobrescribe.
- `descontar_inventario_item` extendido: descuenta de la bodega principal del **espacio del producto** (productos.destino → espacio → bodega principal). Si el espacio no tiene principal, error claro.
- `ajustar_stock_manual` recibe ahora `id_bodega`.

### Cambios UI

**Sidebar**: nueva entrada *Bodegas* bajo la sección Bodega (al final), ruta `/bodega/bodegas`.

**Ruta `/bodega/bodegas`** (admin):
- Lista de bodegas con estrella en las que son principales (y muestra de qué espacios).
- Crear/editar/eliminar bodega.
- Detalle de bodega: stock por insumo, espacios para los que es principal (editable: checkboxes con la lista de espacios), historial de movimientos de esa bodega, botón "Trasladar".
- Botón global "Nuevo traslado" (form: insumo, origen, destino, cantidad, motivo).

**Configuración › Espacios**: cada espacio muestra y permite cambiar su "Bodega principal" (selector con las bodegas del negocio). Edición bidireccional.

**Inventario actual (`/bodega/inventario`)**:
- Nueva columna **Ubicación** mostrando desglose por bodega: `3 cajas — Bodega Piso 11 · 2 cajas — Lobby`. En desktop tabla expandible; en móvil chips dentro de cada fila.
- Filtro por bodega.
- Al abrir el detalle de un insumo, se ven sus existencias por bodega y se puede iniciar un traslado.

**Compras (`/bodega/compras` › Nueva compra)**:
- Arriba: selector "Bodega destino" (default = principal del espacio del usuario, o primera bodega).
- Cada línea muestra esa bodega; un botón "Cambiar bodega" por línea permite override o dividir cantidades hacia varias bodegas (al dividir, se agrega otra línea del mismo insumo con la cantidad restante y otra bodega).

**Historial de movimientos**: nueva pill `Traslado` con flechas Origen → Destino. La página de detalle de insumo mantiene el historial agregado y agrega filtro por bodega.

### Permisos / RLS

- `bodegas`, `inventario_bodega`, `espacios_bodega_principal`: lectura para `authenticated` del negocio (`current_user_negocio()`); escritura para admins.
- Traslados los puede hacer cualquier staff con turno activo; quedan registrados con `id_usuario`.

### Verificación

- Migración aplica sin pérdida de stock total.
- `inventario_actual` (vista) sigue devolviendo cantidades agregadas correctas (panel de inventario y alertas sin cambios visuales fuera de la nueva columna).
- Registrar una compra con bodega global, otra con split por línea: ambas reflejan en `inventario_bodega` y generan movimientos.
- Crear un pedido en cocina y barra y confirmar que el consumo descuenta de la bodega principal del espacio correcto.
- Traslado entre bodegas: stock origen baja, destino sube, dos movimientos enlazados visibles en el historial.
- Renombrar bodega desde "Bodegas" y desde "Espacios" actualiza en ambos lados.
