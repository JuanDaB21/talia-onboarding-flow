## Objetivo

Convertir las alertas al mesero (llamada de cliente, nueva mesa asignada, pedido listo para recoger) en un aviso persistente con **sonido fuerte en loop + vibración**, que **no se apaga hasta que el mesero confirme la acción**.

## Comportamiento hoy

- Beep único (~0.35 s, oscilador Web Audio, gain 0.3) al detectar solicitud del cliente o mesa lista.
- Nueva asignación: toast informativo, sin sonido.
- Vibración: no se usa.
- No hay confirmación explícita: el sonido no depende de ninguna acción.

## Diseño

### 1. Nuevo `AlertaBus` — bus global de alertas activas

Archivo: `src/components/servicio/alerta-bus.tsx`.

- `AlertaBusProvider` en el layout `_app` (montado alto para que suene en cualquier ruta del staff).
- Estado interno: `Map<string, { key, tipo, mesa, titulo }>`.
- Métodos expuestos vía hook `useAlertaBus()`:
  - `push(alerta)` — idempotente por `key`.
  - `ack(key)` — quita la alerta; también guarda la key en `sessionStorage` para no re-empujarla mientras siga vigente el mismo `asignada_at`/`solicitud_at`.
  - `activas` — snapshot para UI.
- Mientras `activas.size > 0`:
  - **Sonido en loop**: usa `AudioContext` con oscilador continuo (patrón dos tonos alternos 880/1320 Hz, gain ≈ 0.6, envolvente cíclica cada ~700 ms). Reemplaza `beepListo` para las alertas persistentes; el beep corto se conserva para eventos informativos.
  - **Vibración**: `navigator.vibrate([600, 200, 600, 200])` cada ~1.6 s (solo si `"vibrate" in navigator`).
- Al vaciarse: apaga oscilador y llama `navigator.vibrate(0)`.
- Requiere gesto para desbloquear audio en móviles: el provider muestra un toast/botón "Activar alertas" la primera vez que hay una alerta y `AudioContext.state !== 'running'`. Al tocar, `ctx.resume()` y se guarda en `localStorage` que ya se aceptó.

### 2. Fuentes de alerta (todas usan el mismo bus)

En cada hook/efecto ya existente, en vez de `beepListo()` se llama a `push()` / `ack()`:

- **Llamado / Pide cuenta / Pide más / Tomar pedido** (`solicitud_cliente` de la mesa):
  - `src/components/servicio/alertas-mesero-banner.tsx`: por cada mesa con `solicitud_cliente`, `push({ key: 'sol:'+id_mesa+':'+solicitud_at, tipo, mesa, titulo })`.
  - Se quita al desaparecer `solicitud_cliente` (efecto) o al ejecutar `limpiarSolicitudCliente` desde los botones existentes ("Atendido" / "Ir a la mesa" — para LLAMADO agregar botón "Atendido" también, o auto-ack al abrir el detalle).
- **Pedido listo** (`alerta_listo`):
  - `src/routes/_app.servicio.index.tsx` y `_app.servicio.$idMesa.tsx`: por cada mesa con `alerta_listo`, `push({ key: 'listo:'+id_mesa, ... })`.
  - `ack` al ejecutar `marcarPedidoEntregado` (ya existe en el detalle) o cuando `alerta_listo` cae a false.
- **Nueva mesa asignada** al mesero actual:
  - En `_app.servicio.index.tsx`, el efecto realtime detecta `meAsignaron`. Cambiarlo a `push({ key: 'asig:'+id_mesa+':'+asignada_at, ... })`.
  - `ack` cuando el mesero abre el detalle de esa mesa (`useEffect` en `_app.servicio.$idMesa.tsx` que llama `ack('asig:'+id+':'+asignada_at)`), o desde un botón "Voy en camino" en el toast/banner.

### 3. UI de banner enriquecido

- `AlertasMeseroBanner` ya renderiza las solicitudes con botones "Ir a la mesa" / "Atendido". Ajustes:
  - Agregar sección para alertas de tipo `LISTO` y `ASIGNACION` (mismo banner unificado). Cada tarjeta muestra botón único de confirmación:
    - LLAMADO / PEDIR_MAS / CUENTA / TOMAR_PEDIDO → "Ya fui a la mesa" (llama `limpiarSolicitudCliente` + `ack`).
    - LISTO → "Ya lo entregué" (llama `marcarPedidoEntregado` + `ack`).
    - ASIGNACION → "Voy en camino" (solo `ack`).
  - Se muestra en la ruta `_app` completa (no solo `/servicio`), moviendo el banner a un layout compartido si hoy solo está en index.

### 4. Archivos a tocar

- `src/components/servicio/alerta-sound.ts` — extender con `startAlarm()` / `stopAlarm()` en loop (mantener `beepListo` para retrocompatibilidad).
- `src/components/servicio/alerta-bus.tsx` — nuevo provider + hook.
- `src/routes/_app.tsx` (o layout equivalente) — envolver Outlet con `AlertaBusProvider` y renderizar `AlertasMeseroBanner` global (si hoy solo vive en `/servicio`).
- `src/components/servicio/alertas-mesero-banner.tsx` — usar bus; agregar tarjetas LISTO y ASIGNACION; unificar botones de confirmación.
- `src/routes/_app.servicio.index.tsx` — reemplazar `beepListo` por `push/ack` en efectos de `alerta_listo` y asignación.
- `src/routes/_app.servicio.$idMesa.tsx` — al montar, `ack('asig:'+id+':'+asignada_at)`; en `marcarPedidoEntregado` llamar `ack('listo:'+id)`; reemplazar `beepListo` interno.

### 5. Notas técnicas

- Web Audio requiere gesto en iOS/Safari y algunos Android. Manejar con el prompt "Activar alertas" y `ctx.resume()`.
- Vibration API no soportada en iOS Safari — se degrada silenciosamente.
- El loop debe frenarse al hacer `pagehide`/`visibilitychange=hidden`? No — el usuario podría cambiar de app; el sonido debe seguir intentando (el navegador puede pausarlo en background, es esperado).
- No cambia esquema de BD ni server functions.

## Verificación

- Con una mesa que me llama: banner + sonido en loop + vibración; el sonido no para hasta pulsar "Ya fui a la mesa".
- Con pedido listo en cocina: banner con "Ya lo entregué"; sonido persistente.
- Al ser asignado a nueva mesa: alerta con "Voy en camino"; también se apaga al abrir el detalle.
- Múltiples alertas simultáneas: el loop sigue mientras exista al menos una; apagarlas una a una.
- Recargar la página con la solicitud aún activa: la alerta vuelve a sonar (basada en estado real de BD).
- `bunx tsgo --noEmit` sin errores.

## Fuera de alcance

- Push notifications nativas (requiere Service Worker + suscripción y permisos separados).
- Configuración por usuario del volumen/patrón (usa valores por defecto fuertes).
