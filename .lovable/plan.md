## Diagnóstico

Verifiqué el código actual:

- **La regla SÍ se mantiene**: la mesa solo pasa a `OCUPADA` cuando el cliente toca "Llamar mesero" (`llamarMesero` en `menu-publico.functions.ts`). Ni `unirseSesionPrepedido` (registrar nombre) ni `agregarItemPrepedido` (carrito) cambian el estado de la mesa.
- **Pero hay una fuga**: las filas en `prepedido_sesiones` y `prepedido_items` quedan huérfanas para siempre si el cliente arma el carrito y nunca llama al mesero (cierra la pestaña, se va, etc.). Hoy nadie las borra:
  - `cerrar_mesa` y `cerrar_cuenta_mesa` no limpian el pre-pedido.
  - `aceptar_prepedido_mesa` borra `prepedido_items` pero deja vivas las `prepedido_sesiones`.
  - No hay job de expiración por inactividad.

Esto no abre la mesa para siempre (la mesa nunca se ocupó), pero sí ensucia la DB y, peor, cuando llegan nuevos clientes a esa misma mesa ven el carrito viejo de otra gente en tiempo real.

## Cambios

### 1) Migración SQL

1. **`cerrar_mesa(p_id_mesa)`**: al final, `DELETE FROM prepedido_sesiones WHERE id_mesa = p_id_mesa` (los items caen por `ON DELETE CASCADE`).
2. **`cerrar_cuenta_mesa(p_id_mesa)`**: misma limpieza.
3. **`aceptar_prepedido_mesa(p_id_mesa)`**: además de `DELETE FROM prepedido_items`, borrar las `prepedido_sesiones` de esa mesa para que el siguiente grupo arranque limpio.
4. **Nueva función `purgar_prepedido_inactivo()`** (SECURITY DEFINER): borra `prepedido_sesiones` con `last_seen_at < now() - interval '4 hours'`. Devuelve el conteo. `GRANT EXECUTE ... TO anon, authenticated, service_role`.

### 2) Cron

Reutilizar el endpoint `/api/public/hooks/cerrar-turnos` para llamar también a `purgar_prepedido_inactivo()` en el mismo POST (devuelve `{ ok, cerrados, prepedidos_purgados }`). Mantiene la misma frecuencia (15 min) ya configurada en pg_cron.

## Fuera de alcance

- No se cambia la UI del cliente ni del mesero.
- No se modifica el flujo de "Llamar mesero" ni la ocupación de mesa.
- No se agregan nuevos endpoints públicos.

## Archivos

- Nueva migración SQL (modifica 3 funciones existentes + crea 1 nueva).
- `src/routes/api/public/hooks/cerrar-turnos.ts` (añadir segunda llamada RPC).
