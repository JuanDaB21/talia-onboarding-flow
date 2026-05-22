## Cambios en Productos (y migración de Extras a Recetas)

### 1. Página `/menu/productos` — Simplificar
**Archivo:** `src/routes/_app.menu.productos.tsx`
- Cambiar título a **"Productos"** (sin "y Extras").
- Eliminar `<Tabs>`, `TabsList`, `TabsTrigger`, `TabsContent` y el import de `ExtrasTab`.
- Renderizar solo `<ProductosTab>` directamente.
- Actualizar `head().meta.title` a `"Productos — Menú"`.

Eliminar archivo `src/components/menu/extras-tab.tsx` (ya no se usa).

### 2. `ProductoForm` — Subida de imagen + sin extras
**Archivo:** `src/components/menu/producto-form.tsx`
- **Quitar toda la sección "Extras permitidos"**: estado `extras`, `insumos`, `loadingExtras`, helpers `toggleExtra`/`setExtraField`, la query de `extras_permitidos`, la llamada RPC `guardar_extras_producto`, y el bloque JSX completo.
- **Reemplazar input "URL imagen"** por un uploader:
  - Input `<input type="file" accept="image/*">` con preview del archivo seleccionado o de `producto.url_imagen` actual.
  - Botón "Quitar imagen" si hay imagen.
  - Al guardar: si hay archivo nuevo, subir a bucket `producto-imagenes` en la ruta `{id_negocio}/{id_producto}-{timestamp}.{ext}`, obtener `publicUrl`, y persistirlo en `productos.url_imagen`.
- Manejar estado local `imagenFile: File | null` y `imagenUrl: string | null` (inicializado desde `producto.url_imagen`).
- Mantener el `Switch` de "Producto activo", precio, descripción y campo de nombre solo lectura.

### 3. `RecetaBuilder` — Nuevo Paso 4: Extras
**Archivo:** `src/components/menu/receta-builder.tsx`
- Agregar nueva `<section>` "Paso 4: Extras permitidos" con la **misma UX que la sección actual de extras en `ProductoForm`**: lista de insumos con checkbox, al marcar muestra inputs `cantidad_porcion` y `precio_extra`.
- Estado local `extras: Record<string, ExtraState>`.
- **En modo `edit`**: al cargar la receta, también cargar `productos.id_producto` correspondiente y los `extras_permitidos` actuales para prellenar.
- **Al guardar** (`guardar()`):
  - Modo `create`: tras `crear_receta` exitoso, obtener `id_producto` (consulta a `productos` por `id_receta`) y llamar `guardar_extras_producto`.
  - Modo `edit`: tras `actualizar_receta`, llamar `guardar_extras_producto` con el `id_producto` ya conocido.
- Mantener el "paso 4" deshabilitado visualmente hasta que haya ingredientes (igual estilo que pasos previos).
- Tras guardar en modo `create`, redirigir a `/menu/recetas` (no a `/menu/productos`).

### 4. Schema y storage
**Archivo:** `src/lib/menu-schemas.ts`
- Quitar `url_imagen` del `productoSchema` (la imagen se maneja fuera del form con react-hook-form).

**Migración SQL** (bucket público para imágenes de producto):
- Crear bucket `producto-imagenes` (public = true).
- RLS en `storage.objects`:
  - SELECT público (bucket público).
  - INSERT/UPDATE/DELETE para `authenticated` cuando el primer segmento del path coincida con `current_user_negocio()::text` (aísla por negocio).

### Notas técnicas
- No se modifica ningún RPC ni tabla del dominio. `extras_permitidos` sigue ligado a `productos` (modelo de datos intacto); solo cambia **dónde se edita** en la UI.
- Componentes `productos-tab.tsx` y `recetas-table.tsx` no requieren cambios.
- Tras la migración, los extras existentes se preservan y se podrán editar desde la receta correspondiente.
