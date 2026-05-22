## Diagnóstico

Al inspeccionar la base de datos detecté dos problemas:

1. **Trigger faltante**: La función `crear_inventario_para_insumo()` existe, pero **no hay ningún trigger** que la ejecute (lista de triggers vacía en `information_schema`). Por eso los insumos nuevos no obtienen una fila inicial en `inventario_actual`. El RPC `registrar_compra` ya tiene una defensa que inserta la fila si falta, pero el modelo previsto no se está cumpliendo.

2. **Falta refresco en UI**: `InventarioTab` solo consulta `inventario_actual` una vez (en `useEffect` con dependencias vacías). Si el usuario registra una compra desde el modal en `/bodega/compras` y luego cambia a `/bodega/inventario`, normalmente remonta y refresca; pero no hay garantía de actualización en vivo ni invalidación cross-route, lo que produce la sensación de que la compra "no se ve" en inventario.

Confirmé también que los datos sí están correctos en la BD: la única compra existente (Tomate, cantidad 20) se reflejó como `cantidad_actual = 20` en `inventario_actual`. El problema percibido es por falta de refresco automático y por el trigger ausente que debería respaldar la consistencia.

## Cambios propuestos

### 1. Base de datos (migración)

Crear el trigger faltante sobre `public.insumos` para que cada nuevo insumo genere automáticamente su fila en `inventario_actual`:

```sql
CREATE TRIGGER trg_crear_inventario_para_insumo
AFTER INSERT ON public.insumos
FOR EACH ROW EXECUTE FUNCTION public.crear_inventario_para_insumo();
```

(No se crean foreign keys nuevas: las relaciones `inventario_actual.id_insumo → insumos`, `compras.id_proveedor → proveedores`, `detalle_compra.id_compra → compras` y `detalle_compra.id_insumo → insumos` ya fueron añadidas en migraciones previas. La lógica transaccional de actualización de stock vive en el RPC `registrar_compra`, que ya recalcula `cantidad_actual` aplicando `factor_conversion` y registra en `movimientos_inventario`.)

### 2. Frontend — refresco automático del Inventario

En `src/components/bodega/inventario-tab.tsx`:

- Extraer la consulta a una función `fetchRows()` reutilizable.
- Suscribirse vía **Supabase Realtime** a cambios en `inventario_actual` filtrados por el negocio del usuario (`id_negocio=eq.<idNegocio>`) y refrescar la tabla automáticamente.
- Habilitar realtime para la tabla en la migración: `ALTER PUBLICATION supabase_realtime ADD TABLE public.inventario_actual;` y `ALTER TABLE public.inventario_actual REPLICA IDENTITY FULL;`.

Resultado: al registrar una compra desde cualquier pestaña, el inventario se actualiza en vivo sin necesidad de recargar.

### 3. Frontend — feedback inmediato al registrar compra

En `src/routes/_app.bodega.compras.tsx` (donde se monta `CompraForm` dentro del modal): tras `onSuccess`, además de cerrar el modal y refrescar el historial de compras local, mostrar un toast con enlace "Ver en inventario" que navegue a `/bodega/inventario`.

## Verificación

1. Crear un insumo nuevo → confirmar que aparece automáticamente en `/bodega/inventario` con cantidad 0 (gracias al trigger).
2. Registrar una compra de ese insumo → el inventario en `/bodega/inventario` debe incrementarse en vivo (gracias a realtime), aplicando `factor_conversion`.
3. Revisar `movimientos_inventario` para confirmar la auditoría del movimiento tipo `COMPRA`.
