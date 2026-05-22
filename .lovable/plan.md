## Objetivo

Simplificar el formulario de **Insumos** para que el usuario no tenga que pensar en factores de conversión. Unificar `unidad_medida` con `unidad_receta` y usar selects con un catálogo cerrado de unidades + cálculo automático del factor.

## 1. Catálogo de unidades (en código, no en DB)

Tres familias, cada unidad pertenece a una y tiene un valor base:

```text
PESO        Kilogramo (kg)   = 1000 g    base: Gramo (g)
            Libra (lb)       = 453.592 g
            Onza (oz)        = 28.3495 g
            Gramo (g)        = 1 g

VOLUMEN     Litro (L)        = 1000 ml   base: Mililitro (ml)
            Mililitro (ml)   = 1 ml
            Galón (gal)      = 3785.41 ml
            Onza líq. (fl oz)= 29.5735 ml

UNIDAD      Caja             = N unidades (manual)
            Docena           = 12 unidades
            Paquete          = N unidades (manual)
            Bandeja          = N unidades (manual)
            Unidad (u)       = 1 unidad
```

**Regla:** `unidad_compra` y `unidad_receta` deben pertenecer a la **misma familia**. El select de `unidad_receta` se filtra según la familia de `unidad_compra`.

## 2. Cálculo automático del factor de conversión

Cuando ambas unidades vienen del catálogo PESO o VOLUMEN, el factor sale solo:

```text
factor_conversion = valor_base(unidad_compra) / valor_base(unidad_receta)
```

Ej: compra en **Kilogramo**, receta en **Gramo** → factor = 1000 / 1 = **1000**.
Ej: compra en **Libra**, receta en **Onza** → factor = 453.592 / 28.3495 ≈ **16**.

El campo se muestra **deshabilitado** con el valor calculado y un texto: "Calculado automáticamente: 1 kg = 1000 g".

## 3. Entrada manual solo para UNIDAD

Cuando la familia es **UNIDAD** y la unidad de compra NO es "Unidad" (ej. Caja, Paquete, Bandeja), el factor es ingresado por el usuario porque depende del proveedor (ej. "1 caja = 24 unidades").

- Compra = "Unidad" y receta = "Unidad" → factor fijo en 1, deshabilitado.
- Compra = "Caja/Paquete/Bandeja/Docena" → input manual habilitado (Docena puede prellenarse en 12 pero editable).

## 4. Cambios de esquema (DB)

Migración:
- En `insumos`: eliminar la columna `unidad_medida`.
- Mantener `unidad_compra`, `unidad_receta`, `factor_conversion` tal como están (siguen siendo `text`/`numeric` — el catálogo vive en el frontend, así RLS/RPCs no se tocan).

No hay impacto en `compras`, `receta_detalle`, `inventario_actual`, `extras_permitidos` ni en ninguna RPC.

## 5. Cambios en frontend

**Nuevo archivo** `src/lib/unidades.ts`:
- Constantes del catálogo (familias, unidades con valor base y label).
- Helpers: `getFamilia(unidad)`, `getUnidadesDeFamilia(familia)`, `calcularFactor(compra, receta)`, `requiereFactorManual(compra, receta)`.

**`src/lib/bodega-schemas.ts`:**
- Quitar `unidad_medida` de `insumoSchema`.
- `unidad_compra` y `unidad_receta` ahora son `z.enum([...])` validando contra el catálogo.
- Validación cruzada: misma familia.

**`src/components/bodega/insumo-form.tsx`:**
- Reemplazar los 3 inputs (`unidad_medida`, `unidad_compra`, `unidad_receta`) por:
  - Select **Unidad de compra** (agrupado por familia con `<SelectGroup>`).
  - Select **Unidad de receta** (opciones filtradas por familia de la unidad de compra; se autoselecciona la unidad base por defecto).
  - Input **Factor de conversión**: deshabilitado y autocalculado para PESO/VOLUMEN; habilitado para UNIDAD con compra ≠ "Unidad"; helper text explicativo en ambos casos.
- Eliminar el campo "Unidad de medida".

**Componentes que mostraban `unidad_medida`** (reemplazar por `unidad_receta`, que ahora es la única unidad operativa):
- `src/components/bodega/insumos-tab.tsx` (columna tabla + edición).
- `src/components/bodega/inventario-tab.tsx` (filtro + display de stock).
- `src/components/bodega/compra-detail-sheet.tsx` (display cantidades).
- `src/routes/_app.bodega.inventario.$id.tsx` (header, stock mínimo, ajustar-stock).

Esto mantiene la lógica intacta: el stock siempre se mide en `unidad_receta` (consistente con compras que ya convierten con `factor_conversion`).

## 6. Migración de datos existentes

Antes del DROP de la columna, copiar `unidad_medida → unidad_receta` solo si quedó vacía:

```text
UPDATE insumos SET unidad_receta = unidad_medida
WHERE coalesce(trim(unidad_receta),'') = '';
```

(En la práctica `unidad_receta` ya está poblada porque era required, así que es solo defensa.)

## 7. Orden de implementación

1. Migración SQL (DROP `unidad_medida`).
2. `src/lib/unidades.ts` con catálogo + helpers.
3. Actualizar `insumoSchema` y `InsumoForm` con selects + factor auto.
4. Reemplazar referencias a `unidad_medida` → `unidad_receta` en los 4 componentes/rutas listadas.
5. QA: crear insumo de PESO (kg→g auto), de VOLUMEN (L→ml auto), de UNIDAD/Caja (manual), y verificar tabla Insumos, Inventario, detalle de Compra, ajuste de stock.

## Notas técnicas

- `Select` de shadcn ya está disponible.
- El catálogo vive en el cliente; si más adelante se quiere multi-idioma o unidades custom por negocio, se puede mover a una tabla `unidades` sin romper API.
- No se tocan RPCs (`registrar_compra`, `crear_receta`, etc.) porque siguen leyendo `factor_conversion` desde `insumos`.
