## Objetivo

Cuando un mesero se inhabilita (por sí mismo o por admin), redistribuir automáticamente sus mesas a los demás meseros en turno usando el mismo algoritmo de carga que ya usa `asignar_mesero_a_mesa` (menor cantidad de mesas OCUPADA, empate por antigüedad).

## Comportamiento actual

- `inhabilitarStaff` bloquea con error si el mesero tiene mesas con cuenta abierta (`estado != 'LIBRE'`).
- El RPC `asignar_mesero_a_mesa` se ejecuta solo al llamar al mesero desde el menú público, no al inhabilitar.

## Cambios

### 1. Nuevo RPC `reasignar_mesas_de_mesero(p_mesero uuid)`

Migración SQL (`security definer`, `search_path = public`). Para cada mesa `id_mesero_asignado = p_mesero`:

- Buscar el mejor mesero candidato usando el mismo criterio de `asignar_mesero_a_mesa`, EXCLUYENDO a `p_mesero`:
  - Mismo `id_negocio`.
  - `rol = 'MESERO'`, `estado = 'ACTIVO'`, `esta_en_turno = true`.
  - Orden: `COALESCE(carga, 0) ASC, created_at ASC` — donde `carga` = mesas OCUPADA asignadas ya (contando la asignación que se acaba de hacer en el loop para que se distribuya round-robin).
- `UPDATE mesas SET id_mesero_asignado = <nuevo o NULL>, asignada_at = now() WHERE id_mesa = ...`.
- Para pedidos ABIERTO de esa mesa cuyo `id_mesero = p_mesero`, actualizar `id_mesero` al nuevo (o NULL si no hay), para que el nuevo mesero vea la mesa en su vista y reciba el crédito. Pedidos ya cerrados/pagados no se tocan (histórico).
- Devuelve `int` = cantidad de mesas reasignadas.

Notas:
- Se procesa dentro de un cursor / loop `FOR mesa_row IN SELECT ...` para que cada asignación cuente en la carga de la siguiente iteración.
- Si no hay ningún mesero disponible, todas las mesas quedan con `id_mesero_asignado = NULL` (comportamiento actual del algoritmo cuando no hay meseros en turno).

Permisos: `REVOKE EXECUTE ... FROM PUBLIC, anon`. `GRANT EXECUTE ... TO service_role` (se invoca desde `supabaseAdmin`).

### 2. `src/lib/usuarios.functions.ts` — `inhabilitarStaff`

- Eliminar la validación que impide inhabilitar a un mesero con mesas no-LIBRE.
- Justo antes de marcar `estado='INACTIVO'`, si el target es MESERO llamar:
  ```ts
  await supabaseAdmin.rpc("reasignar_mesas_de_mesero", { p_mesero: targetId });
  ```
- El resto del handler queda igual.

### 3. UI (mensajes)

- `src/components/app-sidebar.tsx` (línea 412): cambiar el copy que dice "Si tienes mesas con cuenta abierta no podrás salir…" por algo como: "Al salir, tus mesas se reasignarán automáticamente a otros meseros en turno".
- `src/components/servicio/caja-turno-card.tsx`: si muestra confirmación al inhabilitarse, ajustar copy en la misma línea.
- No se cambia el flujo de admin (`_app.operacion.tsx`), solo el mensaje si aplica.

## Verificación

- Como mesero con 2 mesas OCUPADA: al inhabilitarme, las mesas quedan asignadas a otros meseros en turno con menor carga; los pedidos ABIERTO de esas mesas ahora aparecen con el nuevo mesero.
- Si no hay meseros en turno, las mesas quedan con `id_mesero_asignado = NULL` (admin puede reasignar manualmente desde la vista de servicio, que ya implementamos).
- Como admin inhabilitando a un mesero: mismo comportamiento.
- `bunx tsgo --noEmit` sin errores.

## Fuera de alcance

- No cambia el algoritmo de `asignar_mesero_a_mesa` para nuevas llamadas.
- No modifica reportes históricos: `pedidos.id_mesero` de pedidos ya `PAGADO/CERRADO` no se toca; solo pedidos ABIERTO se transfieren.
