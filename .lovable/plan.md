## Problema

La ruta `/bodega/inventario/:id` ya existe y matchea, pero la página de detalle no se ve. La causa es que `src/routes/_app.bodega.inventario.tsx` se comporta como **ruta padre** del archivo hijo `_app.bodega.inventario.$id.tsx` (convención de TanStack con puntos), y su componente renderiza directamente `<InventarioTab />` sin un `<Outlet />`. Resultado: al navegar al detalle, el padre sigue mostrando el listado y el hijo nunca tiene dónde montarse.

## Solución

Separar el layout del listado:

1. **Convertir `src/routes/_app.bodega.inventario.tsx` en un layout vacío** que solo renderice `<Outlet />` (sin header ni `<InventarioTab />`). Mantiene el `head()` con el título de la sección.

2. **Crear `src/routes/_app.bodega.inventario.index.tsx`** con el contenido actual de la página de inventario: header "Inventario" + descripción + `<InventarioTab />`. Esto pasa a responder en `/bodega/inventario` exacto.

3. **El detalle `_app.bodega.inventario.$id.tsx`** queda sin cambios; ahora sí se montará dentro del `<Outlet />` del padre cuando la URL sea `/bodega/inventario/:id`.

## Resultado

- `/bodega/inventario` → muestra el listado (como ahora).
- `/bodega/inventario/:id` → muestra el detalle con stock, historial de movimientos y compras.
- Click en una fila del inventario navega correctamente al detalle.

No hay cambios de schema ni de backend. Solo reestructuración de archivos de ruta.
