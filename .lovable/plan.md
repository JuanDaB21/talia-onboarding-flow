# Cuentas divididas y flujo de pago

## Objetivo
Al pulsar "Pagar cuenta" en la mesa, el mesero ve el consolidado de items, selecciona cuáles cobra en este pago (cuenta dividida por productos), elige método de pago y cierra. Cuando todos los items quedan pagados, la mesa vuelve a LIBRE y se guarda el histórico.

## Flujo UX

1. **Botón "Pagar cuenta"** en la vista de mesa abre un **Sheet de cobro** (en vez del dialog actual).
2. **Selector de items**: lista plana de todos los items de la mesa con estado `ENTREGADO` (o ya entregables), con checkbox.
   - Al marcar, se suma en vivo al **total a cobrar** (sticky abajo).
   - Botones rápidos: "Seleccionar todo", "Limpiar".
   - Items ya pagados aparecen deshabilitados con badge "Pagado".
3. **Paso 2 — Método de pago** (después de "Continuar"):
   - **Efectivo**: input de monto recibido (opcional) → muestra cambio.
   - **Transferencia**: selector (Nequi / Daviplata / Bancolombia / Otro) + **subir foto del comprobante** (cámara o galería).
   - **Datáfono**: selector (Débito / Crédito) + campo "N° voucher".
4. **Confirmar pago** → registra el pago, marca los items seleccionados como pagados, y:
   - Si transferencia → notifica al admin (badge realtime + toast).
   - Si quedan items pendientes → vuelve al paso 1 con los restantes.
   - Si no quedan items → cierra la mesa (estado `LIBRE`) y navega a `/servicio`.
5. **Vista del admin** (`/servicio` o nueva pestaña "Pagos pendientes"): badge con transferencias sin confirmar; al abrir, ve la foto y aprueba/rechaza.

## Cambios en base de datos

Tablas nuevas:

- **`pagos`**: `id_pago`, `id_mesa`, `id_negocio`, `id_mesero`, `metodo` (`EFECTIVO|TRANSFERENCIA|DATAFONO`), `subtipo` (Nequi/Daviplata/Débito/etc), `monto`, `voucher`, `url_comprobante`, `estado_confirmacion` (`CONFIRMADO|PENDIENTE|RECHAZADO`), `confirmado_por`, `confirmado_at`, `created_at`.
- **`pago_items`**: `id_pago`, `id_item` (UNIQUE en `id_item` → un item solo se paga una vez).

Columnas nuevas:
- `pedido_items.pagado_at`, `pedido_items.id_pago` (derivado).
- `pedidos.estado` añade valor `PARCIAL` (cuando algunos items pagados, otros no).

RPCs nuevas:
- `registrar_pago(p_id_mesa, p_metodo, p_subtipo, p_monto, p_voucher, p_url_comprobante, p_item_ids[])` → crea fila en `pagos` + `pago_items`, marca items, actualiza estado del pedido, si todos los items de la mesa quedan pagados → marca pedidos como `PAGADO` y mesa como `LIBRE` (reutiliza lógica de `cerrar_cuenta_mesa`). Estado del pago = `CONFIRMADO` salvo transferencia → `PENDIENTE`.
- `confirmar_pago_transferencia(p_id_pago, p_aprobar bool)` → solo ADMIN/SUPERADMIN; marca `CONFIRMADO` o `RECHAZADO`.
- `listar_pagos_pendientes_confirmacion()` → ADMIN.

Storage:
- Bucket **`comprobantes-pago`** (privado), políticas: insert por mesero del negocio, select por staff del mismo negocio.

## Server functions (`src/lib/pagos.functions.ts` nuevo)

- `listarItemsCobrables({ idMesa })` → items entregables agrupados, con flag `pagado`.
- `subirComprobante({ base64, mime })` → sube a storage, devuelve URL firmada/pública.
- `registrarPago({ idMesa, metodo, subtipo, monto, voucher, urlComprobante, itemIds })`.
- `listarPagosPendientes()` (admin).
- `confirmarPago({ idPago, aprobar })` (admin).
- `resumenCajaTurno()` → totales por método del mesero en su turno (efectivo, transferencia confirmada, datáfono).

## Frontend

Nuevos componentes en `src/components/servicio/`:
- `pagar-sheet.tsx` (reemplaza el dialog de cobrar): pasos selección → método → confirmación.
- `paso-seleccion-items.tsx`.
- `paso-metodo-pago.tsx` con sub-componentes `forma-efectivo`, `forma-transferencia` (incluye input `<input type="file" accept="image/*" capture="environment">`), `forma-datafono`.
- `caja-turno-card.tsx`: pequeña tarjeta en `/servicio` con totales del turno del mesero.
- `pagos-pendientes-panel.tsx` (admin): lista con miniatura del comprobante, botones aprobar/rechazar. Se monta como sheet desde un badge en `/servicio`.

Cambios:
- `_app.servicio.$idMesa.tsx`: el botón "Pagar cuenta" abre `PagarSheet` en vez de `cerrarCuentaMesa` directo.
- `_app.servicio.index.tsx`: badge "💸 Pagos por confirmar" (solo admin) + `CajaTurnoCard` para meseros. Realtime sobre tabla `pagos` (canal por negocio).
- Mantener `cerrarCuentaMesa` como fallback "cerrar sin cobrar" — opcional, fuera de scope.

## Histórico / analítica (solo guardar)

Ya tenemos timestamps en `pedidos` (`confirmado_at`, `entregado_at`, `pagado_at`) y en `pedido_items` (`iniciado_at`, `listo_at`, `entregado_at`). Añadimos `pagado_at` a item y dejamos `pagos` como tabla maestra. No se construye dashboard ahora — los datos quedan listos para consultas futuras.

## Seguridad

- RLS en `pagos` y `pago_items` por `id_negocio` / join al pedido.
- `confirmar_pago_transferencia` valida rol ADMIN dentro del RPC (security definer).
- Bucket privado; URLs firmadas con TTL corto.
- Validación zod en todas las server functions (UUIDs, monto > 0, voucher max 50 chars, mime image/*).

## Fuera de scope (explícito)
- Partes iguales / items compartidos entre comensales.
- Cierre formal de caja con arqueo (solo acumulado por turno).
- Dashboard de analítica.
- Integración real con pasarelas (Wompi, PSE, etc).
