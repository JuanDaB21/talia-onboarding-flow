## Objetivo
Permitir que el admin defina, por producto del menú, grupos de variantes (ej. "Tipo de papa") cuyas opciones son otros productos del catálogo, con selección única o múltiple y delta de precio sumado al plato.

## Modelo de datos

### Nuevas tablas (migración)

**`producto_variante_grupos`** — un grupo de variantes para un producto.
- `id_grupo` uuid PK
- `id_producto` uuid → productos (CASCADE)
- `nombre` text (ej. "Tipo de papa", texto libre del admin)
- `seleccion` text CHECK in (`UNICA`, `MULTIPLE`)
- `orden` int default 0
- `created_at`, `updated_at`

**`producto_variante_opciones`** — opciones dentro del grupo.
- `id_opcion` uuid PK
- `id_grupo` uuid → producto_variante_grupos (CASCADE)
- `id_producto_opcion` uuid → productos (RESTRICT) — el producto referenciado
- `precio_delta` numeric default 0 (suma al precio base del plato)
- `orden` int default 0
- UNIQUE(id_grupo, id_producto_opcion)
- `created_at`

**`pedido_item_variantes`** — variantes seleccionadas al pedir.
- `id_piv` uuid PK
- `id_item` uuid → pedido_items (CASCADE)
- `id_grupo` uuid → producto_variante_grupos (RESTRICT) (referencia informativa)
- `id_opcion` uuid → producto_variante_opciones (RESTRICT)
- `nombre_grupo` text (snapshot)
- `nombre_opcion` text (snapshot del nombre del producto opción)
- `precio_delta` numeric (snapshot)

`prepedido_items.variantes` JSONB ya existe-estilo `extras`/`exclusiones`; usaremos un campo nuevo `variantes jsonb default '[]'` con shape `[{ id_grupo, id_opcion, nombre_grupo, nombre_opcion, precio_delta }]`.

Todas con GRANT SELECT/INSERT/UPDATE/DELETE a `authenticated` + ALL a `service_role`, RLS scopeada por `current_user_negocio()` (vía join a productos / pedido_items según corresponda). No se da acceso a `anon` (lectura pública se hace por server fn publishable existente).

### Cómputo de precio

`precio_unitario` de `pedido_items` y `prepedido_items` queda como precio base. Las variantes suman su `precio_delta` (snapshot) al render del subtotal y al confirmar pedido. Se mantiene compatibilidad con items existentes sin variantes.

### Inventario

Cuando un pedido se confirma y un item tiene una opción de variante que apunta a un producto con receta, descontar también los insumos de la receta de ese producto-opción por la `cantidad` del item padre. Se modifica el trigger / server fn existente que descuenta inventario al confirmar (revisar `preparacion.functions.ts` y `servicio.functions.ts`).

## Cambios de backend

- `src/lib/menu-schemas.ts` — schemas Zod para `VarianteGrupoForm`, `VarianteOpcionForm`.
- `src/lib/productos.functions.ts` (o donde estén CRUD de productos — verificar) — nuevas server fns: `listarVariantesProducto`, `upsertGrupoVariante`, `eliminarGrupoVariante`, `upsertOpcionVariante`, `eliminarOpcionVariante`. Todas con `requireSupabaseAuth` + validación de pertenencia.
- `src/lib/menu-publico.functions.ts` — incluir variantes en el detalle público del producto (servidor publishable). Validar opciones permitidas por producto al agregar al prepedido.
- `src/lib/prepedido.functions.ts` — `agregarItemPrepedido`, `editarItemPrepedido` aceptan array `variantes` validado contra `producto_variante_opciones`; calcula y guarda snapshot.
- `src/lib/servicio.functions.ts` — al confirmar prepedido a pedido, copiar variantes a `pedido_item_variantes`. Incluir variantes en `getCatalogoServicio`/`obtenerMesaSesion` para mostrarlas en `ItemRow` y en el editor del mesero.
- `src/lib/preparacion.functions.ts` — incluir variantes en datos de comanda para que cocina/barra vean "Con: papa criolla". Ajustar descuento de inventario.

## Cambios de UI

### Configuración (admin)
- `src/components/menu/producto-form.tsx` — nueva sección "Variantes" (acordeón). Lista de grupos; por grupo: nombre, tipo (Única/Múltiple), botón eliminar. Dentro de cada grupo: lista de opciones con selector de producto (Combobox que busca en productos del negocio), input `precio_delta` (puede ser 0), botón eliminar. Botones "Agregar grupo" y "Agregar opción".
- Validaciones: no permitir referenciar el mismo producto que se edita; no duplicar opciones dentro de un grupo.

### Cliente (menú público)
- `src/components/menu-publico/producto-detalle-dialog.tsx` y `prepedido-item-editor.tsx` — renderizar los grupos de variantes:
  - Grupo `UNICA` → `RadioGroup` shadcn con opciones (nombre + "+$delta" si > 0).
  - Grupo `MULTIPLE` → lista de `Checkbox`.
  - Recalcular subtotal mostrando "Base + ∑ deltas × cantidad".
  - En estado se mantiene `variantes: Array<{ id_grupo, id_opcion }>` y se envía al server fn que ya valida y completa snapshot.

### Mesero (servicio)
- `src/components/servicio/item-editor-sheet.tsx` y `editar-item-dialog.tsx` — mismo control de variantes que el cliente.
- `src/routes/_app.servicio.$idMesa.tsx` `ItemRow` — mostrar `Con: papa criolla` debajo de extras/exclusiones (similar al patrón actual).
- `src/components/servicio/prepedido-item-editor-staff.tsx` — soportar variantes para edición de staff.

### Comanda / cocina
- `src/components/preparacion/comanda-print.ts` y `comanda-card.tsx` — agregar línea "▸ Con: <nombre opción>" por variante seleccionada, similar a extras.

## Pasos de implementación
1. Migración: crear tablas + GRANTs + RLS + columna `prepedido_items.variantes`.
2. Server fns CRUD de grupos/opciones + integración en lectura/escritura de pedidos y prepedidos.
3. UI de configuración en `producto-form.tsx`.
4. UI de selección en cliente (detalle + editor de prepedido).
5. UI de selección en mesero (item-editor-sheet, editor staff) y render en `ItemRow` + comanda.
6. Ajuste de descuento de inventario al confirmar pedido.

## Fuera de alcance
- Variantes ligadas a recetas en vez de productos.
- Reemplazo de precio (solo delta).
- Min/Max de opciones, obligatoriedad, cantidad por opción (puede agregarse después extendiendo `producto_variante_grupos`).
- Migración de los `extras_permitidos` existentes al nuevo modelo (siguen funcionando en paralelo).

## Notas técnicas
- Snapshot de nombre y precio en `pedido_item_variantes` protege contra cambios futuros al producto-opción.
- El producto-opción sigue siendo un producto normal; puede venderse suelto sin variantes.
- Indexar `producto_variante_opciones(id_grupo)` y `pedido_item_variantes(id_item)` para lectura.