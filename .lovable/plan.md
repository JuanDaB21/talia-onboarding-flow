# Tabs en Inventario

Convertir la página `/bodega/inventario` en una vista con dos tabs.

## Tab 1 — Stock
Muestra el contenido actual de `InventarioTab` (sin cambios funcionales).

## Tab 2 — Historial
Nueva vista que lista todos los movimientos de `movimientos_inventario` del negocio, no limitada a un insumo (a diferencia del historial ya existente en el detalle del insumo).

Columnas (reutilizando estilo de `HistorialMovimientosTable`):
- Fecha
- Insumo
- Tipo (Compra, Ajuste +/−, Venta, Consumo, Merma, etc.)
- Cantidad (con unidad del insumo)
- Anterior → Nuevo
- Motivo
- Usuario responsable

Filtros sobre la tabla:
- **Insumo**: `Select` con todos los insumos del negocio (orden alfabético) + opción "Todos".
- **Responsable**: `Select` con los usuarios de `usuarios_staff` que tengan movimientos + opción "Todos".
- Búsqueda libre opcional por motivo (nice-to-have, no crítico).

Comportamiento:
- Query a `movimientos_inventario` con joins a `insumos (nombre_insumo, unidad_receta)` y `usuarios_staff (id_usuario, nombre)`, ordenado por `created_at desc`, limit 200 (paginación simple "Cargar más" si la lista crece).
- RLS ya restringe por `id_negocio`.
- Loading con `LoadingState`, vacío con `EmptyState`.
- Realtime: suscripción a `movimientos_inventario` filtrada por `id_negocio` para refrescar.

## Cambios de archivos
- **Editar** `src/routes/_app.bodega.inventario.index.tsx`: envolver el contenido en `<Tabs>` (shadcn) con `TabsList` (Stock / Historial) y `TabsContent` renderizando `<InventarioTab />` y un nuevo `<HistorialInventarioTab />`. Mantener estado del tab activo en URL search param (`?tab=stock|historial`) usando `validateSearch` para que sea linkeable.
- **Crear** `src/components/bodega/historial-inventario-tab.tsx`: componente con los filtros + tabla + realtime.

Sin cambios de base de datos ni de lógica de negocio.
