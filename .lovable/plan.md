
# Paso 6.2 — Asignación y Toma de Pedido (Mesero)

Ámbito acotado a esta entrega. No se tocan Compras, Inventario, Recetas ni Configuración salvo lo estrictamente necesario.

## 1. Cambios de base de datos (una sola migración)

### 1.1 Asignación de mesero
- `mesas`: añadir `id_mesero_asignado uuid NULL` + `asignada_at timestamptz NULL`.
- Política RLS actual de `mesas` ya filtra por `id_negocio`; no cambia.

### 1.2 Ruteo cocina/barra (por categoría)
- `categorias`: añadir `destino text NOT NULL DEFAULT 'COCINA' CHECK (destino IN ('COCINA','BARRA'))`.
- UI mínima en pantalla **Menú → Categorías** existente: un selector COCINA/BARRA por categoría (1 dropdown extra, sin rediseño). Solo este toque a Menú.

### 1.3 Persistencia de la orden (4 tablas nuevas, todas con RLS `id_negocio = current_user_negocio()`)
- `pedidos` — `id_pedido`, `id_negocio`, `id_mesa`, `id_mesero`, `estado` (`ABIERTO|CONFIRMADO|CERRADO|CANCELADO`), `total`, `created_at`, `updated_at`.
- `pedido_items` — `id_item`, `id_pedido`, `id_producto`, `cantidad`, `precio_unitario`, `tiene_alergia bool`, `nota text`, `destino` (snapshot COCINA/BARRA al confirmar).
- `pedido_item_extras` — `id_item` → `id_insumo_extra`, `cantidad_porcion`, `precio_extra` (snapshot tomado de `extras_permitidos`).
- `pedido_item_exclusiones` — `id_item` → `id_insumo` (ingrediente base de la receta a omitir; validado contra `receta_detalle`).

### 1.4 Funciones SQL SECURITY DEFINER
- `asignar_mesero_a_mesa(p_id_mesa)`: round-robin por carga. Selecciona staff con `rol='MESERO'`, `esta_en_turno=true`, `estado='ACTIVO'`, del mismo `id_negocio`, ordenando por `COUNT(mesas WHERE id_mesero_asignado=x AND estado='OCUPADA')` ASC y `created_at` para desempate. Si no hay meseros en turno, deja la mesa sin asignar (NULL) y retorna NULL. Setea `id_mesero_asignado` y `asignada_at`.
- `crear_pedido_para_mesa(p_id_mesa)`: crea `pedidos` en estado `ABIERTO` para la mesa OCUPADA con `id_mesero = id_mesero_asignado`. Idempotente: si ya existe ABIERTO, lo devuelve.
- `agregar_item_pedido(p_id_pedido, p_id_producto, p_cantidad, p_tiene_alergia, p_nota, p_extras jsonb, p_exclusiones jsonb)`: valida pertenencia al negocio, inserta item + extras (filtrados contra `extras_permitidos` del producto) + exclusiones (filtradas contra `receta_detalle` de la receta del producto). Recalcula `pedidos.total`.
- `actualizar_item_pedido` / `eliminar_item_pedido`: mismas validaciones, recálculo de total.
- `confirmar_pedido(p_id_pedido)`: snapshot del `destino` de cada item leyendo `categorias.destino` vía `productos → receta_master → categorias`. Pasa pedido a `CONFIRMADO`. A partir de aquí los items no se editan.

### 1.5 Hook a `llamarMesero`
- En `src/lib/menu-publico.functions.ts → llamarMesero`: tras el `UPDATE mesas SET estado='OCUPADA'`, llamar a `asignar_mesero_a_mesa` si la mesa no tiene mesero. Sigue siendo el mismo flujo público.

### 1.6 Realtime
- `ALTER PUBLICATION supabase_realtime ADD TABLE mesas, pedidos, pedido_items;`
- `REPLICA IDENTITY FULL` en `mesas` para recibir el row completo.

## 2. Frontend — nueva sección **Servicio (Mesas)**

Sección dedicada, separada de Configuración/Mesas (esta última sigue siendo solo CRUD admin).

### 2.1 Rutas nuevas (bajo `_app`)
- `src/routes/_app.servicio.tsx` — layout con `<Outlet />`.
- `src/routes/_app.servicio.index.tsx` — **Panel del mesero**: grid de mesas asignadas al usuario actual (rol MESERO ve solo las suyas; ADMIN/SUPERADMIN ven todas con filtro). Cards muestran `identificador`, estado, mesero, tiempo desde `asignada_at`. Suscripción Realtime a `mesas` filtrada por `id_negocio`: cuando entra un evento con `id_mesero_asignado = miUserId` y `estado='OCUPADA'`, `toast.info("Mesa X te necesita")` + refetch.
- `src/routes/_app.servicio.$idMesa.tsx` — **Toma de pedido**: panel split:
  - Izquierda (catálogo): pills de categorías + lista de productos (reusa fetch tipo `getMenuPublico` pero versión autenticada con `requireSupabaseAuth`).
  - Derecha (orden): items del pedido ABIERTO; cada item con stepper de cantidad, switch "🚨 Alergia" (resalta rojo), nota libre, sección "Extras" (de `extras_permitidos`) y "Quitar ingredientes" (de `receta_detalle`).
  - Pie: total + botón **Confirmar orden** → `confirmar_pedido`.

### 2.2 Sidebar
- Agregar grupo "Servicio" con un solo item "Mesas en servicio" → `/servicio`. Edit puntual a `app-sidebar.tsx`.

### 2.3 Server functions (`src/lib/servicio.functions.ts`)
Todas con `requireSupabaseAuth`:
- `listarMisMesas`, `obtenerMesaConPedido`, `agregarItem`, `actualizarItem`, `eliminarItem`, `confirmarPedido`, `reasignarMesero` (admin/superadmin).

### 2.4 Componentes (`src/components/servicio/`)
- `mesa-card.tsx`, `mesa-grid.tsx`, `item-editor-sheet.tsx` (modal mobile-friendly con extras/exclusiones/alergia/nota), `pedido-panel.tsx`, `catalogo-panel.tsx`, `alergia-badge.tsx`.

## 3. Flujo end-to-end
1. Cliente abre `/carta/$idMesa` y toca "Llamar mesero".
2. `llamarMesero` → `UPDATE mesas` + `asignar_mesero_a_mesa` → un mesero queda asignado.
3. Realtime entrega el cambio a la sesión del mesero → toast.
4. Mesero entra a `/servicio` → ve la mesa → abre `/servicio/$idMesa` → se crea el `pedido ABIERTO`.
5. Mesero arma la orden item por item (cantidad, extras, exclusiones, alergia, nota).
6. Confirma → `confirmar_pedido` snapshotea `destino` por item. La vista de cocina/barra (Paso 6.3) consumirá `pedido_items` filtrando por `destino`.

## 4. Restricciones honradas
- No se tocan Compras, Inventario, Recetas, ni la UI de Configuración/Mesas (solo se añade `destino` en Categorías).
- Sin push nativo: Realtime in-app + toast.
- Sin mock data: todo vía server functions reales.
- Diff & Select: solo se edita `app-sidebar.tsx`, `menu-publico.functions.ts` y `categorias-master-detail.tsx` (selector destino). Lo demás son archivos nuevos.

## 5. QA antes de cerrar
1. Crear 2 meseros en turno → llamar mesero desde la carta → verificar que `asignar_mesero_a_mesa` reparte por menor carga.
2. Tomar orden con extras + exclusiones + alergia → confirmar → revisar en DB que `pedido_items.destino` quedó correcto según categoría.
3. Abrir `/servicio` en dos pestañas con meseros distintos → llamar mesa asignada al mesero A → solo la pestaña A recibe toast.
4. Mobile 390px: panel de toma de pedido usable (sheet en lugar de split en <md).
