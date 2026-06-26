## Objetivo

Permitir que en el cierre de caja se registren **ajustes adicionales** (ej: "Descuento familia", "Descuadre", "Propina extra", etc.) con un monto cada uno. Los tipos de ajuste se gestionan desde un selector con opción de crear nuevos sobre la marcha, y quedan guardados en la base de datos para reutilizarlos en cierres futuros.

## Cambios en base de datos

Dos tablas nuevas (vía migración):

1. **`caja_ajuste_tipos`** — catálogo reutilizable de tipos de ajuste por negocio.
   - Campos de dominio: `nombre`, `signo` (`POSITIVO` suma / `NEGATIVO` resta, default negativo), `activo`.
   - Único por negocio + nombre (case-insensitive).
   - RLS: lectura para staff del negocio; crear/editar solo ADMIN/SUPERADMIN/CAJERO.

2. **`caja_ajustes`** — ajustes aplicados a un cierre específico.
   - Campos de dominio: `id_caja` (FK `caja_dia`), `id_tipo` (FK `caja_ajuste_tipos`), `monto`, `nota` opcional.
   - RLS: lectura para staff del negocio del cierre; insertar solo al cerrar (ADMIN/SUPERADMIN/CAJERO).

Ambas tablas con `GRANT` a `authenticated` y `service_role`, RLS habilitada y políticas usando `has_role` / pertenencia al negocio (mismo patrón ya usado en `caja_dia`).

El total de ajustes se considerará en la **diferencia de efectivo** del cierre: `diferencia_efectivo = efectivo_fisico − (efectivo_esperado + suma_ajustes_signados)`. Esto evita modificar el esquema de `caja_dia` y mantiene la lógica del RPC `cerrar_caja` intacta — los ajustes se insertan después de cerrar, y la UI los muestra como detalle del cuadre.

## Cambios en server functions (`src/lib/caja.functions.ts`)

- `listarTiposAjuste()` — devuelve los tipos activos del negocio.
- `crearTipoAjuste({ nombre, signo })` — inserta un nuevo tipo, devuelve el registro. Valida unicidad.
- `cerrarCaja(...)` extendido con `ajustes: { idTipo, monto, nota? }[]` opcional. Después de llamar al RPC `cerrar_caja`, inserta los ajustes en `caja_ajustes` ligados al `idCaja` devuelto, en una sola operación. Si falla el insert de ajustes, intenta rollback básico o reporta error claro (los ajustes son secundarios al cierre real).
- `getCierre()` extendido para devolver `ajustes: { id, nombre, signo, monto, nota }[]` y `total_ajustes`.

## Cambios en UI (`src/routes/_app.caja.cierre.tsx`)

En el **Paso 4 — Conciliación**, antes del bloque de nota de cuadre:

- Nueva sección **"Ajustes"** con:
  - Un `Combobox` (shadcn: `Popover` + `Command`) que lista tipos existentes y permite filtrar por texto.
  - Si el texto escrito no coincide con ningún tipo, aparece la opción **"+ Crear '<texto>'"** que abre un mini-diálogo (nombre prellenado + selector signo Positivo/Negativo) y al guardar lo agrega al catálogo y lo selecciona.
  - Al seleccionar un tipo, se agrega una fila a la lista de ajustes con `Input` numérico para el monto y un botón eliminar.
- Lista de ajustes agregados (chips/filas): nombre, signo, monto, eliminar.
- Recalculo del `difEfectivo` mostrado en el componente `Diff`: incluye la suma signada de ajustes.
- Al pulsar "Cerrar caja", se envían los `ajustes` junto al payload existente.

En la **vista del cierre** (`src/routes/_app.caja.cierres.$id.tsx`): agregar un bloque "Ajustes" que liste cada ajuste con su monto y signo, y muestre el total de ajustes.

## Lo que NO se toca

- RPC `cerrar_caja` y `resumen_caja_dia` (sin cambios).
- Esquema de `caja_dia`, `pagos`, `pedidos`.
- Lógica de pasos 1–3 del wizard.
- Cocina, barra, servicio, impresión.

## Detalles técnicos

- Tipos generados (`src/integrations/supabase/types.ts`) se regeneran tras la migración antes de tocar las server functions.
- Validación Zod en server fns: `nombre` 1–60 chars, `monto > 0`, `signo` enum.
- El signo se aplica al sumar (no se permiten montos negativos en el input — el signo viene del tipo).
- Orden en el `Combobox`: tipos más recientes / más usados primero (simple: `order by created_at desc` por ahora).
