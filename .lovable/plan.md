
## Módulo de Reservas — TALIA

Construir un módulo completo de reservas sin tocar la lógica existente de pedidos/pagos/caja. Solo se agregan: una tabla nueva, server fns, vistas nuevas, y un bloque aditivo en el sheet de pago.

---

### 1. Base de datos (migración)

**Tabla `reservas`** (multi-tenant, scope por `id_negocio`):

- `id_reserva` uuid PK
- `id_negocio` uuid FK → `negocio` (NOT NULL)
- `codigo_reserva` text UNIQUE — formato `TAL-XXXX` (4 chars alfanuméricos mayúsculas), generado por trigger BEFORE INSERT
- `customer_name` text NOT NULL
- `customer_phone` text
- `fecha_reserva` date NOT NULL
- `hora_reserva` text NOT NULL (texto libre, ej. "20:30" o "8 pm")
- `cantidad_personas` int NOT NULL CHECK > 0
- `tipo_reserva` text (free tag, opcional)
- `monto_abonado` numeric(12,2) NOT NULL DEFAULT 0 CHECK ≥ 0
- `estado` text NOT NULL DEFAULT `'intencion'` CHECK IN (`intencion`, `abonado`, `cancelada_devuelto`, `cancelada_retenido`, `asistida`)
- `id_pedido_aplicado` uuid NULL FK → `pedidos` (trazabilidad cuando se aplica en checkout)
- `created_by` uuid (auth.uid())
- `created_at`, `updated_at` timestamptz

GRANT SELECT/INSERT/UPDATE/DELETE a `authenticated`, ALL a `service_role`. RLS habilitado, todas las políticas con `id_negocio = current_user_negocio()`. Trigger `set_updated_at`.

**Enum `metodo_pago`**: agregar valor `ABONO_RESERVA`. Las funciones existentes (`resumen_caja_dia`, `cerrar_caja`) filtran explícitamente por `EFECTIVO/TRANSFERENCIA/DATAFONO`, así que el nuevo valor NO contamina los totales de caja — solo aparece como traza dentro del pedido.

**Función `aplicar_abono_reserva(p_id_reserva, p_id_pedido)`** SECURITY DEFINER:
1. Valida `id_negocio`, estado = `abonado`, fecha = hoy.
2. Inserta en `pagos`: `metodo='ABONO_RESERVA'`, `monto=monto_abonado`, `estado_confirmacion='CONFIRMADO'`, `id_mesa` y `id_mesero` tomados del pedido.
3. Marca reserva `estado='asistida'`, `id_pedido_aplicado=p_id_pedido`.
4. Retorna `id_pago`.

Atómica: si el pedido ya tiene un abono aplicado, falla.

---

### 2. Server functions (`src/lib/reservas.functions.ts`)

Todas con `requireSupabaseAuth`:

- `listarReservas({ fecha?, estado?, search? })` — agenda + búsqueda por código/nombre.
- `getMetricasReservasHoy()` — count, suma abonado, devuelto, retenido.
- `crearReserva(input)` — valida con Zod, normaliza teléfono.
- `actualizarReserva(id, input)` — cambia datos/estado/monto.
- `cancelarReserva(id, { devolver: boolean })` — pone `cancelada_devuelto` o `cancelada_retenido`.
- `listarReservasAplicablesHoy()` — solo `estado='abonado'` y `fecha_reserva = today` para el dropdown del checkout.
- `aplicarAbonoEnCheckout({ id_reserva, id_pedido })` — invoca RPC `aplicar_abono_reserva`.

---

### 3. UI — Dashboard de Reservas

**Ruta nueva** `src/routes/_app.reservas.tsx` (layout) + `_app.reservas.index.tsx` (agenda).
Agregar entrada "Reservas" al sidebar (`src/components/app-sidebar.tsx`) con ícono `CalendarDays`.

Componentes nuevos en `src/components/reservas/`:

- `reservas-metricas-cards.tsx` — 4 cards arriba: Total hoy, Abonado hoy, Devuelto hoy, Retenido hoy.
- `reservas-filtros.tsx` — search por código/nombre, selector de fecha (default hoy), filtro por estado.
- `reservas-agenda.tsx` — lista cronológica agrupada por `hora_reserva`, cada item es un `reserva-card`.
- `reserva-card.tsx` — muestra código (badge), nombre, hora, personas, tipo, monto, estado (badge color), acciones (editar, cancelar, copiar WhatsApp).
- `reserva-form-sheet.tsx` — sheet con formulario crear/editar (RHF + Zod). Campos: nombre, teléfono, fecha, hora (input text), personas, tipo (input text), estado (select), monto abonado (numeric, requerido si estado=`abonado`).
- `cancelar-reserva-dialog.tsx` — confirmación con dos botones: "Devolver dinero" / "Retener dinero".
- `whatsapp-copy-button.tsx` — copia al portapapeles el mensaje pre-formateado y muestra toast. Texto: `¡Hola {nombre}! Tu reserva en TALIA para el {fecha} a las {hora} ha sido registrada. Código de reserva: {codigo}. Abono: ${monto}. ¡Te esperamos!`

---

### 4. Integración en checkout (aditivo, sin tocar lógica existente)

Editar `src/components/servicio/pagar-sheet.tsx` solo para añadir un bloque:

- Cargar `listarReservasAplicablesHoy()` al abrir el sheet.
- Renderizar bloque "Aplicar Abono de Reserva" arriba de los métodos de pago, con:
  - `<Select>` con opciones `[CÓDIGO] Nombre — $monto`. Solo visible si hay reservas y si no se ha aplicado una ya a este pedido.
  - Al seleccionar: setear `abonoSeleccionado` en estado local. Mostrar línea "Descuento por Reserva: -$XXXX" en el resumen y restar del `totalPendiente` mostrado.
  - Botón "Quitar abono" para deseleccionar.
- En el handler de confirmación de pago, **antes** del flujo de pago existente, si hay abono seleccionado: llamar `aplicarAbonoEnCheckout({ id_reserva, id_pedido })`. Esto inserta el pago `ABONO_RESERVA` y marca la reserva como `asistida`. Luego continúa el flujo normal con el monto restante (si > 0). Si el abono cubre todo el pedido, no se procesa pago adicional.
- Manejo de errores: si falla `aplicarAbonoEnCheckout`, toast de error y NO continuar con el cobro.
- Invalidar queries de pedido/pagos/reservas tras éxito.

**No se modifica** `pagos.functions.ts`, ni `caja_dia`, ni `resumen_caja_dia`, ni `cerrar_caja`. El nuevo `metodo='ABONO_RESERVA'` aparece en la tabla `pagos` ligado al pedido (trazabilidad completa) pero queda excluido automáticamente de los totales de efectivo/transferencia/datáfono.

---

### 5. Detalles técnicos

- Generación de `codigo_reserva`: trigger PL/pgSQL con `substr(translate(encode(gen_random_bytes(6),'base64'),'+/=','XYZ'),1,4)` en mayúsculas, reintentando si colisiona el UNIQUE.
- Zod schemas compartidos en `src/lib/reservas.schemas.ts`.
- Validación: nombre 1-100, teléfono opcional max 30, hora max 20 chars, tipo max 50, monto ≥ 0.
- Permisos: cualquier rol con `current_user_negocio()` puede gestionar reservas (cajero/mesero/admin). Cancelar con retención: solo `ADMIN`/`SUPERADMIN` (verificación via `is_admin_actual()` en la server fn).
- Realtime opcional fuera de scope; refresco vía `queryClient.invalidateQueries`.

---

### Archivos a crear

- migración SQL (tabla + enum + función + trigger + RLS + grants)
- `src/lib/reservas.functions.ts`, `src/lib/reservas.schemas.ts`
- `src/routes/_app.reservas.tsx`, `src/routes/_app.reservas.index.tsx`
- `src/components/reservas/*` (7 componentes)

### Archivos a editar

- `src/components/app-sidebar.tsx` — agregar link
- `src/components/servicio/pagar-sheet.tsx` — bloque aditivo de abono
