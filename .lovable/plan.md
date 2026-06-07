## Permitir al mesero imprimir la comanda del pedido en curso

Actualmente en `/servicio/:idMesa` el mesero ya puede imprimir comandas de pedidos **confirmados** (botón en `PedidoConfirmadoCard`), pero no en el **pedido abierto / borrador** que está tomando. Esto agrega el botón también ahí.

### Cambio único

**Editar `src/routes/_app.servicio.$idMesa.tsx`**

1. `PedidoAbiertoCard`: aceptar un nuevo prop `onPrint: () => void`.
2. Renderizar un botón secundario "Imprimir comanda" (icono `Printer`) junto al botón "Confirmar orden" en el aside de la orden, deshabilitado cuando `pedido.items.length === 0`.
3. En el componente padre, pasar `onPrint={() => imprimirComandasDePedido(mesa.identificador, mesa.mesero_nombre, pedidoAbierto)}` reutilizando el helper que ya existe.

### Notas

- Imprime una hoja por destino (Cocina / Barra) igual que en pedidos confirmados, agrupando automáticamente.
- No se modifica la lógica de negocio ni el backend: solo UI + reutilización del helper `imprimirComandasDePedido` ya implementado.
- No se toca la vista de admin, cocina ni barra.