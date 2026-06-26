## Problema

La mesa no entra a `OCUPADA` en todos los puntos donde debería, y solo se libera por cierre manual. Estado real hoy:

| Evento | ¿Marca OCUPADA? |
|---|---|
| Cliente toca "Llamar mesero" | Sí (`llamarMesero` ya lo hace) |
| Cliente toca "Confirmar pedido" | **No** — `solicitar_accion_cliente` solo escribe `solicitud_cliente='TOMAR_PEDIDO'`, no toca `estado` |
| Mesero acepta el prepedido (`aceptar_prepedido_mesa`) | **No** — la RPC inserta items pero no actualiza `estado` |
| Confirmación del último pago | **No** — `registrar_pago` / `confirmar_pago` no liberan |
| Cierre manual (`cerrar_mesa`) | Sí, libera (`estado='LIBRE'`) |

Resultado: una mesa puede quedar `LIBRE` aunque el cliente ya tenga pedido confirmado, y nunca se libera sola al terminar de cobrar.

## Cambios

Todo se hace en la base de datos (RPCs `SECURITY DEFINER`), una sola migración. Los server-fn / componentes no cambian.

1. **`solicitar_accion_cliente(p_id_mesa, p_tipo)`** — cuando `p_tipo='TOMAR_PEDIDO'`, además de fijar `solicitud_cliente/at`, marcar `estado='OCUPADA'` y `asignada_at=now()` si la mesa está `LIBRE`. Para `PEDIR_MAS`/`CUENTA` la mesa ya estaba ocupada, no se toca.

2. **`aceptar_prepedido_mesa(p_id_mesa)`** — al final, si la mesa quedó en `LIBRE`, marcarla `OCUPADA` defensivamente (cubre prepedidos legacy y la ruta del mesero que confirma directamente).

3. **Liberación automática al terminar el pago** — nueva función interna `public.intentar_liberar_mesa_si_pagada(p_id_mesa)` que libera la mesa solo cuando:
   - no quedan `pedido_items` sin `pagado_at` en pedidos no `PAGADO` de la mesa, y
   - no hay `pagos` con `estado_confirmacion='PENDIENTE'` para la mesa.
   
   Si se cumple, hace lo mismo que `cerrar_mesa` (marcar pedidos `PAGADO`, mesa `LIBRE`, limpiar mesero/solicitud, borrar `prepedido_sesiones`). Se llama desde:
   - el final de `registrar_pago` (cubre EFECTIVO/QR confirmados al momento),
   - el final de `confirmar_pago` cuando `p_aprobar=true` (cubre TRANSFERENCIA al aprobarse el último comprobante).

4. **`cerrar_mesa`** se mantiene tal cual para cierre manual del mesero/cajero.

## Resultado esperado

- Cliente toca "Llamar mesero" → mesa `OCUPADA` (sin cambio).
- Cliente toca "Confirmar pedido" → mesa `OCUPADA` y, si no tiene mesero, se le asigna uno (igual que el llamado).
- Mesa permanece `OCUPADA` durante todo el ciclo, incluso si hay pagos parciales.
- Mesa pasa a `LIBRE` solo cuando: (a) se cobra/confirma el último pago y no queda nada pendiente, o (b) el cajero presiona "Cerrar mesa" manualmente.

## Detalles técnicos

- Una sola migración SQL con `CREATE OR REPLACE` de las tres RPCs públicas más la nueva helper interna.
- `intentar_liberar_mesa_si_pagada` filtra por `current_user_negocio()` y no lanza excepción si aún hay pendientes (no romper el flujo de pagos parciales).
- Sin cambios en `src/lib/*.ts` ni en componentes — el contrato de las RPCs no cambia.
