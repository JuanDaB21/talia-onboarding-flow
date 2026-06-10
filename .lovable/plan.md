## Problema

Hoy el botón "Ver pedido de la mesa" sólo aparece cuando el pre-pedido tiene items. Si el cliente aún no ha agregado nada, o si quiere ver lo que están sumando sus acompañantes en tiempo real, no tiene acceso al carrito. Tampoco hay un icono persistente que comunique "aquí está tu pedido".

## Cambios (sólo UI en `src/routes/carta.$idMesa.tsx`)

1. **Icono de carrito flotante siempre visible** en la cabecera del menú (esquina superior derecha, dentro de `ThemedHeader` o como FAB fijo arriba):
   - Icono `ShoppingBag` con badge numérico que muestra la cantidad total de items del pre-pedido (suma de `cantidad`).
   - Si no hay items: badge oculto, pero el botón sigue clickeable y abre el `PrepedidoSheet` (que ya maneja el estado vacío).
   - Usa tokens `--menu-primary` / `--menu-surface` para mantener el theme.
   - Posición: fija, `top: env(safe-area-inset-top)+8px`, `right: 12px`, `z-40`, para que no se tape con el sticky de categorías.

2. **Eliminar / reemplazar el botón ancho "Ver pedido de la mesa"** del bottom bar.
   - Razón: ya tenemos el icono persistente arriba y el bottom bar queda saturado con 3 botones.
   - El bottom bar mantiene "Pedir más" + "Pedir la cuenta" cuando hay pedido activo, o "Llamar mesero" cuando no.

3. **Flujo de "pedir más"**: verificar que al tocar "Pedir más" (mesa con pedido activo) el cliente también pueda seguir agregando productos al pre-pedido desde el catálogo y verlos en el carrito. Hoy ya funciona porque el pre-pedido es independiente del pedido confirmado; sólo confirmamos que el icono de carrito siga visible en ese estado (lo estará, vive en el header).

4. **Realtime ya está conectado** (`prepedidoQ` se invalida por cambios en `prepedido_items`), así que el badge se actualiza solo cuando otros comensales agregan/quitan.

## Fuera de alcance

- No se cambia el `PrepedidoSheet` ni el editor de items.
- No se toca lógica del mesero ni server functions.
- No se cambia el flujo de confirmación del pre-pedido.

## Archivos a editar

- `src/routes/carta.$idMesa.tsx` (único).
