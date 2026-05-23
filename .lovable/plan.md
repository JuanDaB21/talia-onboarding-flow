
# Fase 6.3: Preparación y Monitoreo (Cocina / Barra)

Tableros Kanban en tiempo real para que cocina y barra gestionen los items confirmados por el mesero, con contadores por item y alertas visuales cuando se excede el tiempo planeado.

## Alcance

- **Estaciones**: dos pantallas independientes — `/cocina` y `/barra`.
- **Estados Kanban** (4 columnas):
  1. `EN_COLA` — recién llegado (estado inicial al confirmar el pedido)
  2. `EN_PREPARACION` — el cocinero/bartender lo toma
  3. `LISTO` — terminado, esperando entrega
  4. `ENTREGADO` — el mesero lo retiró (sale del tablero, queda en histórico)
- Los estados Iniciado / Pedido / Confirmado / Pendiente de pago / Completado / Eliminado quedan **fuera** de este tablero (pertenecen a mesero/caja).

## Cambios de base de datos (migración)

1. **`receta_master`**: añadir `tiempo_preparacion_min integer NOT NULL DEFAULT 15` (> 0).
2. **`pedido_items`**: añadir
   - `estado_preparacion text NOT NULL DEFAULT 'EN_COLA'` con CHECK en `('EN_COLA','EN_PREPARACION','LISTO','ENTREGADO')`
   - `tiempo_planeado_min integer` — snapshot al confirmar (para cocina = tiempo de la receta; para barra = ⌈max(comida del mismo pedido)/2⌉, o tiempo propio si no hay comida)
   - `iniciado_at timestamptz` — al pasar a EN_PREPARACION
   - `listo_at timestamptz` — al pasar a LISTO
   - `entregado_at timestamptz` — al pasar a ENTREGADO
3. **`confirmar_pedido`** (actualizar función): además del snapshot de `destino`, calcular y guardar `tiempo_planeado_min` por item aplicando la regla de sincronización bebidas/comida.
4. **Nueva función** `avanzar_estado_item(p_id_item, p_nuevo_estado)` SECURITY DEFINER:
   - Valida transición permitida (solo avance secuencial).
   - Setea timestamps correspondientes.
   - Autoriza solo a roles `COCINERO`, `BARTENDER`, `MESERO` (entregar) o `ADMIN/SUPERADMIN`.
5. **Realtime**: ya está habilitado en `pedidos`; agregar `pedido_items` a la publicación `supabase_realtime` con `REPLICA IDENTITY FULL`.
6. **(Opcional según roles existentes)**: si `rol_staff` no incluye `COCINERO`/`BARTENDER`, agregarlos al enum. *Verificaré antes de la migración; si faltan, los añado.*

## Regla de tiempo (bebidas/comida)

Al ejecutar `confirmar_pedido`, para cada item del pedido:
- `tiempo_comida_max = MAX(receta.tiempo_preparacion_min)` entre items cuyo `destino='COCINA'` en ese pedido.
- Si item destino = COCINA → `tiempo_planeado_min = receta.tiempo_preparacion_min`.
- Si item destino = BARRA y existe comida → `tiempo_planeado_min = CEIL(tiempo_comida_max / 2)`.
- Si item destino = BARRA y no hay comida → `tiempo_planeado_min = receta.tiempo_preparacion_min`.

## Alerta visual

Calculada en cliente con `now() - iniciado_at`:
- Si item está en `EN_PREPARACION` y `transcurrido > tiempo_planeado_min` → tarjeta con borde rojo + badge "Retraso +Xmin".
- Si está en `EN_COLA` mucho tiempo (> tiempo_planeado_min sin iniciar) → badge amarillo "Sin tomar".
- Tick cada 30s para refrescar contadores.

## Frontend

### Configuración (Recetas)
- **`src/components/menu/receta-form.tsx`** (o el archivo equivalente del editor de receta): añadir input numérico `Tiempo de preparación (min)`.
- Actualizar `src/lib/menu.functions.ts` (`crear_receta` / `actualizar_receta`) — pasar el nuevo parámetro a las funciones SQL existentes (que también deberán recibirlo).

### Nuevas rutas y server functions
- **`src/lib/preparacion.functions.ts`** (nuevo):
  - `listarItemsEstacion({ destino })` → items activos (no entregados) de pedidos CONFIRMADOS del negocio, filtrados por destino, con datos de producto, mesa, extras, exclusiones, alergia, nota, tiempos.
  - `avanzarItem({ idItem, nuevoEstado })` → llama a `avanzar_estado_item`.
- **`src/routes/_app.cocina.tsx`** (nuevo): tablero Kanban filtrando `destino='COCINA'`.
- **`src/routes/_app.barra.tsx`** (nuevo): mismo componente, `destino='BARRA'`.
- Componente compartido **`src/components/preparacion/kanban-board.tsx`**:
  - 4 columnas, suscripción Realtime a `pedido_items` + `pedidos` para refrescar.
  - Tarjeta por item: producto, cantidad, mesa, badges de alergia/extras/exclusiones, nota, contador de tiempo, botones para avanzar al siguiente estado.
- **`src/components/preparacion/item-card.tsx`**: presentación de la tarjeta con cálculo de retraso.
- **Sidebar (`app-sidebar.tsx`)**: nuevo grupo "Preparación" con enlaces "Cocina" y "Barra", visibles según rol.

## Restricciones

- No se tocan: Compras, Inventario, Proveedores, Configuración/Mesas (salvo lo ya hecho), Pagos, Reportes.
- No se modifica el flujo de mesero (6.2) más allá de que el `confirmar_pedido` ahora también snapshotea tiempos.
- Solo se editan los archivos enumerados arriba más `categorias-master-detail` no requiere cambios.
- Sin sonidos, sin notificaciones push, sin toast cruzado a mesero.
- Sin mock data; los items vienen exclusivamente de pedidos reales confirmados.

## Resumen de archivos

**Nuevos**
- `supabase/migrations/<timestamp>_fase63_kanban.sql`
- `src/lib/preparacion.functions.ts`
- `src/routes/_app.cocina.tsx`
- `src/routes/_app.barra.tsx`
- `src/components/preparacion/kanban-board.tsx`
- `src/components/preparacion/item-card.tsx`

**Modificados**
- `src/components/app-sidebar.tsx` (grupo Preparación)
- Editor de receta + `src/lib/menu.functions.ts` o equivalente (campo tiempo_preparacion_min)
- `src/integrations/supabase/types.ts` (auto tras migración)
