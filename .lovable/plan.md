## Objetivo
Mejorar la vista del mesero en la toma de pedidos: agregar buscador de productos, separar visualmente catálogo vs. pedido, y arreglar desbordes en mobile cuando los nombres son largos.

## Cambios

### 1. Buscador de productos (catálogo)
En `PedidoAbiertoCard` (dentro de `src/routes/_app.servicio.$idMesa.tsx`) y en `AgregarProductoSheet` (`src/components/servicio/agregar-producto-sheet.tsx`):

- Agregar un `Input` con ícono `Search` arriba de las pills de categorías.
- Estado local `busqueda` que filtra `productos` por `nombre_producto` (normalizado, sin acentos, case-insensitive) **además** del filtro de categoría.
- Botón "X" para limpiar la búsqueda cuando hay texto.
- Si no hay resultados, mostrar un `EmptyState` corto: "Sin productos para "{q}"".

### 2. Reestructurar el `PedidoAbiertoCard` (la parte confusa)

Hoy el catálogo y el "pedido en curso" están lado a lado en desktop y apilados en mobile, dentro del MISMO card — eso es lo que se ve mezclado.

Nueva estructura:

- **Desktop (lg+):** mismo layout dos columnas, pero el aside del pedido pasa a `lg:sticky lg:top-4` con borde + fondo `bg-muted/30` y header propio "Pedido en curso · N items" para diferenciarlo del catálogo.
- **Mobile (< lg):** separar en dos secciones visualmente:
  1. Card "Catálogo" con buscador + pills + grid de productos.
  2. Barra **sticky bottom** (`fixed bottom-0` cuando hay items) tipo mini-resumen: muestra "N items · $total" + botón "Ver pedido" que abre un `Sheet` desde abajo con la lista editable y los botones "Imprimir" / "Confirmar y enviar".
  
  Esto elimina la mezcla visual: el catálogo ocupa toda la pantalla y el pedido vive en una hoja propia.

- Usar `useIsMobile()` (hook existente `src/hooks/use-mobile.tsx`) para decidir cuál renderizar.

### 3. Arreglar desbordes en mobile

Pasada de revisión a la jerarquía de la mesa en pantallas estrechas:

- `MesaHeader`: el grid `grid-cols-2 md:grid-cols-4` con `Stat` que usa `truncate` está OK, pero `value` muy largo (ej. nombre de mesero) puede empujar. Agregar `min-w-0` al wrapper de cada Stat y al div del mesero, y mover el botón "Cambiar" debajo en mobile (`flex-wrap`).
- `ItemRow`: el contenedor `<li>` necesita `min-w-0` en el `<div>` flex padre y `break-words` en el nombre del producto (ahora solo está en un `<span>` sin wrapping). Cambiar `<span>` por un bloque con `break-words` para que nombres largos partan línea en vez de empujar el precio fuera.
- `PedidoConfirmadoCard` header: agregar `min-w-0` al contenedor y `truncate` al `<h3>Pedido #N</h3>` row para que los badges no rompan layout.
- Pills de categoría: el contenedor `overflow-x-auto` ya está; agregar `scrollbar-none` y `-mx-4 px-4` cuando esté dentro del card para que pueda scrollear bajo los paddings.
- Botones de acción en `MesaHeader` (`justify-end`) → cambiar a `justify-stretch` en mobile con `flex-1` para que ocupen ancho completo y no se desborden.

### 4. Detalles técnicos

- Reutilizar componentes shadcn ya presentes: `Input`, `Sheet`, `Button`, `Badge`, `Separator`.
- Normalización de búsqueda: `s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()`.
- No tocar server functions ni lógica de pedidos — solo presentación.
- No tocar el `PrepedidoEnVivoCard` ni el flujo de cliente.

## Archivos a modificar

- `src/routes/_app.servicio.$idMesa.tsx` — buscador en `PedidoAbiertoCard`, restructura mobile con sheet, fixes de `min-w-0` / `break-words` / `truncate` en `MesaHeader`, `Stat`, `ItemRow`, `PedidoConfirmadoCard`.
- `src/components/servicio/agregar-producto-sheet.tsx` — buscador + filtro combinado.

## Fuera de alcance
- Cambios al pre-pedido del cliente.
- Cambios al backend o tipos de `getCatalogoServicio`.
- Cambios a la vista de cocina/barra.