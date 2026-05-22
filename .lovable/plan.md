## Sección Mesas — Gestión + QR autónomos

Reutiliza el patrón existente (`proveedores-tab` / `ResponsiveSheet`) pero con vista tipo grid de tarjetas y un `Dialog` para detalle/edición con QR en vivo. No se tocan Compras, Inventario ni Recetas.

### 1. Base de datos (migración nueva)

Tabla `mesas` con:
- `id_mesa` UUID PK (gen_random_uuid)
- `id_negocio` UUID NOT NULL
- `identificador` VARCHAR NOT NULL
- `estado` VARCHAR NOT NULL DEFAULT 'LIBRE' (preparado para 'OCUPADA' a futuro)
- `created_at`, `updated_at` timestamps
- Índice único por (`id_negocio`, `identificador`) para evitar duplicados

RLS (mismo patrón que el resto de tablas multi-tenant):
- `mesas_select_own` / `mesas_insert_own` / `mesas_update_own` / `mesas_delete_own` usando `current_user_negocio()`

Realtime habilitado vía `ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas`.

### 2. Dependencias

- Instalar `qrcode.react` (renderiza `<QRCodeCanvas>` en cliente, sin guardar imágenes).

### 3. Rutas / Navegación

- Reutilizar la ruta ya existente `src/routes/_app.configuracion.mesas.tsx` (hoy es placeholder "Próximamente"). Pasará a renderizar `<MesasTab idNegocio={...} />` usando `useCurrentNegocio`.
- No tocar el sidebar (la entrada "Mesas" ya existe en `CONFIG_NAV`).

### 4. Componentes (en carpeta dedicada `src/components/configuracion/mesas/`)

- `mesas-tab.tsx` — contenedor, carga y suscripción realtime.
- `mesa-card.tsx` — tarjeta del grid con identificador, badge de estado y mini-preview QR.
- `mesa-detail-dialog.tsx` — Dialog ShadCN con:
  - Input editable de "Identificador" (botón Guardar habilitado solo en `isDirty`).
  - `<QRCodeCanvas>` grande (~260px) con `value = ${window.location.origin}/menu?mesa=${id_mesa}`.
  - Botones (con `lucide-react`): "Copiar imagen", "Compartir", "Eliminar mesa" (con AlertDialog de confirmación).
- `nueva-mesa-dialog.tsx` — Dialog simple para crear (input identificador + crear).
- `src/lib/mesas-schemas.ts` — Zod schema (identificador 1–80 chars).

Comportamiento del grid: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`, botón flotante/header "Nueva mesa".

### 5. Acciones nativas del QR

- **Copiar imagen**: leer el `<canvas>` renderizado por `QRCodeCanvas` (ref), `canvas.toBlob()` → `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`. Fallback toast si el navegador no soporta `ClipboardItem`.
- **Compartir**: detección de capacidades:
  - Si `navigator.canShare({ files: [...] })` → compartir PNG como archivo.
  - Else si `navigator.share` → compartir `{ title, text, url }` con la URL de la mesa.
  - Else → fallback: copiar URL al portapapeles + toast.
- Toda acción usa `toast` (sonner) para feedback.

### 6. Datos y realtime

- `load()` inicial con `supabase.from('mesas').select().order('created_at')`.
- Suscripción `supabase.channel('mesas-<idNegocio>').on('postgres_changes', { event: '*', schema: 'public', table: 'mesas', filter: 'id_negocio=eq.<idNegocio>' }, ...)` → refetch local.
- Mutaciones directas (`insert`, `update`, `delete`) vía cliente Supabase del navegador (RLS aplica). No requiere serverFn.

### 7. Restricciones

- No se modifican archivos de bodega ni menú.
- Solo se edita `_app.configuracion.mesas.tsx` (ya placeholder) + nuevos archivos.
- QR siempre client-side, jamás se sube imagen a Storage.

### Notas técnicas
- `QRCodeCanvas` expone el canvas vía `ref`, lo cual es necesario para `toBlob`. Alternativa: ubicar el canvas dentro de un wrapper y query por `canvas` tag.
- El `id_mesa` se conoce al crear (Supabase devuelve la fila insertada); el QR se construye sólo después de persistir.
- `estado` se muestra como Badge ("Libre"/"Ocupada") aunque por ahora solo existirá 'LIBRE'.
