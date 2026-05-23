# Cierre manual de pedido

Cambiar el auto-cierre actual por un botón explícito **"Cerrar y liberar mesa"** que el mesero pulsa cuando ya no quedan items ni pagos pendientes.

## Backend

**Migración:**
- Quitar el bloque de auto-cierre dentro de `registrar_pago` y `confirmar_pago_transferencia` (la mesa ya no se libera sola). El estado del pedido sigue actualizándose a `PARCIAL` / items marcados `pagado_at`.
- Nueva RPC `cerrar_mesa(p_id_mesa uuid)` (SECURITY DEFINER) que valida:
  1. La mesa pertenece al negocio del caller.
  2. No existen `pedido_items` sin `pagado_at` en pedidos no PAGADO → si hay, error "Quedan items sin cobrar".
  3. No existen `pagos` con `estado_confirmacion = 'PENDIENTE'` para esa mesa → si hay, error "Hay transferencias por confirmar".
  4. Marca todos los pedidos abiertos como `PAGADO` + `pagado_at = now()`.
  5. Marca la mesa `LIBRE` y limpia `id_mesero_asignado`, `asignada_at`, `solicitud_*`, set `liberada_at`.

**Server function (`src/lib/pagos.functions.ts`):**
- `cerrarMesa({ idMesa })` que llama `rpc('cerrar_mesa')`.
- Extender `listarItemsCobrables` para devolver también `pendientesPago` (count de pagos PENDIENTE de la mesa) y `puedeCerrar` (boolean).

## Frontend

**`src/routes/_app.servicio.$idMesa.tsx`:**
- En el footer/acciones de la mesa, junto al botón "Pagar", añadir botón **"Cerrar y liberar mesa"**.
  - Visible siempre cuando hay pedidos abiertos.
  - Deshabilitado con tooltip explicando el motivo cuando: `totalPendiente > 0` ("Faltan items por cobrar") o `pendientesPago > 0` ("Hay transferencias por confirmar").
  - Habilitado en verde cuando todo OK.
- AlertDialog de confirmación → llama `cerrarMesa` → toast "Mesa liberada" → navegar a `/servicio`.

## Fix paralelo (silencioso)

En `listarPagosPendientes`, reemplazar el embed `mesas:id_mesa(identificador)` por un segundo query manual a `mesas` por `in('id_mesa', ids)` (resuelve el error "Could not find a relationship between 'pagos' and 'id_mesa'" por falta de FK declarada).
