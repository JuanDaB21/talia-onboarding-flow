## Problema

Al pagar sin usar reserva, la base de datos lanza:
> `record "v_reserva" is not assigned yet`

Ocurre en las funciones `registrar_pago` y `registrar_pago_dividido`. Ambas usan `v_reserva.codigo_reserva` dentro de un `CASE WHEN p_id_reserva IS NOT NULL THEN ... v_reserva.codigo_reserva ...`. Aunque la rama solo se toma cuando hay reserva, PL/pgSQL necesita resolver el campo del record y falla porque `v_reserva` no fue asignado (el `SELECT ... INTO v_reserva` solo corre si `p_id_reserva IS NOT NULL`).

## Solución

Migración que reemplaza ambas funciones para:

1. Declarar una variable `v_codigo_reserva text := NULL`.
2. Asignarla dentro del bloque `IF p_id_reserva IS NOT NULL` justo después del `SELECT ... INTO v_reserva`:
   `v_codigo_reserva := v_reserva.codigo_reserva;`
3. Reemplazar `v_reserva.codigo_reserva` en el `CASE` del `subtipo` por `v_codigo_reserva`.

Sin más cambios de lógica: mismas validaciones, mismos parámetros, mismo comportamiento cuando sí hay reserva.

## Verificación

- Probar checkout normal (sin reserva) → debe registrar el pago sin error.
- Probar checkout aplicando reserva → subtipo sigue incluyendo `Reserva <código>`.