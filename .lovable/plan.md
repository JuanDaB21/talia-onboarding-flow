# Pre-pedido colaborativo por mesa

Los clientes que escanean el QR de una mesa entran a una "sesión de mesa": ingresan su nombre, ven en tiempo real el carrito compartido de todos los presentes y agregan productos con personalización completa (extras, exclusiones, alergia, nota). El mesero ve ese pre-pedido en tiempo real y con un clic lo convierte en pedido real (reutilizando el flujo actual de confirmar/imprimir comandas). Las funciones de llamar mesero y pedir la cuenta no cambian.

## Reglas de negocio

- **Identidad cliente:** solo nombre + `localStorage` por dispositivo. Se guarda `{ id_cliente: uuid, nombre }` por mesa: `talia.prepedido.{idMesa}`. El `id_cliente` se genera con `crypto.randomUUID()` y permite distinguir "lo mío" de "lo de otros".
- **Edición compartida:** cada cliente ve todos los items del carrito (con etiqueta "Agregado por X") pero **solo puede editar/borrar los suyos** (filtrado por `id_cliente`).
- **Personalización:** misma experiencia que el `ItemEditorSheet` del mesero — cantidad, alergia, nota, extras y exclusiones — adaptada al theme público existente.
- **Conversión a pedido real:** el mesero pulsa "Aceptar pre-pedido" → backend mueve TODOS los items del pre-pedido al pedido `ABIERTO` (creándolo si no existe) y vacía el pre-pedido. El mesero luego ajusta/agrega/confirma como hoy.
- **Persistencia entre confirmaciones:** después de aceptar, el pre-pedido queda vacío pero la sesión sigue activa; los clientes pueden seguir agregando para una siguiente ronda.
- **Limpieza:** al cerrar mesa (`cerrar_mesa` / `cerrar_cuenta_mesa`) se borran todas las sesiones e items del pre-pedido de esa mesa.

## Modelo de datos (migración)

Dos tablas nuevas (un pre-pedido por mesa, items agrupados por cliente):

```text
prepedido_sesiones
  id_sesion uuid PK
  id_mesa uuid FK mesas
  id_cliente uuid       -- generado en el navegador
  nombre text
  created_at, last_seen_at timestamptz
  UNIQUE (id_mesa, id_cliente)

prepedido_items
  id_prepedido_item uuid PK
  id_mesa uuid FK mesas
  id_sesion uuid FK prepedido_sesiones ON DELETE CASCADE
  id_producto uuid FK productos
  cantidad numeric, precio_unitario numeric
  tiene_alergia bool, nota text
  extras jsonb         -- [{ id_insumo_extra, precio_extra }]
  exclusiones jsonb    -- [{ id_insumo }]
  created_at timestamptz
```

- `GRANT SELECT, INSERT, UPDATE, DELETE` a `anon` y `authenticated` (lectura pública por mesa para el cliente sin sesión; escritura validada en server fns con `supabaseAdmin`).
- RLS habilitada con políticas permisivas para lectura por `id_mesa` y bloqueo de escritura directa (todas las mutaciones pasan por server fns con admin).
- Ambas tablas se agregan a `supabase_realtime` publication para broadcasting.
- Trigger `ON DELETE` de `mesas` → `CASCADE`. Función `limpiar_prepedido_mesa(p_id_mesa uuid)` invocada desde `cerrar_mesa` y `cerrar_cuenta_mesa`.

Server fn nueva `aceptar_prepedido_mesa(p_id_mesa)` (SECURITY DEFINER, RPC SQL):
1. Crea/obtiene pedido `ABIERTO` de la mesa.
2. Inserta cada `prepedido_item` como `pedido_items` + sus `pedido_item_extras` + `pedido_item_exclusiones`.
3. Llama `recalcular_total_pedido`.
4. Borra los `prepedido_items` (las sesiones permanecen).

## Server functions (`src/lib/prepedido.functions.ts`)

Públicas (no requieren auth, validan por `idMesa`):
- `unirseSesionPrepedido({ idMesa, idCliente, nombre })` — upsert en `prepedido_sesiones`, actualiza `last_seen_at`.
- `getPrepedidoPublico({ idMesa })` — devuelve sesiones + items con nombres de producto/insumo + total.
- `agregarItemPrepedido({ idMesa, idSesion, idCliente, idProducto, cantidad, tieneAlergia, nota, extras, exclusiones })` — valida que `idSesion` pertenezca a `idCliente` y a `idMesa`; valida extras/exclusiones contra `extras_permitidos`/`receta_detalle`.
- `editarItemPrepedido({ idItem, idCliente, ...campos })` — solo si el item pertenece a una sesión con ese `idCliente`.
- `eliminarItemPrepedido({ idItem, idCliente })` — misma validación.

Autenticada (mesero/admin):
- `aceptarPrepedido({ idMesa })` con `requireSupabaseAuth` → llama RPC `aceptar_prepedido_mesa`.
- `getPrepedidoStaff({ idMesa })` con `requireSupabaseAuth` — misma data que la pública, pero exigiendo pertenecer al negocio.

## UI cliente — `src/routes/carta.$idMesa.tsx`

Cambios al onboarding y al main:

1. **Onboarding:** sustituir el botón "Continuar" por un formulario con un `<input>` de nombre (validado: 1-40 chars, trim). Al enviar:
   - Genera `id_cliente` si no existe en `localStorage`.
   - Llama `unirseSesionPrepedido`.
   - Pasa a fase `menu`.
2. **Carrito flotante (nuevo botón inferior):** además de "Llamar mesero / Pedir más / Pedir la cuenta", aparece un FAB / pill "Mi pedido (N items · $TOTAL)" que abre un sheet `PrepedidoSheet`.
3. **PrepedidoSheet** (nuevo componente `src/components/menu-publico/prepedido-sheet.tsx`):
   - Lista agrupada por sesión, con avatar de inicial + nombre.
   - Items propios con botones editar/borrar; items ajenos en modo solo-lectura con badge "agregado por X".
   - Total general.
   - Suscripción realtime a `prepedido_items` y `prepedido_sesiones` filtrados por `id_mesa` para refrescar la query.
4. **Nuevo flujo "Agregar":** al tocar un producto, el `ProductoDetalleDialog` (que hoy solo muestra info) gana un footer "Agregar a mi pedido" con cantidad/alergia/nota/extras/exclusiones — reusando la lógica del `ItemEditorSheet` del mesero pero estilizada con `--menu-*` tokens para mantener el theme.
5. **Heartbeat:** llamar `unirseSesionPrepedido` cada 60s para `last_seen_at`.

## UI mesero/admin — `src/routes/_app.servicio.$idMesa.tsx`

- Nueva tarjeta `PrepedidoCard` que aparece encima del pedido ABIERTO cuando hay items en pre-pedido. Muestra items agrupados por cliente, total y botón principal **"Aceptar pre-pedido (N items)"**.
- Suscripción realtime ya existe para la mesa; agregar canales para `prepedido_items` y `prepedido_sesiones`.
- Al confirmar: `aceptarPrepedido({ idMesa })` → invalida `mesaSesion` → toast "Pre-pedido agregado al pedido abierto".
- En dashboard de admin (opcional, fase 2): contador "Mesas con pre-pedido pendiente" en `operacion-panel.tsx`.

## Realtime

Cliente y mesero usan canales:
```text
prepedido-mesa-${idMesa}
  ON * prepedido_items (filter id_mesa=eq.${idMesa})
  ON * prepedido_sesiones (filter id_mesa=eq.${idMesa})
```
Cada evento invalida la query `["prepedido", idMesa]`.

## Archivos

Nuevos:
- `supabase/migrations/<ts>_prepedido.sql`
- `src/lib/prepedido.functions.ts`
- `src/components/menu-publico/prepedido-sheet.tsx`
- `src/components/menu-publico/prepedido-item-editor.tsx` (versión themed del editor)
- `src/components/servicio/prepedido-card.tsx`
- `src/hooks/use-cliente-mesa.ts` (gestión de `id_cliente`/nombre en localStorage)

Editados:
- `src/routes/carta.$idMesa.tsx` (onboarding con nombre, sheet de pre-pedido, FAB)
- `src/components/menu-publico/producto-detalle-dialog.tsx` (botón "Agregar a mi pedido")
- `src/routes/_app.servicio.$idMesa.tsx` (PrepedidoCard + realtime)
- `src/lib/menu-publico.functions.ts` (sin cambios funcionales, sólo si hace falta exponer extras/exclusiones permitidas en `getMenuPublico` para evitar un round-trip extra)

## Fuera de alcance (queda para iteración futura)

- Identidad persistente cross-device del cliente.
- Notificación push al mesero cuando hay nuevo item en pre-pedido (por ahora confía en realtime + el badge visible).
- Pago directo del cliente desde el pre-pedido (sigue siendo flujo del mesero).
