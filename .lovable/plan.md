# Dashboard analítico con 4 paneles

Reestructurar `/dashboard` para que los KPIs actuales del día queden como cabecera resumen y debajo aparezcan 4 tabs especializados con métricas profundas del negocio.

## Estructura UI

```text
┌─────────────────────────────────────────────────┐
│  Dashboard · Resumen del día (KPIs actuales)    │
├─────────────────────────────────────────────────┤
│ [Rentabilidad] [Cliente] [Operación] [Alertas]  │
├─────────────────────────────────────────────────┤
│  Contenido del tab seleccionado                  │
└─────────────────────────────────────────────────┘
```

Tabs con `<Tabs>` de shadcn. Cada panel es un componente independiente que hace su propio `useQuery` a una server function dedicada (lazy: solo carga al activar el tab). Selector de rango (Hoy / 7d / 30d) global arriba de los tabs.

---

## 1. Panel de Rentabilidad — Ingeniería del Menú

Server fn: `getIngenieriaMenu({ rango })` en `src/lib/analytics.functions.ts`.

Cálculos por producto en el rango:
- **Unidades vendidas** = SUM(`pedido_items.cantidad`) con pedido CONFIRMADO/PAGADO.
- **Costo unitario** = SUM(`receta_detalle.cantidad * insumos.costo_promedio`) de la receta del producto.
- **Margen unitario** = `precio_venta − costo_unitario`.
- **Popularidad**: producto se considera *popular* si sus unidades ≥ 70% del promedio de unidades de los productos activos (regla estándar de menu engineering).
- **Rentabilidad**: producto se considera *rentable* si su margen unitario ≥ promedio de márgenes.

Cuadrantes resultantes: `STAR`, `PLOWHORSE` (caballito), `PUZZLE` (rompecabezas), `DOG`.

UI:
- Matriz 2x2 (scatter o grid de tarjetas por cuadrante) con conteo y top 3 platos por cuadrante.
- Tabla expandible con todos los productos: nombre, categoría, unidades, precio, costo, margen $, margen %, cuadrante (badge color).
- KPI grande: **Food Cost % global** = `SUM(costo * cantidad) / SUM(precio * cantidad)`. Semáforo: verde 28–33%, amarillo 33–38%, rojo >38% o <25%.

## 2. Panel de Comportamiento del Cliente

Server fn: `getComportamientoCliente({ rango })`.

- **Heatmap horas pico**: matriz `dia_semana × hora` (7×24) con conteo o $ de pedidos. Render con grid de celdas coloreadas por intensidad (oklch del primary con opacidad variable).
- **Ticket promedio por mesa**: `total_pagado / mesas_cerradas`.
- **Ticket promedio por persona**: por ahora = ticket por mesa (no hay campo de comensales en `pedidos`; añadir nota "estimado por mesa" y abrir issue para capturar comensales en futuro).
- **Tasa de upselling**: `% pedidos que incluyen al menos un pedido_item_extras` sobre total de pedidos.
- Tendencias mini-line chart de cada KPI vs período previo.

## 3. Panel de Eficiencia Operativa

Server fn: `getEficienciaOperativa({ rango })`.

- **Ciclo de mesa**: tiempo promedio entre primer pedido y `pedidos.pagado_at` por mesa. Histograma + promedio.
- **Eficiencia cocina/barra**: por item con `iniciado_at` y `listo_at`, comparar `(listo_at − iniciado_at)` vs `tiempo_planeado_min`. Devolver top 3 productos con mayor desviación absoluta (+ destino COCINA/BARRA).
- **Rendimiento por mesero** (rol = MESERO):
  - Mesas atendidas (distinct mesas en `pedidos` con `id_mesero`).
  - Tiempo de respuesta entrega: promedio `entregado_at − listo_at` por items de sus pedidos.
  - Total vendido: SUM(`pedidos.total`) PAGADO.
  - Tabla ordenable.

## 4. Panel de Alertas y Fugas

Server fn: `getAlertasFugas({ rango })` + reutiliza `getAlertasOperacion`.

- **Pedidos / items cancelados**: contar `pedido_items` con `estado_preparacion = 'CANCELADO'` (si no existe el estado, agregar nota "requiere campo de cancelación" y mostrar 0). Mostrar lista con motivo (campo `nota` de momento).
- **Desviación de inventario**: por insumo crítico, comparar `consumo_teorico` (SUM cantidad receta × unidades vendidas) vs `consumo_real` (SUM `movimientos_inventario` tipo SALIDA/AJUSTE NEG en el rango). Diferencia > 5% → fila roja.
- **Cuello de botella en cocina**: contador en vivo de items `EN_PREPARACION` y `EN_COLA` (refetch 10s). Si > umbral (10 items por defecto) → badge rojo pulsante.
- Estilos: cards con `border-destructive`, `bg-destructive/5`, íconos `AlertTriangle`.

---

## Detalles técnicos

**Archivos nuevos**:
- `src/lib/analytics.functions.ts` — 4 server fns (`getIngenieriaMenu`, `getComportamientoCliente`, `getEficienciaOperativa`, `getAlertasFugas`) con `requireSupabaseAuth` + AdminGate ya cubre acceso.
- `src/components/dashboard/rentabilidad-panel.tsx`
- `src/components/dashboard/cliente-panel.tsx`
- `src/components/dashboard/operacion-panel.tsx`
- `src/components/dashboard/alertas-panel.tsx`
- `src/components/dashboard/range-selector.tsx` (Hoy / 7d / 30d, estado en URL via search params).
- `src/components/dashboard/menu-matrix.tsx` (visual cuadrantes).
- `src/components/dashboard/heatmap.tsx` (grid 7×24).

**Archivo editado**:
- `src/routes/_app.dashboard.tsx` — añadir `<Tabs>` con los 4 paneles bajo los KPIs actuales. Usar `validateSearch` para `?rango=hoy|7d|30d&tab=rentabilidad|cliente|operacion|alertas`.

**No requiere migración de DB** — todas las queries usan tablas existentes (`pedidos`, `pedido_items`, `productos`, `receta_detalle`, `insumos`, `pedido_item_extras`, `mesas`, `movimientos_inventario`, `usuarios_staff`). Excepción: cancelaciones quedan como "0 / por implementar" si no existe el estado `CANCELADO`.

**Performance**: cada server fn agrupa en una sola pasada por tabla y devuelve objetos pre-agregados (no envía filas crudas). Refetch 60s salvo cuello de botella (10s).

## Fuera de alcance
- Captura de número de comensales por mesa (queda nota visible).
- Estado de cancelación de items si no existe (queda contador en 0 con nota).
- Exportación a CSV/PDF (puede sumarse después).
