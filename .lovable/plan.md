# Módulo Menú — Plan de implementación

Construye el módulo "Menú" como cuarta sección del sidebar, respetando la arquitectura de Bodega que ya existe (rutas TanStack `_app.menu.*`, tablas con RLS por `current_user_negocio()`, RPCs para transacciones, formularios con `responsive-sheet` + Zod, tablas con vista "card" en móvil).

## 1. Backend (Supabase)

### Nuevas tablas

- **`categorias`**: `id_categoria`, `id_negocio`, `nombre`, `created_at`. Único `(id_negocio, nombre)`.
- **`subcategorias`**: `id_subcategoria`, `id_categoria`, `id_negocio`, `nombre`, `created_at`. Único `(id_categoria, nombre)`. ON DELETE RESTRICT desde categorías (no borrar si tiene subcategorías).
- **`receta_master`**: `id_receta`, `id_negocio`, `id_categoria`, `id_subcategoria` (ambas NOT NULL), `nombre_receta` (único por negocio), `descripcion`, `created_at`, `updated_at`.
- **`receta_detalle`**: `id_detalle`, `id_receta`, `id_insumo`, `cantidad` (en `unidad_receta` del insumo), `created_at`.
- **`productos`**: `id_producto`, `id_negocio`, `id_receta` (UNIQUE — 1:1 con receta), `nombre_producto`, `descripcion_producto`, `precio_venta` (default 0), `url_imagen`, `activo` (default true), `created_at`, `updated_at`.
- **`extras_permitidos`**: `id_extra`, `id_producto`, `id_insumo_extra`, `cantidad_porcion` (en `unidad_receta`), `precio_extra`. Único `(id_producto, id_insumo_extra)`.

Todas con RLS por `id_negocio = current_user_negocio()` (las dependientes vía EXISTS sobre el padre, como `detalle_compra`).

### RPCs (transaccionales)

- **`crear_receta(p_id_categoria, p_id_subcategoria, p_nombre, p_descripcion, p_ingredientes jsonb)`** → `uuid`
  - Valida categoría/subcategoría pertenecen al negocio y que subcategoría es hija de categoría.
  - Valida cada insumo pertenece al negocio y `cantidad > 0`.
  - Inserta `receta_master`, inserta filas en `receta_detalle`.
  - Inserta automáticamente en `productos` con `nombre_producto = nombre_receta`, `activo = true`, `precio_venta = 0`.
  - Retorna `id_receta`.
- **`actualizar_receta(p_id_receta, ...)`**: reemplaza detalle (delete + insert) y propaga `nombre_receta` al producto vinculado.
- **`duplicar_receta(p_id_receta)`**: copia receta + detalle con sufijo "(copia)" y dispara la auto-creación de producto.
- **`eliminar_receta(p_id_receta)`**: borra producto vinculado (cascade), detalle, master. Bloquea si el producto tuviera ventas (futuro).

Se prefiere RPC en vez de trigger para mantener visibilidad y errores claros al cliente (mismo patrón que `registrar_compra`).

### Lo que NO se toca

- Tabla `insumos`: solo lectura desde Menú.
- Tablas y funciones de Compras / Inventario / Proveedores.

## 2. Rutas (TanStack)

```
src/routes/
  _app.menu.tsx                          (layout vacío, head)
  _app.menu.index.tsx                    (redirect a /menu/categorias)
  _app.menu.categorias.tsx               (master-detalle cat/subcat)
  _app.menu.recetas.tsx                  (layout con <Outlet />)
  _app.menu.recetas.index.tsx            (listado de recetas)
  _app.menu.recetas.nueva.tsx            (creación gamificada, página completa)
  _app.menu.recetas.$id.tsx              (edición/detalle, página completa)
  _app.menu.productos.tsx                (Tabs Productos / Extras)
```

Sidebar (`app-sidebar.tsx`): nuevo grupo "Menú" con ítems Categorías, Recetas, Productos.

## 3. Componentes nuevos (`src/components/menu/`)

- `categoria-form.tsx`, `subcategoria-form.tsx` (usan `ResponsiveSheet` + Zod, igual que `proveedor-form`).
- `categorias-master-detail.tsx`: panel izquierdo con lista de categorías, panel derecho con subcategorías de la seleccionada. En móvil, vista apilada con back.
- `recetas-table.tsx`: tabla en desktop + cards apiladas en móvil. Acciones: editar, duplicar, eliminar.
- `receta-builder.tsx` (gamificado, página completa):
  - **Paso 1**: selección Categoría → Subcategoría (dos selects encadenados, opción "+ Crear nueva" inline).
  - **Paso 2**: campo `nombre_receta` con `Tooltip` shadcn permanente: *"El nombre de esta receta será el mismo nombre del producto final"*.
  - **Paso 3**: buscador "Spotlight" grande (Command de shadcn, autofocus) sobre `insumos`. Resultados como tarjetas grandes. Click → se añade al "carrito" lateral/inferior con `cantidad` editable + chip de `unidad_receta`.
  - Lista de ingredientes: animación `animate-scale-in` al agregar, `animate-fade-out` al quitar. Contador "X ingredientes" estilo carrito.
  - Botón "Guardar receta" → llama RPC `crear_receta`. Toast de éxito y navega a `/menu/productos` (Tab Productos) para que vean el producto auto-creado.
- `productos-tab.tsx`: tabla/cards de productos. Toggle `activo`. Editar abre `producto-form`.
- `producto-form.tsx` (Sheet grande):
  - Solo lectura: `nombre_producto` (proviene de receta) con leyenda "Para cambiar el nombre, edita la receta".
  - Editable: `descripcion_producto`, `precio_venta`, `url_imagen` (input URL por ahora; storage bucket queda fuera de alcance salvo que se pida).
  - Sección "Extras permitidos": lista de checkboxes con todos los `insumos` del negocio. Al marcar uno, se expande inline con inputs `cantidad_porcion` y `precio_extra`, mostrando dinámicamente la `unidad_receta` del insumo (ej. "gramos"). Guardar persiste en `extras_permitidos` (delete-insert).
- `extras-tab.tsx`: vista global de todos los extras configurados agrupados por producto. Permite editar/eliminar rápidamente. (Misma data, vista distinta.)

## 4. Schemas Zod (`src/lib/menu-schemas.ts`)

`categoriaSchema`, `subcategoriaSchema`, `recetaSchema` (con array de ingredientes mínimo 1), `productoSchema`, `extraSchema`.

## 5. UX / responsive

- Mobile-first: todas las tablas con componente `<DataView>` que renderiza `<table>` en `md:` y cards apiladas debajo (mismo patrón que `inventario-tab`).
- Animaciones: `animate-fade-in`, `animate-scale-in`, `hover-scale` ya disponibles en `styles.css`.
- Tooltip: `<Tooltip>` shadcn con `defaultOpen` o ícono `Info` con `TooltipProvider`.

## 6. Orden de ejecución

1. Migración: tablas + RLS + RPCs.
2. Sidebar + rutas base + layouts.
3. CRUD Categorías/Subcategorías (master-detalle).
4. Listado Recetas + creación gamificada + edición/duplicado/eliminación.
5. Productos (Tab) + edición con Extras.
6. Extras (Tab) — vista global.
7. QA responsive (móvil 375, tablet 768, desktop 1280).

## Notas técnicas

- Se respeta la convención de rutas con puntos (`_app.menu.recetas.tsx` como layout con `<Outlet />`, `_app.menu.recetas.index.tsx` como listado) — mismo fix aplicado a `bodega.inventario`.
- Toda escritura desde el cliente usa `supabase.rpc(...)` cuando hay transacción multi-tabla; lecturas usan `.from(...).select(...)`.
- Sin cambios en `insumos`, `compras`, `inventario_actual`, `movimientos_inventario`.
- `client.ts`, `types.ts` no se editan (los regenera Lovable tras la migración).
