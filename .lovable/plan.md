## Métodos de pago con QR

Permitir al admin subir un QR por cada plataforma de transferencia (Nequi, Daviplata, Bancolombia, Otra). Al cobrar, cuando el mesero elija la plataforma se muestra el QR a pantalla completa para que el cliente lo escanee.

### 1. Backend

**Nueva tabla `metodos_pago_qr`** (migración):
- `id_qr` uuid PK
- `id_negocio` uuid FK → `negocio`
- `plataforma` text (uno de: `Nequi`, `Daviplata`, `Bancolombia`, `Otra`)
- `etiqueta` text nullable (para "Otra", ej. "Movii")
- `url_qr` text (path en bucket)
- `titular` text nullable (nombre / referencia visible)
- `created_at`, `updated_at`
- Unique `(id_negocio, plataforma, etiqueta)` para evitar duplicados.
- RLS: SELECT/INSERT/UPDATE/DELETE para staff del mismo negocio (patrón existente vía `usuarios_staff`). GRANT a `authenticated` y `service_role`.

**Bucket de storage `qr-metodos-pago`** (privado). Políticas RLS sobre `storage.objects`:
- SELECT: cualquier staff autenticado del mismo negocio (path prefix `{id_negocio}/`).
- INSERT/UPDATE/DELETE: solo ADMIN/SUPERADMIN del negocio.

**`src/lib/metodos-pago.functions.ts`** (nuevo):
- `listarMetodosPagoQr()` → devuelve la lista con URLs firmadas (10 min).
- `guardarMetodoPagoQr({ plataforma, etiqueta?, path, titular? })` (admin).
- `eliminarMetodoPagoQr({ idQr })` (admin).
- Subida del archivo se hace desde el cliente con `supabase.storage.from("qr-metodos-pago").upload(...)` igual que comprobantes-pago, y luego se llama a `guardarMetodoPagoQr` con el path.

### 2. UI · Configuración

**Sidebar**: agregar entrada `Métodos de pago` en `CONFIG_NAV` (icono `QrCode` de lucide), apuntando a `/configuracion/metodos-pago`.

**Nueva ruta `src/routes/_app.configuracion.metodos-pago.tsx`** que monta `MetodosPagoTab` y exige `idNegocio` igual que `usuarios`.

**Nuevo componente `src/components/configuracion/metodos-pago-tab.tsx`**:
- Lista de 4 tarjetas: Nequi, Daviplata, Bancolombia, y un bloque "Otras" con botón "Agregar otra".
- Cada tarjeta muestra: nombre, miniatura del QR si existe (o placeholder), campo opcional "titular/referencia", botones "Subir / cambiar QR" y "Eliminar".
- Validaciones: imagen ≤ 8MB, tipos image/*.
- Solo visible/editable para ADMIN/SUPERADMIN (usar `useMiStaff`); para otros roles se redirige fuera (no debería verse pues sidebar lo filtra).

### 3. UI · Cobro (mesero)

En `src/components/servicio/pagar-sheet.tsx`, dentro de `PasoMetodo` cuando `metodo === "TRANSFERENCIA"`:
- Cargar `listarMetodosPagoQr` (TanStack Query, key `["metodosPagoQr"]`) una vez al abrir el método transferencia.
- Al hacer click en una plataforma (Nequi/Daviplata/Bancolombia/Otra) que tenga QR cargado, abrir un `Dialog` nuevo `QrDialog` mostrando:
  - Título: "Escanea con {plataforma}".
  - Subtítulo: titular si existe.
  - Imagen QR grande (max-w 80vw / 400px), centrada, fondo blanco.
  - Botón "Cerrar".
- La selección de plataforma sigue funcionando como hoy (se sigue exigiendo `subtipo` + comprobante). El QR es solo una ayuda visual; el flujo de subir comprobante no cambia.
- Si la plataforma no tiene QR cargado: badge sutil "Sin QR configurado" y un texto pequeño "Pídele al admin que cargue el QR en Configuración → Métodos de pago".
- Para "Otra", si hay varios registros con distintas etiquetas, mostrar un selector compacto con cada etiqueta antes de abrir el QR.

### 4. Fuera de alcance
- No se cambia el esquema de `pagos` ni `registrar_pago`.
- No se muestra el QR en la vista del cliente (`carta.$idMesa.tsx`); el cobro real sigue siendo presencial vía el sheet del mesero.
- No se agregan métodos de pago nuevos al enum `metodo` (sigue EFECTIVO/TRANSFERENCIA/DATAFONO).
