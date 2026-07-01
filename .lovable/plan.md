## Objetivo

En el cobro (`PagarSheet`), permitir que el mesero divida el pago total en **varias partes con distinto método** (ej. 60.000 en efectivo + 60.000 por transferencia a Bancolombia), manteniendo trazabilidad completa y el flujo de confirmación de admin para las partes que lo requieran (transferencias).

## Comportamiento actual

- Selección de items → un único método (EFECTIVO / TRANSFERENCIA / DATAFONO) → `registrar_pago` crea un `pagos` con `monto = subtotal - descuentos` y estado `PENDIENTE` si es TRANSFERENCIA.
- No hay forma de partir el cobro entre varios métodos.

## Diseño

### 1. Base de datos

Nueva migración:

- `ALTER TABLE public.pagos ADD COLUMN id_pago_padre uuid NULL REFERENCES public.pagos(id_pago) ON DELETE CASCADE;`
- Índice `CREATE INDEX idx_pagos_padre ON public.pagos(id_pago_padre);`
- Nuevo RPC `registrar_pago_dividido(...)`:
  - Parámetros: `p_id_mesa uuid, p_item_ids uuid[], p_partes jsonb, p_propina numeric, p_id_bono uuid, p_id_reserva uuid`.
  - `p_partes` = array de objetos `{ metodo, subtipo, voucher, url_comprobante, monto }`.
  - Validaciones:
    - Reusar toda la validación de items/bono/reserva de `registrar_pago`.
    - Sumar subtotal → aplicar bono/reserva → `total_requerido = subtotal - descuentos + propina`.
    - `SUM(partes.monto) = total_requerido` (tolerancia ±1 COP).
    - Cada parte con `metodo='TRANSFERENCIA'` DEBE tener `url_comprobante`.
    - `array_length(partes) >= 2` (partes=1 debe usar el RPC existente).
    - `monto > 0` por parte.
  - Ejecución en transacción:
    - Insertar la **primera parte** como pago PRINCIPAL: se le atribuyen `propina` completa, `descuento_bono`, `descuento_neto`, `id_bono`, subtipo con "Reserva …" si aplica. `pago_items` linkea todos los items al principal. Marcar `pedido_items.pagado_at = now(), id_pago = principal`.
    - Insertar las partes 2..N como pagos con `id_pago_padre = principal`, `propina = 0`, sin `id_bono`, con su propio `monto`, `metodo`, `subtipo`, `voucher`, `url_comprobante`, `estado_confirmacion` según método.
    - Si algún parte es TRANSFERENCIA → esa parte queda `PENDIENTE`; las demás `CONFIRMADO`.
    - `bono_aplicaciones` sigue vinculado solo al principal.
    - `reservas` update igual (una sola vez).
    - `PERFORM intentar_liberar_mesa_si_pagada(p_id_mesa)` al final.
  - Devuelve `uuid` del pago principal.
- Grants: mismo patrón que `registrar_pago` (SECURITY DEFINER, revoke public, grant execute a `authenticated` si aplica, o solo `service_role` — replicar lo que hoy tiene `registrar_pago`).

### 2. Server function

`src/lib/pagos.functions.ts`:

- Nueva `registrarPagoDividido` (createServerFn + requireSupabaseAuth) con Zod schema:
  ```ts
  z.object({
    idMesa: z.string().uuid(),
    itemIds: z.array(z.string().uuid()).min(1).max(200),
    propina: z.number().min(0).max(10_000_000).default(0),
    idBono: z.string().uuid().nullable().optional(),
    idReserva: z.string().uuid().nullable().optional(),
    partes: z.array(z.object({
      metodo: z.enum(["EFECTIVO","TRANSFERENCIA","DATAFONO"]),
      subtipo: z.string().max(50).nullable().optional(),
      voucher: z.string().max(50).nullable().optional(),
      urlComprobante: z.string().max(500).nullable().optional(),
      monto: z.number().int().positive(),
    })).min(2).max(10),
  })
  ```
- Llama `supabase.rpc("registrar_pago_dividido", { ... })`.

### 3. UI — `src/components/servicio/pagar-sheet.tsx`

En `PasoMetodo`:

- **Nuevo Switch** "Dividir pago entre varios métodos" arriba de la selección de método.
- Cuando OFF: comportamiento actual (un solo método).
- Cuando ON:
  - Oculta el selector único y muestra una **lista de partes** editables:
    - Cada tarjeta: selector método (mismos 3 iconos), input `monto` (numérico, formato COP), y campos condicionales del método (selector subtipo/cuenta reusando `SubtipoTransferenciaSelector` y el uploader de comprobante que ya existen para transferencia; input voucher para datáfono).
    - Botón "×" para eliminar la parte (mínimo 2).
    - Botón "+ Agregar parte" (máximo 10).
  - Resumen sticky abajo:
    - "Total requerido: {totalConPropina}"
    - "Suma partes: {sumaPartes}"
    - "Saldo por asignar: {totalRequerido - sumaPartes}" con color: verde si 0, rojo si distinto.
    - Botón "Autocompletar saldo" que asigna el saldo restante a la última parte.
  - Botón "Pagar" habilitado solo si:
    - Sum(partes.monto) === totalRequerido.
    - Cada parte válida (monto > 0, campos requeridos por método).
    - Al menos 2 partes.
  - Al enviar: llama `registrarPagoDividido`. Toast: si alguna parte es transferencia → "Pago registrado · N transferencia(s) esperando confirmación del admin"; sino → "Pago registrado".
- Reset del split al cambiar el step o abrir el sheet.

### 4. Trazabilidad y confirmación

- `PagosPendientesSheet` (admin): ya lista todos los `pagos` `PENDIENTE`. Al hacerse partes en registros individuales, cada transferencia aparece por separado. **Ajuste menor**: en la tarjeta del pago pendiente, si `id_pago_padre !== null`, mostrar badge "Pago dividido — parte X de Y" (consulta ligera para contar partes del mismo padre).
- `caja` / analytics: cada parte suma independientemente por método, sin cambios adicionales.
- Historial de pagos por mesa (si existe UI): las partes se muestran como pagos separados; para agruparlas visualmente, si hay una vista de "detalle de mesa" con pagos, ordenar por `COALESCE(id_pago_padre, id_pago)` y agrupar. **Fuera de alcance**: dejar la vista tal cual, solo se documenta la relación por `id_pago_padre`.

### 5. Validaciones y edge cases

- Bono/reserva se aplican al principal (que se toma como la primera parte); los descuentos ya reducen `total_requerido` antes de dividir.
- Reserva que cubre TODO el total (`reservaCubreTodo`) sigue usando el flujo actual con `pagar_con_abono_reserva` — el switch de dividir no se habilita en ese caso.
- Propina completa se atribuye al pago principal, no se prorratea entre partes (más simple y ya sirve para efectos de reporte).
- Si alguna parte es transferencia, la mesa NO se libera hasta que el admin confirme esas partes (el helper `intentar_liberar_mesa_si_pagada` ya considera `estado_confirmacion`).

## Archivos a tocar

- Nueva migración SQL (columna + RPC).
- `src/lib/pagos.functions.ts` — nueva `registrarPagoDividido`.
- `src/components/servicio/pagar-sheet.tsx` — Switch + editor de partes + envío al nuevo RPC.
- `src/components/servicio/pagos-pendientes-sheet.tsx` — badge de "pago dividido" (opcional, mejora trazabilidad).
- `src/integrations/supabase/types.ts` — regenerado automáticamente tras la migración.

## Verificación

- Cobrar 3 items = 120.000: activar switch, parte 1 = 60.000 EFECTIVO, parte 2 = 60.000 TRANSFERENCIA (Bancolombia + comprobante). Guardar.
  - Se crean 2 filas en `pagos`: principal EFECTIVO CONFIRMADO, hija TRANSFERENCIA PENDIENTE con `id_pago_padre = principal`.
  - `pedido_items.pagado_at` != null, `id_pago = principal`.
  - Admin ve la parte de transferencia en `PagosPendientesSheet` con badge "parte 2 de 2".
  - Al confirmarla → mesa liberable.
- Con propina 10%: se atribuye al principal; `pagos.monto` del principal incluye su parte del items + propina; hija solo su monto de items.
- Sum de partes distinto al total → botón "Pagar" deshabilitado, muestra saldo restante.
- 1 sola parte con switch ON → no permitido (botón deshabilitado, mínimo 2).
- `bunx tsgo --noEmit` sin errores.

## Fuera de alcance

- Reprorrateo de propina entre partes.
- Combinación de partes con bono aplicado a partes distintas al principal.
- Agrupar visualmente las partes en el historial de la mesa (más allá del badge del admin).
