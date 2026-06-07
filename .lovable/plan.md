# Imprimir comanda (Admin / Cocina / Barra)

Añadir un botón **Imprimir comanda** en las tres vistas que abren detalle de un pedido/comanda. El botón abre una ventana nueva con un layout optimizado para impresora térmica de 80–90 mm y dispara `window.print()`.

## Dónde aparece el botón

1. **Cocina** (`/cocina`): dentro del `ComandaSheet` que se abre al tocar una `ComandaCard` en el kanban. Imprime la comanda de **Cocina** (items con `destino = 'COCINA'`).
2. **Barra** (`/barra`): mismo `ComandaSheet`, imprime la comanda de **Barra**.
3. **Admin / Servicio mesa** (`/servicio/$idMesa`): un botón en la barra de acciones del pedido. A diferencia de Cocina/Barra, desde aquí se ve el pedido completo, así que se imprimen **dos comandas separadas** (una "Cocina" y otra "Barra") si hay items para cada destino — la cabecera de cada comanda lo dice claramente.

> Nota: si por "vista admin" se refieren a otra pantalla (p. ej. `/operacion` o `/dashboard`), avísame y la añado ahí también.

## Formato de la comanda impresa

Ancho fijo **90 mm** (configurable vía `@page { size: 90mm auto }` y `width: 90mm` en el contenedor). Diseño monoespaciado, alto contraste, sin colores.

Estructura:

```text
┌──────────────────────────┐
│        COCINA            │   ← grande, bold, destino
│   Nombre comercial       │
│   Mesa 5                 │
│   2026-06-07 14:32       │
│   Pedido #a1b2 · Mesero  │
├──────────────────────────┤
│ x2  Hamburguesa clásica  │
│     + Queso extra (1)    │
│     - Sin cebolla        │
│     ⚠ ALERGIA: maní      │
│     Nota: término medio  │
├──────────────────────────┤
│ x1  Papas fritas         │
│     Nota: extra sal      │
├──────────────────────────┤
│   ── Fin de comanda ──   │
└──────────────────────────┘
```

Reglas:
- Cabecera muestra **"COCINA"** o **"BARRA"** en grande (texto del destino, no del rol del usuario que imprime).
- Por cada item: cantidad, nombre, extras (con `+`), exclusiones (con `−`), alergia destacada, nota completa.
- En la vista admin, si hay items de ambos destinos, se imprimen dos hojas consecutivas (`page-break-after: always`) con encabezado distinto.

## Implementación técnica

- **Nuevo** `src/components/preparacion/comanda-print.ts`: helper `imprimirComanda({ destino, negocio, comanda })` y `imprimirComandasPedido({ negocio, pedido, items })`. Construye un documento HTML mínimo en un `window.open("", "_blank")`, escribe estilos `@media print` con `size: 90mm auto`, y llama `printWindow.print()` tras `onload`. Sin React, sin dependencias nuevas — solo `document.write` con escape de strings.
- **Editar** `src/components/preparacion/comanda-sheet.tsx`: añadir botón "Imprimir" (icono `Printer`) en el `SheetHeader`, junto al "Iniciar toda la comanda". Recibe `destino: "COCINA" | "BARRA"` como prop (lo pasa `KanbanBoard`).
- **Editar** `src/components/preparacion/kanban-board.tsx`: pasar la prop `destino` y `nombreNegocio` al `ComandaSheet`.
- **Editar** `src/routes/_app.servicio.$idMesa.tsx`: añadir botón "Imprimir comanda" en la barra de acciones del pedido activo. Reconstruye la estructura `ItemPreparacion[]` desde los datos ya cargados (items + extras + exclusiones + nota + alergia) agrupados por `destino`, y llama al helper para imprimir una hoja por destino con items.

Para el nombre comercial del negocio, reutilizar `negocio.nombre_comercial` (ya disponible vía `useCurrentNegocio` o se puede cargar una vez con un pequeño hook).

## Fuera de alcance
- Integración directa con impresoras ESC/POS (Bluetooth/USB). Se usa el diálogo de impresión nativo del navegador, que en kiosko/tablet conectado a impresora térmica funciona seleccionando esa impresora.
- Reimpresión automática al confirmar pedido — solo manual por ahora.
