## Detalle de Inventario — agregar historial de movimientos

Sobre la vista actual de `/bodega/inventario/$id` (que ya muestra cantidad actual, datos del insumo, editar y ajustar stock, e historial de compras), añadir una nueva sección de **Historial de movimientos** que consolide todo lo que entra y sale del stock con su origen.

### Qué se construye

1. **Nuevo componente `historial-movimientos-table.tsx`** en `src/components/bodega/`:
   - Tabla con columnas: Fecha, Tipo (badge), Cantidad (+/- coloreado), Anterior → Nuevo, Motivo, Usuario.
   - Tipos soportados con badges semánticas:
     - `COMPRA` → verde "Compra" (entrada)
     - `AJUSTE_MANUAL` → ámbar "Ajuste" (suma o merma según signo)
     - `VENTA` / `CONSUMO` / `MERMA` → rojo (salida) — preparado por si el backend los introduce
   - Cantidad con signo: positivo en verde con `+`, negativo en rojo con `-`.
   - Estado vacío y skeleton de carga consistente con `historial-compras-table.tsx`.
   - Si el movimiento es de tipo `COMPRA` y tiene `referencia_id`, la fila es clicable y abre el `CompraDetailSheet` existente.

2. **Integración en `_app.bodega.inventario.$id.tsx`**:
   - Nuevo `loadMovimientos()` que consulta `movimientos_inventario` filtrado por `id_insumo`, ordenado por `created_at desc`, con join embebido a `usuarios_staff` para obtener el nombre del usuario:
     ```
     id_movimiento, created_at, tipo_movimiento, cantidad,
     cantidad_anterior, cantidad_nueva, motivo, referencia_id,
     usuarios_staff:id_usuario(nombre)
     ```
   - Nueva sección entre el bloque de stock y el historial de compras:
     - Título "Historial de movimientos" + subtítulo "Entradas, salidas y ajustes de este insumo".
     - Renderiza `<HistorialMovimientosTable />`.
   - Mantener el historial de compras como sección secundaria debajo (vista filtrada solo de compras, útil para precios y proveedores).
   - Refrescar `loadMovimientos()` también cuando el usuario ajuste stock (`setStockOpen` `onSuccess`) o edite el insumo.

3. **Realtime opcional (en la misma vista)**: suscribirse a `postgres_changes` sobre `movimientos_inventario` filtrado por `id_insumo` para que nuevas compras/ajustes aparezcan sin recargar. Limpieza del channel al desmontar.

### Backend

No requiere cambios de schema. La tabla `movimientos_inventario` ya registra `COMPRA` (vía `registrar_compra`) y `AJUSTE_MANUAL` (vía `ajustar_stock_manual`) con `cantidad_anterior`, `cantidad_nueva`, `motivo`, `id_usuario` y `referencia_id`. Falta solo la FK `movimientos_inventario.id_usuario → usuarios_staff.id_usuario` para que el join embebido resuelva — se añadirá en una migración corta (idempotente, `NOTIFY pgrst`).

### Lo que NO cambia

- Stock grande, breadcrumb, botones Editar/Modificar stock.
- Modal de detalle de compra (`CompraDetailSheet`) se reutiliza tal cual.
- Tabla actual de "Historial de compras" se conserva debajo de movimientos.

### Verificación

- Abrir `/bodega/inventario/<id de Tomate>`: debe aparecer la sección "Historial de movimientos" con las 2 compras previas (filas verdes `+`) y cualquier ajuste manual.
- Hacer un ajuste manual desde el botón → la fila aparece al instante encima.
- Registrar una nueva compra desde `/bodega/compras` que incluya este insumo → la fila `COMPRA` aparece sin recargar.
- Hacer clic en una fila `COMPRA` → abre el `CompraDetailSheet` con el detalle.
