
## Objetivo
Cuando cambies el espacio de trabajo (`destino`) de una categoría, todos sus productos y recetas deben quedar consistentes de inmediato, y la edición de esos productos/recetas debe seguir funcionando sin errores.

## Diagnóstico
- Hoy `productos` y `receta_master` **no** guardan `destino`: lo heredan por `id_categoria → categorias.destino`. Por eso al cambiar la categoría de espacio, "en teoría" todo debería reflejarse. En la práctica hay tres puntos frágiles:
  1. `categorias.destino` es texto libre. Nada valida que el nuevo valor exista en `espacios_trabajo` del negocio. Si queda un slug huérfano (ej. renombraste un espacio) → RPCs que buscan `espacios_trabajo.slug = upper(destino)` fallan (`descontar_inventario_item`, `iniciar_comanda_estacion`, `agregar_item_pedido`).
  2. `pedido_items.destino` es un **snapshot** al momento de crear el item. Los items ya creados siguen apuntando al espacio anterior y aparecen en la estación equivocada / no descuentan de la bodega correcta.
  3. RPCs históricos (`iniciar_comanda_estacion` viejo, ver `20260523005334_…`) tienen hardcoded `IN ('COCINA','BARRA')`. Si un item queda con destino personalizado sale error al iniciar la comanda; y al re-editar receta se dispara la validación de espacio.

## Cambios

### 1. Migración: validar y propagar destino de categoría
- Función `public.set_categoria_destino(p_id_categoria uuid, p_destino text)`:
  - Verifica que el usuario sea admin/superadmin del negocio de la categoría.
  - Normaliza `p_destino` a UPPER y valida que exista en `espacios_trabajo` (mismo `id_negocio`, `activo = true`). Si no existe: `RAISE EXCEPTION 'Espacio de trabajo inválido'`.
  - `UPDATE categorias SET destino = … WHERE id_categoria = p_id_categoria`.
  - Propaga a `pedido_items` **pendientes** (aún no iniciados) de productos cuya receta pertenece a esa categoría:
    ```sql
    UPDATE pedido_items pi
       SET destino = new_destino
      FROM productos p JOIN receta_master rm ON rm.id_receta = p.id_receta
     WHERE pi.id_producto = p.id_producto
       AND rm.id_categoria = p_id_categoria
       AND pi.estado_preparacion IN ('PENDIENTE');
    ```
    Los items ya en `EN_PREPARACION` / `LISTO` / `ENTREGADO` se dejan como estaban (histórico).
- `GRANT EXECUTE … TO authenticated;`

### 2. Migración: reparar destinos huérfanos existentes
Detectar categorías cuyo `destino` no matchea ningún `espacios_trabajo.slug` activo del mismo negocio y reasignarlas al primer espacio activo del negocio (`ORDER BY orden, nombre`). Loguear con `RAISE NOTICE` cuáles se movieron.
Igual barrido sobre `pedido_items` pendientes con destino huérfano.

### 3. Migración: quitar CHECK legacy de `iniciar_comanda_estacion`
Revisar la versión vigente de `iniciar_comanda_estacion`. La versión de `20260626201219_…` ya valida contra `espacios_trabajo` (correcto). Confirmar que no queden overloads viejos con `IN ('COCINA','BARRA')` y hacer `DROP FUNCTION` de esa firma si aparece.

### 4. UI: usar el RPC nuevo al guardar categoría
En `src/components/menu/categorias-master-detail.tsx` (`CategoriaFormInline`, ~línea 331) reemplazar
`supabase.from("categorias").update({ nombre, destino })`
por dos pasos:
- `update` sólo con `nombre` (que es texto libre).
- Si cambió `destino`, llamar `supabase.rpc("set_categoria_destino", { p_id_categoria, p_destino })`.
Al terminar, además de `load()`, invalidar la lista de recetas/productos que estén cacheadas y mostrar un toast: `"Categoría movida a <espacio>. Se actualizaron N pedidos pendientes."` (usar `data.updated_items` que devolveremos como json del RPC).

### 5. UI: aviso al cambiar destino desde el sheet
Antes de confirmar, mostrar un `AlertDialog` de confirmación cuando `destino !== initial.destino`:
> "Vas a mover todos los productos y recetas de esta categoría a **<Nuevo espacio>**. Los pedidos ya en preparación no se cambian. ¿Continuar?"

## Fuera de alcance
- Cambiar el modelo para que `productos`/`receta_master` guarden su propio destino (hoy no hace falta; heredan de categoría).
- Reasignar destinos de items ya en preparación (se mantiene como historial).

## Verificación
1. Crear categoría en espacio "Cocina", crear producto con receta.
2. Crear un pedido con ese producto (queda `PENDIENTE`).
3. Mover la categoría a espacio "Barra" desde el sheet → confirma diálogo → toast muestra N=1 items actualizados.
4. Abrir producto y receta desde el menú y editarlos: guardar sin errores.
5. La comanda pendiente aparece ahora en la estación "Barra".
6. Renombrar el espacio "Barra" a "Bar" (nuevo slug `BAR`). Verificar que el trigger de `espacios_trabajo` (o un chequeo previo) actualiza `categorias.destino` — si no existe hoy ese trigger, la reparación de la migración 2 dejó los datos consistentes y el flujo sigue funcionando.
