## Objetivo

Permitir abrir una mesa desde la vista de servicio:
- **Mesero**: abre una mesa `LIBRE` y queda auto-asignado a sí mismo.
- **Admin/Superadmin/Cajero**: abre una mesa `LIBRE` eligiendo qué mesero la atenderá.

Cerrar la mesa ya existe (RPC `cerrar_mesa` + botón "Cerrar mesa" en el detalle) y funciona para ambos roles: solo se documenta, sin cambios.

## Comportamiento actual

- Hoy una mesa pasa a `OCUPADA` únicamente cuando el cliente escanea el QR, acepta un prepedido, o llama al mesero.
- El admin puede "Asignar mesero" desde el card de la lista, pero eso solo escribe `id_mesero_asignado` sin cambiar el estado — la mesa sigue `LIBRE` hasta que ocurra una interacción del cliente.
- No hay forma de que el mesero, desde su vista de servicio, abra una mesa `LIBRE` y se autoasigne para empezar a tomar pedido.

## Diseño

### 1. Base de datos — nueva migración

RPC `abrir_mesa(p_id_mesa uuid, p_id_mesero uuid DEFAULT NULL)`:

- `SECURITY DEFINER`, `search_path=public`.
- Valida `current_user_negocio()` y que la mesa pertenezca a ese negocio.
- Lee `rol` del llamante en `usuarios_staff`.
- Resolución del mesero a asignar:
  - Si `p_id_mesero IS NULL`:
    - Si llamante es `MESERO` → `p_id_mesero := auth.uid()`.
    - Si llamante es `ADMIN/SUPERADMIN/CAJERO` → error `Debes seleccionar un mesero`.
  - Si `p_id_mesero` viene:
    - Debe existir en `usuarios_staff` con `rol='MESERO'`, `estado='ACTIVO'`, mismo `id_negocio`.
    - Un `MESERO` solo puede indicar su propio `id_usuario` (bloquea que un mesero asigne a otro).
- Estado esperado: `mesas.estado = 'LIBRE'`. Si ya está `OCUPADA` → error `La mesa ya está abierta` (el flujo correcto es reasignar).
- `UPDATE mesas SET estado='OCUPADA', id_mesero_asignado=p_id_mesero, asignada_at=now(), liberada_at=NULL, solicitud_cliente=NULL, solicitud_at=NULL WHERE id_mesa=p_id_mesa`.
- `RETURN p_id_mesero`.
- `REVOKE ALL ... FROM PUBLIC`; `GRANT EXECUTE ... TO authenticated`.

### 2. Server function

En `src/lib/servicio.functions.ts`:

```ts
const abrirMesaSchema = z.object({
  idMesa: z.string().uuid(),
  idMesero: z.string().uuid().nullable().optional(),
});
export const abrirMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => abrirMesaSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: idMesero, error } = await context.supabase.rpc("abrir_mesa", {
      p_id_mesa: data.idMesa,
      p_id_mesero: data.idMesero ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { idMesero: idMesero as string };
  });
```

### 3. UI — `src/routes/_app.servicio.index.tsx` (`MesaCard`)

- Cuando `m.estado === 'LIBRE'`:
  - **Mesero** (no admin): botón principal "Abrir mesa" que:
    - Ejecuta `abrirMesa({ idMesa })` (auto-asignación).
    - Al éxito, navega a `/servicio/$idMesa` y refresca queries `servicio/mesas` y `mesaSesion`.
    - Toast: "Mesa abierta y asignada a ti".
  - **Admin/Cajero**: botón "Abrir mesa" que abre un nuevo `AbrirMesaDialog` con:
    - Selector de mesero (reutiliza `listarMeserosNegocio`, muestra "(fuera de turno)" si aplica).
    - Botón "Abrir mesa" → `abrirMesa({ idMesa, idMesero: sel })`.
    - Al éxito: toast, cierra dialog, refresca queries.
  - El Link a `/servicio/$idMesa` de la card se envuelve con `preventDefault` cuando la mesa está LIBRE para que el clic ejecute la acción de abrir (mesero) o abra el dialog (admin), no el detalle vacío.
- Cuando `m.estado === 'OCUPADA'`:
  - Comportamiento actual (link al detalle, y admin mantiene "Reasignar mesero" con `ReasignarMeseroDialog`).

### 4. Nuevo componente `src/components/servicio/abrir-mesa-dialog.tsx`

- Copia estructural de `ReasignarMeseroDialog` pero:
  - Sin `meseroActualId`.
  - Título "Abrir mesa" / descripción "Selecciona el mesero que la atenderá".
  - Mutación llama `abrirMesa` en vez de `reasignarMeseroMesa`.
  - Al éxito navega a `/servicio/$idMesa` con el `useNavigate` del router.

### 5. Cerrar mesa (sin cambios)

- El botón "Cerrar mesa" en `_app.servicio.$idMesa.tsx` ya está disponible para el mesero asignado y admin. `cerrar_mesa` valida items pendientes, transferencias pendientes y libera la mesa.

## Archivos a tocar

- Nueva migración SQL (RPC `abrir_mesa` + grants).
- `src/lib/servicio.functions.ts` — nueva `abrirMesa`.
- `src/components/servicio/abrir-mesa-dialog.tsx` — nuevo.
- `src/routes/_app.servicio.index.tsx` — `MesaCard`: botón "Abrir mesa" para libres, según rol.
- `src/integrations/supabase/types.ts` — regenerado tras la migración.

## Verificación

- Mesero en turno con mesa LIBRE → "Abrir mesa" → mesa queda OCUPADA, `id_mesero_asignado = él`, `asignada_at = now`, navega al detalle.
- Mesero intenta abrir una mesa ya OCUPADA por otro → error del RPC (mesa ya abierta); UI muestra toast.
- Admin sobre mesa LIBRE → dialog con selector → escoge mesero → abrir → mismo resultado; el card refleja el nombre del mesero.
- Admin/Mesero cierra la mesa (flujo actual) → vuelve a LIBRE; puede volver a abrirse.
- `bunx tsgo --noEmit` limpio.

## Fuera de alcance

- Mostrar la sala/orden preferida para elegir mesero automáticamente (ya cubierto por el algoritmo de asignación en `asignar_mesero_a_mesa`; aquí el admin elige manualmente).
- Cambiar `cerrar_mesa` o el botón existente.
