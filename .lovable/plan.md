
# Plan: Menú público por mesa (Paso 6.1)

## Decisión clave de ruta

La URL `/menu?mesa=…` propuesta en el prompt **choca** con las rutas admin existentes (`/menu/categorias`, `/menu/productos`, `/menu/recetas`) que viven bajo `_app/menu` y exigen sesión. Para mantenerlas intactas, la vista pública vivirá en una ruta nueva y aislada:

- **Pública (nueva):** `/carta/$idMesa` → `src/routes/carta.$idMesa.tsx`
- Se actualizará la URL que codifica el QR en `MesaDetailDialog` de `${origin}/menu?mesa=...` a `${origin}/carta/${id_mesa}` (cambio mínimo, una sola línea). Los QR aún no impresos no se ven afectados; los ya generados se reimprimen al editar la mesa.

## Backend (acceso público sin sesión)

Las tablas `productos`, `categorias`, `mesas` tienen RLS basada en `current_user_negocio()`, que devuelve `null` para anónimos. No abriremos RLS al rol `anon`. En su lugar, dos **server functions públicas** que usan `supabaseAdmin` con filtros estrictos por `id_mesa`:

1. `getMenuPublico({ idMesa })` en `src/lib/menu-publico.functions.ts`
   - Valida `idMesa` con Zod (uuid).
   - Lee `mesas` (id_negocio, identificador, estado) — si no existe, 404.
   - Lee `productos` activos del negocio (`id_producto, nombre_producto, descripcion_producto, precio_venta, url_imagen, id_receta`) y deriva categoría/subcategoría vía `receta_master` → `categorias` / `subcategorias`.
   - Devuelve `{ mesa, categorias: [{id, nombre}], productos: [{...campos seguros + id_categoria + nombre_categoria}] }`. Solo columnas seguras; no se filtra ningún dato de otros negocios ni PII.

2. `llamarMesero({ idMesa })` en el mismo módulo
   - Valida uuid.
   - `UPDATE mesas SET estado='OCUPADA' WHERE id_mesa = :id` (admin client, scoped por id). Devuelve `{ ok: true }`.

Ambas son `createServerFn` (sin `requireSupabaseAuth`) llamadas desde el componente cliente — no se invocan en `loader` para evitar problemas de SSR/prerender.

## Frontend

**Archivo nuevo:** `src/routes/carta.$idMesa.tsx`

Estructura:
- `Route.useParams()` para `idMesa`.
- `useQuery(['carta', idMesa], () => getMenuPublico({ data: { idMesa } }))` para cargar el menú.
- Estado local `fase: 'onboarding' | 'menu'`.
- `useMutation` para `llamarMesero`.

### Fase 1 — Onboarding
Modal centrado mobile-first (no usa `Dialog` modal pesado; pantalla completa con tarjeta) con:
- Identificador de la mesa ("Mesa 5").
- Texto: *"Revisa nuestro menú y cuando tengas claro qué vas a pedir llama a tu mesero, te atenderemos con gusto"*.
- Botón "Continuar" → `setFase('menu')`.

### Fase 2 — Catálogo tipo Rappi
- **Header sticky superior**: nombre/identificador de mesa + pills horizontales de categorías (`overflow-x-auto`, scroll suave, pill activa destacada con `bg-primary`).
- **Lista de productos** agrupados o filtrados por categoría activa (filtro client-side sobre la respuesta). Tarjetas con:
  - `url_imagen` (con fallback `ImageIcon` si null).
  - `nombre_producto` (font-medium).
  - `descripcion_producto` truncada a 2 líneas (`line-clamp-2`).
  - `precio_venta` formateado `Intl.NumberFormat` ($ COP/local).
- **Sticky Bottom Bar** (`fixed bottom-0 inset-x-0`) con padding seguro (`pb-[env(safe-area-inset-bottom)]`), botón grande primario con icono `Bell` de `lucide-react`: **"Llamar mesero"**.
  - Estado deshabilitado mientras la mutación corre.
  - Si `mesa.estado === 'OCUPADA'` al cargar o tras el click, muestra estado "Mesero notificado" (botón secundario, deshabilitado) — sin re-llamadas accidentales.
  - Al éxito: `toast.success("¡Tu mesero va en camino!")` y refresca la query.
- Padding inferior en la lista (`pb-28`) para que el último producto no quede bajo la barra.

### Estados
- Loading: skeletons de tarjetas.
- Error / mesa no encontrada: pantalla con mensaje claro ("Mesa no válida, pide ayuda al personal").
- Sin productos: vacío amable.

## Diseño y tokens
- Mobile-first estricto, sin scroll horizontal (excepto pills).
- Solo tokens semánticos de `src/styles.css` (primary, muted, card, etc.). Sin colores hardcodeados.
- Tipografía y `Toaster` ya están globales en `__root.tsx`.

## Archivos a crear / modificar

Crear:
- `src/lib/menu-publico.functions.ts` — server fns públicas.
- `src/routes/carta.$idMesa.tsx` — vista pública.
- (Opcional) `src/components/carta/producto-card.tsx`, `category-pills.tsx`, `llamar-mesero-bar.tsx` para mantener el route file simple.

Modificar (mínimo):
- `src/components/configuracion/mesas/mesa-detail-dialog.tsx` — cambiar la URL del QR a `${origin}/carta/${mesa.id_mesa}`.

## Restricciones honradas
- No se tocan rutas `/menu/*` (admin), ni `_app`, ni sidebar, ni Compras/Inventario/Recetas.
- No se modifica el esquema de productos. Solo se hace `UPDATE` a `mesas.estado` (campo ya existente).
- Vista 100% lectura sobre productos: sin carrito, sin editar, sin eliminar.
- Sin mock data: lectura real vía server fn → Supabase.

## QA antes de cerrar
1. Generar mesa, abrir QR del modal, verificar que el QR apunta a `/carta/<uuid>`.
2. Abrir esa URL en modo incógnito (sin sesión): se ve onboarding → menú → llamar mesero.
3. Verificar en `supabase--read_query` que `mesas.estado` cambió a `OCUPADA`.
4. Probar viewport móvil (~390px): sin scroll horizontal, CTA siempre visible, pills scrolleables.
