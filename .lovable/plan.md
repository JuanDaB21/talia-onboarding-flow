## Espacios de trabajo dinámicos

Reemplazar el par fijo `COCINA / BARRA` por **espacios de trabajo** configurables por negocio, sin romper los flujos actuales. `Cocina` y `Barra` se mantienen pero pasan a ser dos espacios del sistema (no borrables), y se podrán crear/activar/desactivar otros (p. ej. *Plancha*, *Postres*).

---

### 1. Base de datos (migración)

Nueva tabla `espacios_trabajo` por negocio:

- `id_espacio`, `id_negocio`, `nombre`, `slug` (único por negocio), `activo`, `es_sistema`, `orden`, timestamps.
- RLS por `current_user_negocio()`. GRANT a `authenticated` + `service_role`.
- Seed automático por cada negocio existente: **Cocina** (`slug=cocina`, `es_sistema=true`) y **Barra** (`slug=barra`, `es_sistema=true`).
- Trigger en `negocio` para crear ambos al registrar un nuevo negocio.
- Reglas:
  - No se puede desactivar el último espacio activo del negocio.
  - No se puede eliminar un espacio `es_sistema=true` ni uno con categorías/recetas asociadas (solo desactivar).

Reemplazo del campo `destino`:

- `categorias.destino text` → `categorias.id_espacio uuid` (FK a `espacios_trabajo`). Backfill: `COCINA→cocina`, `BARRA→barra` del mismo negocio.
- `pedido_items.destino text` → `pedido_items.id_espacio uuid` (FK, nullable como hoy). Mismo backfill.
- Actualizar funciones que usan `destino`: `aceptar_prepedido_mesa`, `iniciar_comanda_estacion`, etc. — pasan a recibir/usar `id_espacio` o `slug`.

Roles dinámicos sin tocar el enum:

- Mantener `rol_staff` actual (incluye `COCINA` y `BARRA` por compatibilidad).
- Añadir `usuarios_staff.id_espacio_asignado uuid` (nullable, FK a `espacios_trabajo`).
- Cuando el rol es de estación (cocina/barra/cualquier espacio nuevo), se guarda con `rol = 'ESTACION'` (nuevo valor del enum) + `id_espacio_asignado`. Para no romper el staff existente: backfill `COCINA → rol=ESTACION + id_espacio=cocina`, `BARRA → rol=ESTACION + id_espacio=barra`. Los valores `COCINA`/`BARRA` del enum quedan en desuso pero presentes para no romper migraciones pasadas.

### 2. Backend (server functions)

Nuevo `src/lib/espacios.functions.ts`:

- `listEspacios({ soloActivos? })`, `crearEspacio`, `renombrarEspacio`, `toggleEspacio`, `eliminarEspacio`, `reordenarEspacios`. Validan unicidad de slug, regla "al menos un activo" y permisos admin.

Adaptaciones en funciones existentes:

- `preparacion.functions.ts` (kanban): filtrar por `id_espacio` en vez de `destino IN ('COCINA','BARRA')`.
- `turno.functions.ts`: al iniciar/finalizar turno de un staff con `rol='ESTACION'`, validar contra `id_espacio_asignado`.
- `usuarios.functions.ts` + `configuracion-schemas.ts`: el formulario de usuario expone un selector "Espacio de trabajo" cuando el rol elegido es de estación; persiste `id_espacio_asignado`.
- `menu/recetas` (`crear_receta` / `actualizar_receta`): la categoría ya determina el espacio destino vía `categorias.id_espacio` — sin cambios de API más allá del rename interno.
- `analytics.functions.ts`, `dashboard/operacion-panel.tsx`: agrupar tiempos por espacio en vez de hardcodear COCINA/BARRA.

### 3. Frontend

**Configuración → nueva sección "Espacios de trabajo"**

- Card en `_app.configuracion.index.tsx`.
- Nueva ruta `_app.configuracion.espacios.tsx`: lista de espacios con toggle activo/inactivo, renombrar, crear nuevo, eliminar (solo no-sistema y sin uso). Bloquea desactivar si quedaría 0 activos.

**Sidebar dinámico (`app-sidebar.tsx`)**

- Reemplazar entradas fijas `Cocina` y `Barra` en `SERVICIO_NAV` por un render dinámico: hook `useEspacios()` (React Query) → un `SidebarMenuItem` por espacio activo, apuntando a `/estacion/$slug` con ícono configurable (default: `Flame` para cocina, `Wine` para barra, `Utensils` para otros).
- Visibilidad: ADMIN/SUPERADMIN/CAJERO ven todos los activos; staff con `rol='ESTACION'` ve solo su `id_espacio_asignado`.

**Rutas de estación unificadas**

- Nueva ruta dinámica `_app.estacion.$slug.tsx` que renderiza `<KanbanBoard idEspacio={...} titulo={...} />`.
- `_app.cocina.tsx` y `_app.barra.tsx` quedan como redirects a `/estacion/cocina` y `/estacion/barra` para no romper enlaces existentes.
- `KanbanBoard`, `ComandaSheet`, `comanda-print.ts`, `printService.ts`: aceptar `idEspacio` + `nombreEspacio` en vez de `destino: 'COCINA'|'BARRA'`.

**Categorías / recetas (`categorias-master-detail.tsx`, `menu/receta-builder.tsx`)**

- El selector "Destino" pasa de radio fijo a `<Select>` de espacios activos. Migración mantiene la asignación previa.

**Pago, operación, etc.**

- `_app.servicio.$idMesa.tsx`, `_app.operacion.tsx`, `pagos.functions.ts`: cualquier UI/lógica que listaba "Cocina/Barra" itera sobre espacios.

**Gate de rol (`_app.tsx` RoleRedirect, `turno-gate.tsx`)**

- Para `rol='ESTACION'`: home = `/estacion/<slug del id_espacio_asignado>`, allowed = `['/estacion/<slug>']`.
- `TurnoGate` recibe `idEspacio` y valida que el usuario sea ADMIN o `rol='ESTACION'` con ese espacio.
- Compatibilidad: mientras existan usuarios con rol legado `COCINA`/`BARRA` (post-backfill no debería pasar), tratarlos igual que `ESTACION` con el espacio correspondiente.

**Formulario de usuarios (`configuracion/usuario-form.tsx` + `usuarios-tab.tsx`)**

- Reemplazar opciones `COCINA`/`BARRA` por una sola opción "Estación" + selector de espacio activo. ADMIN/MESERO/CAJERO siguen igual.

### 4. Compatibilidad y orden de despliegue

1. Migración SQL: tabla + seed + columnas nuevas + backfill + triggers + ajuste de funciones SQL. Mantiene columnas `destino` viejas un release (vista o columna calculada) para no romper consultas en vuelo, y se eliminan al final de la migración tras backfill verificado.
2. Regenera tipos Supabase.
3. Cambios de frontend/backend usando `id_espacio`.
4. Smoke test mental de cada flujo: tomar pedido → enviar a estación → kanban estación → marcar listo → entregar → cobrar → cierre de caja → reportes.

### Notas técnicas

- Slug se genera desde el nombre (`slugify`) y se valida único por negocio.
- Íconos: pequeño mapa `slug → lucide icon`, con fallback genérico.
- Realtime: las suscripciones del kanban filtran por `id_espacio`.
- No se toca `auth`, `storage`, `realtime`, ni `supabase_functions`.
- `rol_staff` no se reduce; solo se añade `ESTACION` para evitar romper migraciones y datos previos.
