## Funcionalidad: Bonos y descuentos

Objetivo: que el dueño cree bonos (% de descuento) y el mesero los aplique al cobrar una mesa, con trazabilidad completa (caja, mesero, monto regalado total vs neto).

---

### 1. Base de datos (1 migración)

**Tabla `bonos`** (catálogo por negocio)
- Campos: nombre, porcentaje (0–100), activo (default true), id_negocio.
- RLS: SELECT abiertos al staff del negocio; INSERT/UPDATE/DELETE solo ADMIN/SUPERADMIN. Borrado lógico (activo=false).

**Tabla `bono_aplicaciones`** (historial / trazabilidad)
- Campos: id_bono (FK), id_pago (FK ON DELETE CASCADE), id_mesa, id_mesero, nombre_bono_snapshot, porcentaje_aplicado, monto_descuento, monto_descuento_neto, id_negocio, created_at.
- RLS: SELECT staff del negocio; escritura solo vía RPC.

**Cambios en `pagos`**
- Añadir columnas opcionales `id_bono uuid`, `descuento_bono numeric default 0`, `descuento_neto numeric default 0` (snapshots para reportería sin joins).

**RPC nueva `calcular_costo_items(p_item_ids uuid[]) RETURNS jsonb`**
- Devuelve `{ costo_total, precio_total }` recorriendo `pedido_items → productos → receta_master → receta_detalle → insumos.costo_promedio` (cantidad_item × Σ cantidad_receta × costo_promedio). Aproximación documentada: no descuenta exclusiones ni suma extras al costo (se aclara en tooltip de UI).

**Reemplazo de `registrar_pago`**
- Nueva firma agrega `p_id_bono uuid DEFAULT NULL`.
- Si viene bono: valida que pertenezca al negocio y esté activo; calcula `descuento = round(subtotal_items × porcentaje/100)`; calcula `costo` con la RPC y `margen = (precio - costo) / precio`; `descuento_neto = round(descuento × margen)`.
- Resta el descuento del `monto` cobrado (el cobro real al cliente baja). Guarda `id_bono`, `descuento_bono`, `descuento_neto` en `pagos`.
- Inserta fila en `bono_aplicaciones` (con snapshot de nombre y porcentaje).
- Mantiene la lógica actual de items/propina/transferencia.

---

### 2. Server functions (`src/lib/bonos.functions.ts`)

- `listarBonos()` — todos para admin, solo activos para el resto.
- `crearBono({ nombre, porcentaje })` — admin.
- `actualizarBono({ idBono, nombre, porcentaje, activo })` — admin.
- `eliminarBono({ idBono })` — admin (soft delete).
- `previsualizarBono({ idBono, itemIds })` — devuelve `{ descuento, descuento_neto, porcentaje }` para mostrar en el sheet de cobro antes de confirmar.
- `historialBonos({ desde, hasta, idMesero? })` — admin. Devuelve filas + totales `{ total_regalado, total_neto, total_aplicaciones }`.

`registrarPago` (en `src/lib/pagos.functions.ts`) suma el parámetro opcional `idBono`.

---

### 3. UI Configuración → Bonos y descuentos

Reemplaza la página placeholder por dos tabs:

**Tab "Bonos"** — solo admin
- Listado de bonos (nombre, %, activo, acciones editar/eliminar).
- Botón "Crear bono" → dialog con nombre + porcentaje (1–100).

**Tab "Historial"** — solo admin
- Filtros: rango de fechas (por defecto hoy) y selector de mesero.
- KPIs grandes:
  - **Total regalado** (suma `monto_descuento`) con tooltip: *"Lo que el cliente dejó de pagar, calculado sobre el precio de venta."*
  - **Total neto** (suma `monto_descuento_neto`) con tooltip: *"Lo que realmente le costó al negocio, descontando el margen de ganancia de los alimentos. Calculado como descuento × (precio − costo) / precio."*
  - Nº aplicaciones.
- Tabla: fecha, mesa, mesero, bono, %, regalado, neto.

Página queda en `src/routes/_app.configuracion.bonos-descuentos.tsx` (ya existe el archivo).

---

### 4. UI Cobro (mesero) — `pagar-sheet.tsx`

En el panel inferior de `PasoItems` (entre Subtotal y Propina):
- Si no hay bono aplicado: link "+ Agregar bono".
- Al hacer clic abre `Popover` con la lista de bonos activos (nombre · %). Al elegir uno se llama `previsualizarBono` con los `itemIds` seleccionados y se muestra una línea:
  - `Bono "Cumpleaños" (-10%) … −$5.000` con botón ✕ para quitar.
- El total a cobrar pasa a ser `subtotal − descuento + propina`.
- Re-prevista automáticamente cuando cambia la selección de items.
- En `PasoMetodo` el resumen muestra la misma línea de descuento.
- `registrarPago` se llama con `idBono` cuando hay bono aplicado.

Sin cambios en el flujo de propina ni transferencia.

---

### 5. Trazabilidad en caja / dashboard (alcance mínimo)

- Como `pagos.monto` ya queda reducido por el bono, los totales de `caja_dia` y `resumen_caja_dia` reflejan automáticamente el ingreso real (no hace falta cambiar `cerrar_caja` ni el dashboard).
- La trazabilidad detallada vive en `bono_aplicaciones` (mesero + bono + montos) y se muestra en el Historial.

---

### Fuera de alcance
- Bonos por monto fijo (solo porcentaje, como pediste).
- Límites de uso, vigencias, cupones por cliente.
- Mostrar bono en la vista del cliente (`carta.$idMesa`).
- Reembolso de bono al rechazar una transferencia (queda registrado tal cual; si se necesita revertir, se hará en una iteración futura).
