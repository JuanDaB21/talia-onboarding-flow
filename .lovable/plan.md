# Unir pre-pedido + adiciones del mesero en un mismo pedido

## Problema actual

Hoy la mesa termina con varios pedidos separados ("Pedido #1", "Pedido #2"…) aunque el mesero solo quería sumar productos al pedido que ya estaba en cola:

1. El cliente arma su pre-pedido y lo confirma desde el celular.
2. El mesero acepta el pre-pedido → se crea **Pedido #1** (Abierto) y luego lo confirma → pasa a **En cola**.
3. Si el cliente sigue agregando al pre-pedido y vuelve a confirmar, el sistema crea **Pedido #2** porque ya no hay un pedido "Abierto" donde meter los items nuevos.
4. Lo mismo pasa si el mesero quiere agregar más productos: se crea un pedido aparte.

El usuario quiere que mientras la mesa siga abierta, todo lo que provenga del pre-pedido y la primera adición del mesero se acumule en **el mismo pedido**, conservando el botón "Agregar productos (nueva orden)" para los casos en que sí se quiera separar la comanda a propósito.

## Cambios

### 1. Backend — RPC `aceptar_prepedido_mesa`

Migración para que la función que pasa los items del pre-pedido al pedido real reutilice el pedido más reciente de la mesa que no esté pagado (esté Abierto o En cola), en vez de crear uno nuevo cuando el último ya está confirmado.

- Buscar el pedido vigente: primero un Abierto; si no hay, el último Confirmado (no pagado, no cancelado, no cerrado) de la mesa.
- Solo crear un pedido nuevo cuando realmente no exista ninguno vigente.
- Si los items se insertan sobre un pedido En cola, calcular y guardar `destino` y `tiempo_planeado_min` por item (igual que ya hace `agregar_item_pedido` cuando se agrega a un pedido confirmado), para que la cocina los reciba como nuevos items "En cola" del pedido existente.
- Mantener el conteo de items insertados y el recálculo del total.

### 2. UI — sin cambios funcionales mayores

- El botón **"Agregar producto"** dentro de la tarjeta de cada pedido ya apunta al pedido específico (lo añade al mismo pedido); se mantiene.
- El botón **"Agregar productos (nueva orden)"** se conserva exactamente como está, para los casos en que el mesero quiera abrir un pedido nuevo a propósito.
- La tarjeta de "Cliente armando pedido" sigue mostrándose en vivo; al pulsar "Aceptar pre-pedido", los items entrarán al pedido vigente.

## Resultado esperado

- Cliente confirma → Pedido #1 (En cola con su item).
- Cliente sigue agregando y vuelve a confirmar → los items nuevos aparecen dentro del **mismo Pedido #1**, marcados "En cola" para cocina.
- Mesero pulsa "Agregar producto" en la tarjeta del Pedido #1 → también se suman al **mismo Pedido #1**.
- Solo cuando el mesero pulse "Agregar productos (nueva orden)" se creará un Pedido #2 separado.

## Detalle técnico

- Migración que reemplaza `public.aceptar_prepedido_mesa(uuid)` con la nueva lógica de búsqueda de pedido vigente (`ORDER BY created_at DESC LIMIT 1` sobre estados `ABIERTO`/`CONFIRMADO`).
- El INSERT en `pedido_items` toma `destino` desde `categorias.destino` y `tiempo_planeado_min` desde `receta_master.tiempo_preparacion_min` cuando el pedido reutilizado está en `CONFIRMADO`, dejando los demás campos por defecto (`estado_preparacion = EN_COLA`).
- No se tocan las tablas ni se cambian políticas RLS; solo se actualiza la función.
- No requiere cambios en server functions ni en tipos generados (la firma de la RPC no cambia).
