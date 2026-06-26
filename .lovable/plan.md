## Objetivo

Cambiar las "Variantes (opciones acompañantes)" de un producto para que cada opción apunte a un **insumo** (con cantidad por porción), igual que los Extras, en lugar de apuntar a otro producto del menú. Al confirmar el pedido, la opción seleccionada descuenta inventario del insumo elegido.

## Esquema de base de datos (migración)

Tabla `producto_variante_opciones`:

- Eliminar columna `id_producto_opcion` (FK a `productos`).
- Agregar `id_insumo_opcion uuid NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT`.
- Agregar `cantidad_porcion numeric NOT NULL CHECK (cantidad_porcion > 0)` (en `unidad_receta` del insumo).
- Mantener `precio_delta`, `orden`, `id_grupo`.

Tabla `pedido_item_variantes` (snapshot del pedido):

- Eliminar columna `id_producto_opcion`.
- Agregar `id_insumo_opcion uuid NULL` (snapshot débil, sin FK fuerte para no romper si se borra insumo).
- Agregar `cantidad_porcion numeric NOT NULL DEFAULT 0`.
- Mantener `nombre_grupo`, `nombre_opcion`, `precio_delta`, `id_grupo`, `id_opcion`.

Como ya confirmamos que hay 0 filas en ambas, se hace `DROP COLUMN` + `ADD COLUMN` limpio.

## RPC de descuento de inventario

Actualizar el/los RPC que confirman un pedido (igual lógica que se usa hoy para `pedido_item_extras` + receta del producto) para que también descuente `pedido_item_variantes.cantidad_porcion` del insumo `id_insumo_opcion` correspondiente, registrando un movimiento de inventario con motivo `VARIANTE`. Si el RPC actual recorre extras por item, se agrega un loop análogo para variantes.

## Server functions

`src/lib/variantes.functions.ts`:

- `listarVariantesProducto`: devolver `id_insumo_opcion`, `nombre_insumo`, `unidad_receta`, `cantidad_porcion`, `precio_delta` (join a `insumos` en vez de `productos`).
- `guardarVariantesProducto`: validar que cada opción tenga `id_insumo_opcion` (uuid) y `cantidad_porcion > 0`.
- Reemplazar `listarProductosParaVariantes` por `listarInsumosParaVariantes` (lista `id_insumo`, `nombre_insumo`, `unidad_receta`).

`src/lib/menu-schemas.ts`:

- `varianteOpcionSchema`: `id_insumo_opcion`, `cantidad_porcion`, `precio_delta`, `orden`.

`src/lib/servicio.functions.ts`, `prepedido.functions.ts`, `menu-publico.functions.ts`, `preparacion.functions.ts`:

- Reemplazar el join `productos:id_producto_opcion(nombre_producto)` por `insumos:id_insumo_opcion(nombre_insumo, unidad_receta)`.
- Renombrar campo expuesto `nombre_producto_opcion` → `nombre_opcion_insumo` (o reutilizar `nombre_opcion` directamente).
- En el snapshot al crear `pedido_item_variantes` guardar `id_insumo_opcion`, `cantidad_porcion`, `nombre_opcion` = nombre del insumo al momento.

## UI

`src/components/menu/variantes-builder.tsx`:

- Reemplazar `Select` de productos por un `Select` de insumos del negocio.
- Mostrar la unidad de receta junto al input de "Cantidad por porción" (ej. `50 g`).
- Mantener el input `+$` de `precio_delta`.
- Actualizar copy: "Cada opción consume un insumo y puede sumar un valor extra."

Vistas que consumen las variantes (`item-editor-sheet.tsx`, `prepedido-item-editor.tsx`, `prepedido-item-editor-staff.tsx`):

- Cambiar la etiqueta mostrada de `o.nombre_producto_opcion` al nuevo campo. Sin cambios funcionales en cómo se seleccionan ni en cómo se calculan los precios delta.

## Fuera de alcance

- Vistas de cocina y barra: ya muestran `nombre_grupo` + `nombre_opcion` (texto), no requieren cambios.
- Reportes y dashboards: no se tocan.
- Pagos, bonos, ajustes de caja: sin cambios.

## Cambia la ubicación

- Modifica para que las variantes estén alojadas en recetas, este debe ser el paso 5 de creación. 
- En la base de datos el dato de variante debe estar alojado en la receta