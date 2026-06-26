Plan de corrección

1. Corregir la causa raíz del error
- Actualizar las funciones de base de datos que aún usan `estado_mesa`.
- Cambiar los casts como `'OCUPADA'::estado_mesa` por valores de texto compatibles con la columna actual `mesas.estado`, que hoy es texto/character varying.
- Funciones afectadas principalmente:
  - `solicitar_accion_cliente`
  - `aceptar_prepedido_mesa`

2. Restaurar la ocupación de mesa en los flujos del cliente
- Al llamar al mesero, asegurar que la mesa quede en `OCUPADA`, con `solicitud_cliente` y `solicitud_at` actualizados.
- Al confirmar pedido desde el prepedido, asegurar que la mesa quede en `OCUPADA` y se limpie la solicitud cuando el mesero acepte el pedido.
- Al iniciar/unirse a la sesión de mesa desde la carta pública, marcar la mesa como `OCUPADA` si estaba `LIBRE`, porque desde ese momento ya hay actividad real en la mesa.

3. Revisar asignación de mesero
- Mantener el intento actual de asignar mesero automáticamente cuando el cliente llama o confirma pedido.
- Verificar que si no hay mesero en turno, la mesa igualmente quede ocupada y visible como pendiente de atención.

4. Validar el flujo completo
- Probar que ya no aparezca `type "estado_mesa" does not exist`.
- Probar tres acciones:
  - Iniciar sesión de mesa desde la carta.
  - Llamar al mesero.
  - Completar/confirmar pedido.
- Confirmar que la mesa pasa a `OCUPADA` y que el aviso llega al panel de servicio.

Detalles técnicos
- Requiere una migración de base de datos para reemplazar las funciones SQL defectuosas.
- Requiere un ajuste pequeño en el server function público de prepedido para ocupar la mesa al unirse a la sesión.
- No se tocarán roles, espacios de trabajo, pagos ni inventario.