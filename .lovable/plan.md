# Dashboard, Operación en vivo y Cierre de Caja

Todo entregado en una sola pasada, accesible solo para rol `ADMIN`/`SUPERADMIN` desde un nuevo grupo "Administración" en el sidebar.

## 1. Sidebar y rutas

Nuevo grupo "Administración" (solo ADMIN):
- `/dashboard` — KPIs del día (reemplaza el placeholder actual).
- `/operacion` — Mesas en vivo, alertas de retraso, personal en turno y panel de pagos por aprobar.
- `/caja` — Resumen de caja del día (movimientos por método, base, pendientes).
- `/caja/cierre` — Wizard paso a paso de cierre.
- `/caja/cierres/$id` — Reporte imprimible inmutable de un cierre.

`TurnoGate` no aplica a ADMIN, así que el acceso se filtra solo por rol en el sidebar y con un `gateAdmin` simple en cada ruta (redirige si no es ADMIN).

## 2. Base de datos (migración nueva)

### Tablas

`caja_dia` — una fila por día por negocio.
- `id_caja`, `id_negocio`, `fecha date` (UNIQUE con negocio)
- `base_inicial numeric`, `abierta_por uuid`, `abierta_at`
- `estado text` (`ABIERTA` | `CERRADA`)
- `cerrada_por uuid`, `cerrada_at`
- `efectivo_sistema`, `transferencia_sistema`, `datafono_sistema numeric` (snapshot al cerrar)
- `efectivo_fisico`, `datafono_fisico numeric` (lo que ingresó el admin)
- `diferencia_efectivo`, `diferencia_datafono numeric`
- `nota_cuadre text`
- RLS: `id_negocio = current_user_negocio()`.

### RPCs (SECURITY DEFINER, validan rol ADMIN/SUPERADMIN)

- `abrir_caja(p_base numeric)` — crea fila del día si no existe; falla si ya hay una ABIERTA o CERRADA hoy.
- `resumen_caja_dia()` — devuelve, para el día abierto del negocio:
  - totales por método (`efectivo`, `transferencia_confirmada`, `transferencia_pendiente`, `datafono`)
  - desglose de efectivo por mesero
  - conteo de pagos pendientes de verificación
  - base inicial y estado de la caja
- `cerrar_caja(p_efectivo_fisico, p_datafono_fisico, p_nota)`:
  - valida que no haya pagos `PENDIENTE` ni mesas con cuenta abierta
  - calcula totales del sistema y diferencias
  - si hay diferencia y `p_nota` vacío → error
  - marca `caja_dia` CERRADA, registra snapshot
  - hace `UPDATE usuarios_staff SET esta_en_turno=false, turno_iniciado_at=null WHERE id_negocio=… AND esta_en_turno=true` (auto-cierre de turnos olvidados)
  - devuelve `id_caja`

### Índices
- `pagos(id_negocio, created_at)` para los KPIs.
- `pedido_items(estado_preparacion, iniciado_at)` para alertas.

## 3. Server functions (`src/lib/admin.functions.ts` y `caja.functions.ts`)

### `admin.functions.ts`
- `getKpisHoy()` — ventas del día (pagos confirmados), ticket promedio (ventas / mesas cerradas hoy = pedidos PAGADOS distintos por mesa), ocupación actual (`mesas.estado<>'LIBRE'` / total), promedio real de preparación (`AVG(listo_at - iniciado_at)` items de hoy) vs promedio planeado (`AVG(tiempo_planeado_min)`).
- `getAlertasOperacion()` — items con `estado_preparacion IN ('EN_COLA','EN_PREPARACION')` cuyo tiempo transcurrido > `tiempo_planeado_min * 1.2`. Devuelve identificador de mesa, producto, destino, minutos de retraso.
- `getPersonalEnTurno()` — `usuarios_staff` con `esta_en_turno=true`, agrupado por rol; para MESEROS incluye cuántas mesas tiene asignadas (estado<>'LIBRE').
- `getMesasOperacion()` — todas las mesas con estado, mesero asignado, hora de asignación, solicitud cliente activa, total pendiente.

`listarPagosPendientes` y `confirmarPago` ya existen en `pagos.functions.ts` — se reusan.

### `caja.functions.ts`
- `getEstadoCaja()` → llama RPC `resumen_caja_dia` + estado de la caja.
- `abrirCaja({ base })` → RPC `abrir_caja`.
- `cerrarCaja({ efectivoFisico, datafonoFisico, nota })` → RPC `cerrar_caja`, devuelve `idCaja`.
- `getCierre({ idCaja })` → carga la fila inmutable de `caja_dia` + top productos vendidos del día + hora pico (agrupado por hora de `pagos.created_at`).
- `listarCierres()` → historial.

Todas con `requireSupabaseAuth` y check de rol ADMIN en el RPC.

## 4. UI

### `/dashboard` (KPIs)
4 cards grandes: Ventas del día, Ticket promedio, Ocupación %, Tiempo prep. real vs planeado. Botones: "Ir a operación", "Ir a caja".

### `/operacion`
Tres secciones en grid:
- **Pagos por aprobar**: lista de `listarPagosPendientes` con miniatura del comprobante, mesa, mesero, método/subtipo, monto, botones Aprobar/Rechazar (reusa `confirmarPago`).
- **Alertas**: lista roja/amarilla con producto, mesa, minutos de retraso, destino.
- **Personal en turno**: lista agrupada por rol; los meseros muestran badge con número de mesas activas.
- **Mapa de mesas**: grid de tarjetas, color por estado.

Auto-refresh con `useQuery` + `refetchInterval: 15s`.

### `/caja`
- Si no hay caja abierta hoy → tarjeta "Abrir caja" con input de base inicial.
- Si abierta → resumen del día: base, total por método, desglose efectivo por mesero, # pagos pendientes (con link a `/operacion`), CTA "Cerrar caja" (deshabilitado si quedan pagos pendientes o mesas abiertas).
- Historial: lista de cierres anteriores con link al reporte.

### `/caja/cierre` — wizard 4 pasos
1. **Verificación previa**: comprueba 0 pagos pendientes y 0 mesas con cuenta abierta; bloquea si falla.
2. **Sistema**: tarjeta solo lectura con totales por método.
3. **Físico**: dos inputs (efectivo en caja, total datáfono).
4. **Conciliación**: muestra diferencia por método; si ≠ 0 obliga a llenar nota de cuadre. Botón "Cerrar caja" llama `cerrarCaja` y redirige al reporte.

### `/caja/cierres/$id`
Página imprimible (`@media print` limpio): cabecera negocio + fecha, base inicial, totales sistema vs físico, diferencias, nota, top productos, hora pico, lista de meseros desactivados. Botón "Imprimir".

## 5. Resumen de archivos

Nuevos:
- `supabase/migrations/…_caja_y_dashboard.sql`
- `src/lib/admin.functions.ts`
- `src/lib/caja.functions.ts`
- `src/routes/_app.operacion.tsx`
- `src/routes/_app.caja.tsx`
- `src/routes/_app.caja.cierre.tsx`
- `src/routes/_app.caja.cierres.$id.tsx`
- `src/components/admin/kpi-card.tsx`, `alertas-list.tsx`, `personal-turno.tsx`, `mesas-grid.tsx`, `pagos-pendientes.tsx`

Editados:
- `src/routes/_app.dashboard.tsx` (KPIs reales + gate ADMIN)
- `src/components/app-sidebar.tsx` (grupo Administración para ADMIN: Dashboard, Operación, Caja)
