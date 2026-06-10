## Resumen
Implementar (1) campo `recibe_propinas` por usuario, (2) historial de turnos con cálculo de propinas por día activo basado en fecha de inicio del turno, (3) auto-cierre de turnos tras 12h con pg_cron cada 15 min.

## Decisiones aplicadas
1. `recibe_propinas = false` por defecto para todos los roles (incluido MESERO/BARRA). El admin lo marca manualmente al crear/editar.
2. **Regla de día activo**: cada turno cuenta como un único día, el de su `iniciado_at` (en zona horaria del negocio). Un turno iniciado 10-Jun 18:00 que termina 11-Jun 02:00 cuenta solo para el 10-Jun.
3. Solo cuenta el día de inicio (consecuencia de la regla anterior).
4. pg_cron cada 15 min llama un endpoint público que cierra turnos vencidos.

## Migración (DB)

1. **`usuarios_staff.recibe_propinas boolean not null default false`**.
2. **Tabla `turnos_staff`** — historial inmutable de turnos:
   - `id_turno`, `id_negocio`, `id_usuario`, `iniciado_at timestamptz`, `finalizado_at timestamptz null`, `cerrado_por text` (`'USUARIO' | 'AUTO_12H' | 'CIERRE_CAJA'` null mientras esté abierto).
   - Índices: `(id_negocio, iniciado_at)`, `(id_usuario, finalizado_at)`.
   - GRANT a `authenticated` y `service_role`; RLS por `id_negocio` (mismos patrones que `usuarios_staff`).
3. **RPCs actualizadas** (reemplazan a las actuales):
   - `iniciar_turno()`: marca `usuarios_staff` y abre fila en `turnos_staff`.
   - `finalizar_turno()`: marca `usuarios_staff` y cierra la fila abierta con `cerrado_por='USUARIO'`.
   - `cerrar_turnos_vencidos()` (SECURITY DEFINER): cierra filas abiertas con `iniciado_at < now() - interval '12 hours'` marcando `finalizado_at = iniciado_at + interval '12 hours'`, `cerrado_por='AUTO_12H'`, y actualiza `usuarios_staff`.
4. **Función `calcular_propinas_por_usuario(id_negocio, desde date, hasta date)`** (SECURITY DEFINER):
   - Para cada día D en `[desde, hasta]` (en TZ del negocio):
     - `propinas_dia(D)` = suma de `pagos.propina` cuyo `created_at::date AT TIME ZONE negocio.tz = D` y `estado='APROBADO'`.
     - `activos(D)` = usuarios con `recibe_propinas=true` y al menos un turno con `iniciado_at::date AT TIME ZONE negocio.tz = D`.
     - Cada activo recibe `propinas_dia(D) / count(activos(D))`.
   - Devuelve agregado por usuario en el rango.
5. **pg_cron job** `cerrar-turnos-vencidos` cada `*/15 * * * *` → `net.http_post` a `https://project--8b10a504-6066-4b8a-834d-dee3ef3491c8.lovable.app/api/public/hooks/cerrar-turnos` con `apikey` = anon key.

## Código

### Backend (server fns / rutas)
- `src/lib/turno.functions.ts`: ya existe; `iniciar/finalizar` siguen llamando los mismos RPC (la lógica nueva queda en SQL).
- `src/lib/usuarios.functions.ts`: agregar `recibe_propinas: boolean` a los validators de `crearUsuarioStaff` / `actualizarUsuarioStaff` y persistir.
- `src/lib/configuracion-schemas.ts`: agregar `recibe_propinas` al schema del form.
- `src/lib/propinas.functions.ts` (nuevo): `getPropinasPorUsuario({ desde, hasta })` que llama al RPC `calcular_propinas_por_usuario` (vía `requireSupabaseAuth`).
- `src/routes/api/public/hooks/cerrar-turnos.ts` (nuevo): POST que valida `apikey` y llama `supabaseAdmin.rpc('cerrar_turnos_vencidos')`.

### UI
- `src/components/configuracion/usuario-form.tsx`: switch "Recibe propinas" (default off para todos).
- `src/components/configuracion/usuarios-tab.tsx`: badge/columna "Propinas: Sí/No".
- `src/routes/_app.operacion.tsx`: nueva tarjeta `PropinasPanel` (rango por defecto: día actual; selector simple desde/hasta) mostrando tabla `usuario · días activos · total propinas` y suma total.
- `src/hooks/use-mi-staff.ts`: añadir `refetchInterval` corto y toast cuando se detecta que `esta_en_turno` pasó de true→false sin acción del usuario (informar auto-cierre).

## Archivos nuevos/editados
- Migración SQL (tabla, columna, RPCs, pg_cron)
- `src/lib/propinas.functions.ts` (nuevo)
- `src/routes/api/public/hooks/cerrar-turnos.ts` (nuevo)
- `src/components/operacion/propinas-panel.tsx` (nuevo)
- `src/lib/usuarios.functions.ts`, `src/lib/configuracion-schemas.ts`
- `src/components/configuracion/usuario-form.tsx`, `src/components/configuracion/usuarios-tab.tsx`
- `src/routes/_app.operacion.tsx`, `src/hooks/use-mi-staff.ts`

## Notas técnicas
- Zona horaria: se usa `negocio.timezone` (asumo que existe; si no, agrego columna `timezone text not null default 'America/Bogota'` en la misma migración).
- Auto-cierre marca `finalizado_at = iniciado_at + 12h` (no `now()`) para que el cálculo histórico sea estable aunque el cron corra con retraso.
- Turnos que cruzan medianoche: nunca generan un segundo día activo — la regla los ata al día de inicio.
