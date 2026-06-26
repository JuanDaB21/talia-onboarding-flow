## Plan

1. Reconstruir el bloque inferior de pago como un panel mobile-first
- Mantener la lista de productos arriba y convertir “Agregar bono”, “Propina” y “Abono de reserva” en filas/botones grandes, táctiles y visibles.
- Evitar popovers pequeños dentro del sheet, porque en mobile quedan debajo, se cierran fácil o no reciben bien el toque.

2. Rehacer “Agregar bono”
- Reemplazar el selector actual por un diálogo/panel dedicado dentro del flujo de pago.
- Mostrar bonos activos como opciones grandes con nombre y descuento.
- Al seleccionar bono: cerrar selector, reflejar descuento inmediatamente y bloquear abono de reserva para evitar mezclas incompatibles.
- Permitir quitar el bono claramente.

3. Rehacer “Propina”
- Reemplazar el popover de edición por un diálogo/panel táctil.
- Incluir montos rápidos fijos además de porcentajes: 0%, 5%, 10%, 15% y botones de monto fijo.
- Incluir campo numérico para monto variable, con aplicación inmediata y botón claro para guardar/cerrar.
- Asegurar que el monto variable sí actualice el total en items y en método de pago.

4. Rehacer “Abono de reserva”
- Reemplazar el selector actual por un diálogo/panel dedicado con reservas aplicables del día.
- Al escoger una reserva, seleccionar automáticamente todos los productos pendientes si no hay selección.
- Mostrar código, cliente y monto abonado; reflejar descuento inmediatamente.
- Si el abono cubre todo, mostrar botón directo “Aplicar abono de reserva”; si no cubre todo, permitir continuar al método de pago cobrando el saldo.
- Mantener la restricción de no combinar bono y abono.

5. Priorizar comportamiento mobile
- Usar controles con altura mínima táctil, texto sin truncamientos críticos y footer estable.
- Evitar menús superpuestos encima del Sheet; usar Dialog/Drawer interno con z-index correcto.
- Validar visualmente en viewport mobile el flujo: seleccionar productos, abrir/cerrar bono, elegir propina fija/variable, elegir reserva y confirmar pago/abono.

## Detalles técnicos

- Archivo principal a modificar: `src/components/servicio/pagar-sheet.tsx`.
- No tocaré la lógica de base de datos salvo que al validar aparezca un error backend distinto.
- Se mantendrán las funciones existentes: `listarBonos`, `previsualizarBono`, `listarReservasAplicablesHoy`, `aplicarAbonoEnCheckout` y `registrarPago`.