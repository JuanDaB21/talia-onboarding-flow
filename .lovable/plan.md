## Objetivo

Cuando se piden N unidades iguales (ej. 2 hamburguesas con los mismos extras/exclusiones), guardarlas como **N filas separadas** en `pedido_items` (cada una con `cantidad = 1`) en vez de una sola fila con `cantidad = N`. Así cada unidad tiene su propio ciclo de preparación y su propio pago.

## Cambios

### 1. Backend (migración SQL)

Actualizar `public.agregar_item_pedido` para que, cuando `p_cantidad > 1`, ejecute un loop e inserte una fila por unidad en `pedido_items`, clonando en cada iteración los `pedido_item_extras` y `pedido_item_exclusiones` correspondientes. Cada fila queda con `cantidad = 1`. Devuelve el `id_item` de la primera (firma sin cambios).

Actualizar `public.editar_item_pedido`: como cada fila es 1 unidad, editar ya no cambia cantidad. Si llega `p_cantidad > 1`, validar y rechazar (o ignorar el parámetro). La UI de edición pasará a manejar solo nota/alergia.

No tocamos datos existentes (filas viejas con `cantidad > 1` siguen funcionando para la pantalla; los pedidos nuevos serán 1 por fila).

### 2. UI mesero — agregar item (`item-editor-sheet.tsx`)

Mantener el selector de cantidad (UX rápida), pero al enviar simplemente pasar `cantidad` al RPC; el backend se encargará de crear N filas. No requiere cambios funcionales aquí más allá de aclarar copy ("Se crearán N items independientes").

### 3. UI mesero — editar item (`editar-item-dialog.tsx`)

Quitar el control de cantidad (siempre es 1). Dejar solo nota y alergia.

### 4. UI listados — quitar el "×N"

Como cada fila es 1 unidad, reemplazar `{cantidad}×` por solo el nombre en:
- `src/routes/_app.servicio.$idMesa.tsx` (línea 672, 701 — el subtotal queda = `precio_unitario`)
- `src/components/servicio/pagar-sheet.tsx` (líneas 273, 314)
- `src/components/preparacion/comanda-card.tsx` (línea 81)
- `src/components/preparacion/comanda-sheet.tsx` (línea 200)
- `src/routes/carta.$idMesa.tsx` cuenta pública (línea 525) — mostrar cada unidad como ítem propio
- `src/lib/menu-publico.functions.ts` (`getCuentaPublica`) — el subtotal por fila ya no multiplica por `cantidad`

Para filas viejas con `cantidad > 1` mantener compatibilidad mostrando `×N` solo cuando `cantidad > 1`.

### 5. Preparación

`kanban-board.tsx` y `comanda-sheet.tsx` ya operan por `id_item`, así que cada unidad avanzará de estado independientemente sin cambios de lógica.

### 6. Pago

`pagar-sheet.tsx` y RPC `marcar_items_pagados` ya operan por `id_item`, así que cada unidad se podrá pagar por separado sin cambios.

## Resultado

- 2 hamburguesas iguales = 2 filas independientes.
- Cocina marca cada una EN_PREPARACION / LISTO por separado.
- Mesero cobra cada una por separado (una puede ir en efectivo, otra en datáfono).
- Totales y stock no cambian (siguen sumando precio × 1 por fila).
