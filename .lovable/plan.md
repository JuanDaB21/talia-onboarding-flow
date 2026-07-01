## Objetivo

Al crear/editar una reserva permitir seleccionar la **cuenta (método de pago QR)** a la que se depositó el abono. El listado se alimenta desde "Configuración > Métodos de pago" (Nequi, Daviplata, Bancolombia y las creadas como "Otra").

## Cambios

### 1. Base de datos
Migración que agrega a `reservas`:
- `id_metodo_pago_qr uuid null` con FK a `metodos_pago_qr(id_qr)` `on delete set null`.

### 2. Backend
- `src/lib/reservas.schemas.ts`: agregar `id_metodo_pago_qr: z.string().uuid().nullable().optional()` al schema. Regla: cuando `monto_abonado > 0` y `estado = 'abonado'`, `id_metodo_pago_qr` es obligatorio.
- `src/lib/reservas.functions.ts`:
  - `crearReserva` y `actualizarReserva`: persistir el nuevo campo.
  - `listarReservas` / interfaz `Reserva`: incluir `id_metodo_pago_qr` y un join ligero para mostrar la etiqueta (`plataforma` + `etiqueta` cuando sea "Otra") en las cards.

### 3. UI
- `src/components/reservas/reserva-form-sheet.tsx`:
  - Nuevo selector "Cuenta donde se recibió el abono" debajo de "Monto abonado".
  - Carga las cuentas con `useServerFn(listarMetodosPagoQr)` (ya existe) vía `useQuery`.
  - Solo se muestra cuando `monto_abonado > 0`.
  - Opciones: `Plataforma` + (para "Otra") `etiqueta`, subtítulo con `titular` si existe.
  - Estado vacío: "No hay cuentas configuradas" con link a `/configuracion/metodos-pago`.
- `src/components/reservas/reserva-card.tsx`: mostrar en la card el nombre de la cuenta cuando haya abono.

## Notas
- No se toca "Configuración > Métodos de pago" — solo se consume el listado existente.
- El QR/imagen no se guarda en la reserva; se referencia por id (así se mantiene sincronizado si el admin cambia la imagen).
