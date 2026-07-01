## Objetivo

Desde la vista admin de "Mesas en servicio" (`/servicio`), permitir asignar o reasignar el mesero de cualquier mesa sin tener que entrar al detalle de la mesa.

## Alcance

- Solo UI. El backend ya existe:
  - `listarMeserosNegocio` — lista meseros activos.
  - `reasignarMeseroMesa` — cambia el mesero (ya permite ADMIN/SUPERADMIN/CAJERO/MESERO).
- No se cambian permisos, esquema ni políticas.

## Cambios

### 1. Extraer diálogo reutilizable
Mover el componente `ReasignarMeseroDialog` (hoy dentro de `src/routes/_app.servicio.$idMesa.tsx`, líneas ~1361-1457) a un archivo compartido:

- Nuevo: `src/components/servicio/reasignar-mesero-dialog.tsx`
- Exportarlo y reemplazar la copia local en `_app.servicio.$idMesa.tsx` por el import compartido (comportamiento idéntico).
- Ajustar invalidaciones para refrescar tanto la vista de detalle (`mesaSesion`) como la grilla (`servicio`, `mesas` — clave que usa el index).

### 2. Botón en cada tarjeta de mesa (solo admin)
En `src/routes/_app.servicio.index.tsx`, dentro de `MesaCard`:

- Recibir `esAdmin: boolean` como prop desde `ServicioIndex`.
- Añadir un botón discreto en la tarjeta ("Asignar mesero" si no hay mesero asignado, "Reasignar" si ya hay uno) visible solo cuando `esAdmin === true`.
- El botón NO debe navegar al detalle: usar `stopPropagation` + `preventDefault` para no disparar el `<Link>` que envuelve la tarjeta.
- Al hacer clic, abrir `ReasignarMeseroDialog` con `idMesa` y `meseroActualId={m.id_mesero_asignado}`.
- Tras éxito, invalidar la query `["servicio", "mesas"]` (ya lo hará el diálogo) y mostrar toast (ya lo maneja el diálogo).

### 3. UX
- Ubicación del botón: junto al nombre del mesero (o en el lugar donde hoy dice "Asignada …"), usando `<UserCheck />` como icono.
- Texto:
  - Sin mesero: "Asignar mesero"
  - Con mesero: "Reasignar"
- Tamaño `sm`, `variant="outline"`.

## Notas técnicas

- El `MesaCard` actualmente es un `<Link>` completo. Para evitar que el clic en el botón navegue, envolver el botón en un `<div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>` y el `Dialog` fuera del `<Link>` (renderizar el `Dialog` como hermano en un fragmento, o convertir la tarjeta en un contenedor con navegación programática al hacer clic en el área principal). Enfoque más seguro: mantener el `<Link>`, pero el botón + Dialog se renderizan como hijos con handlers que detienen la propagación.

## Verificación

- Como admin: aparece el botón en cada tarjeta; abrir diálogo, seleccionar mesero, guardar → toast "Mesero reasignado", la tarjeta actualiza el nombre.
- Como mesero (no admin): no aparece el botón (comportamiento actual intacto).
- Entrar al detalle sigue funcionando: el diálogo del detalle sigue existiendo (misma implementación compartida).
- `bunx tsgo --noEmit` sin errores.
