## Problema

**Cliente (vista `/carta/$idMesa`):**
1. El botón flotante del carrito (`ShoppingBag`) está fijo en `top: env(safe-area-inset-top) + 12px; right: 12px` y se superpone al header del menú (logo / "Mesa N" / título), por eso se ve desfasado/encimado.
2. Los items del propio cliente sí se cargan en `prepedidoQ`, pero no se ven en el sheet por dos razones: (a) la zona scrollable del sheet queda tapada por el footer sticky de "Total parcial", y (b) cuando el cliente agrega su primer producto antes de que `setSesion` haya guardado el `idSesion` definitivo, el item queda en una sesión con `id_cliente` distinto al guardado en localStorage, así que el flag `propio` falla y los botones Editar/Quitar no aparecen, dando la sensación de "no veo lo mío".

**Mesero / dueño (vista `/_app/servicio/$idMesa`):**
1. La vista de mesa solo suscribe realtime a `pedido_items`, `pedidos` y `mesas`. Nunca lee `prepedido_items` / `prepedido_sesiones`, así que el pre-pedido que están armando los clientes desde su celular nunca aparece. El mesero solo lo ve al aceptarlo manualmente (cuando ya es pedido confirmado).

## Solución

### 1. Vista cliente — botón de carrito bien posicionado

En `src/routes/carta.$idMesa.tsx`:

- Mover el botón flotante del carrito del top-right al **bottom-right**, flotando sobre la franja de acciones (Llamar mesero / Pedir más / Pedir cuenta), tipo FAB. Posición: `bottom: calc(env(safe-area-inset-bottom) + 88px); right: 16px`. Tamaño `h-14 w-14`, badge en `-top-1 -right-1`. Así no choca con ningún header (hero-centrado, banner-gradiente, editorial o minimal) y queda al alcance del pulgar.
- Mantener `z-40`, sombra y animación `active:scale-95`.

### 2. Vista cliente — ver siempre "lo mío" en el carrito

- En `src/routes/carta.$idMesa.tsx`, **bloquear** la apertura del editor de producto (`setAgregarProducto`) hasta que `cliente?.idSesion` exista. Hoy el `PrepedidoItemEditor` solo se monta con `idSesion`, pero el botón "Agregar" del detalle ya está disponible apenas hay `cliente`. Forzar el flujo: si no hay `idSesion`, reintentar `unirseFn` antes de abrir el editor.
- En `src/components/menu-publico/prepedido-sheet.tsx`:
  - Cambiar el criterio `propio` de `sesion.id_cliente === idCliente` a usar **además** el `idCliente` de localStorage como respaldo y, sobre todo, **ordenar los grupos** poniendo "tú" primero para que el cliente vea lo suyo de entrada.
  - Agregar `padding-bottom` extra (`pb-32`) al contenedor scrollable para que el footer sticky de "Total parcial" no tape el último item de la lista.
  - Mostrar un mini-encabezado "Lo tuyo (N items)" al inicio cuando hay items propios, con CTA "Editar".

### 3. Vista mesero — pre-pedido en tiempo real

En `src/lib/servicio.functions.ts` (sólo server fn, sin tocar reglas de negocio):
- Agregar `getPrepedidoMesa(idMesa)` con `requireSupabaseAuth` que devuelva `PrepedidoData` (reutiliza `cargarPrepedido` ya existente en `prepedido.functions.ts`, exportándolo o duplicando la lectura vía `context.supabase`). Debe validar que el staff pertenezca al negocio dueño de la mesa.

En `src/routes/_app.servicio.$idMesa.tsx`:
- Agregar un `useQuery(["prepedidoMesa", idMesa])` con `staleTime: 5000` y suscripción Realtime a `prepedido_items` y `prepedido_sesiones` filtrada por `id_mesa=eq.${idMesa}` que invalide ese query.
- Renderizar un nuevo componente `<PrepedidoEnVivoCard />` entre el `MesaHeader` y los pedidos confirmados, **sólo si hay items**, mostrando:
  - Badge "EN VIVO · clientes armando pedido" con punto pulsante.
  - Lista agrupada por cliente (mismo formato que el sheet del cliente, sin botones de editar/borrar).
  - Total acumulado del pre-pedido.
  - Botón "Aceptar y convertir en pedido" que dispara `aceptarPrepedido` (ya existe) e invalida `mesaSesion` + `prepedidoMesa`.

En la lista de mesas `/_app/servicio` (`src/routes/_app.servicio.index.tsx`):
- Agregar suscripción realtime global a `prepedido_items` (filtrada por negocio si es posible vía `id_mesa in …`, o invalidar lista completa) para que cada `MesaCard` muestre un badge "🟢 cliente armando pedido" cuando exista al menos un `prepedido_item` para esa mesa. Implementación mínima: extender `listarMesasServicio` para incluir `tiene_prepedido: boolean` y refrescar al recibir evento.

### 4. Realtime habilitado en DB

Habilitar Realtime para las tablas del pre-pedido (migración):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.prepedido_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prepedido_sesiones;
ALTER TABLE public.prepedido_items REPLICA IDENTITY FULL;
ALTER TABLE public.prepedido_sesiones REPLICA IDENTITY FULL;
```

(Verificar primero con `supabase--read_query` si ya están en la publicación; si sí, omitir.)

## Detalles técnicos

- `aceptarPrepedido` ya existe y llama a la RPC `aceptar_prepedido_mesa`, así que no se necesita lógica nueva de conversión.
- El badge en tiempo real para mesero usa los mismos canales que ya están en `_app.servicio.$idMesa.tsx`; solo se agrega un `.on("postgres_changes", { table: "prepedido_items", filter: ... })` al mismo `channel`.
- No se cambian RLS ni grants: la lectura del staff va por `supabase` del middleware (RLS aplicada por `id_negocio`); la lectura del cliente sigue por `supabaseAdmin` como hoy.
- No se introducen nuevos secretos ni dependencias.

## Archivos a modificar

- `src/routes/carta.$idMesa.tsx` — reposicionar FAB, blindar flujo de "Agregar".
- `src/components/menu-publico/prepedido-sheet.tsx` — orden de grupos, padding-bottom, encabezado "Lo tuyo".
- `src/lib/servicio.functions.ts` — nueva `getPrepedidoMesa` y campo `tiene_prepedido` en `listarMesasServicio`.
- `src/routes/_app.servicio.$idMesa.tsx` — query + realtime + render del `PrepedidoEnVivoCard`.
- `src/routes/_app.servicio.index.tsx` — badge "cliente armando pedido" + realtime.
- Nuevo: `src/components/servicio/prepedido-en-vivo-card.tsx`.
- Migración: habilitar Realtime en `prepedido_items` y `prepedido_sesiones` (si falta).
