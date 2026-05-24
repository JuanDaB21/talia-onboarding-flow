## Objetivo

Hacer que los llamados del cliente al mesero sean **alertas persistentes** (no toasts efímeros), tanto para el llamado inicial como para el llamado de cuenta, y darle al mesero acciones explícitas para confirmar que llegó a la mesa.

---

## 1) Modelo de datos

La tabla `mesas` ya tiene `solicitud_cliente` (text) y `solicitud_at` (timestamp). Hoy se usa con dos valores: `CUENTA` y `PEDIR_MAS`. No hay check constraint que limite los valores, así que se reutiliza la misma columna sumando un tercer valor:

- `LLAMADO` → cliente tocó "Llamar mesero" y aún nadie lo atiende.

No se requiere migración de tabla. Se actualizan dos RPCs existentes y se agregan dos server functions nuevas (ver §2).

### Reglas de transición

| Evento | Cambios en `mesas` |
|---|---|
| Cliente toca **Llamar mesero** | `estado='OCUPADA'`, `solicitud_cliente='LLAMADO'`, `solicitud_at=now()`, intento de asignar mesero |
| Mesero toca **Detener alerta** (solo si `solicitud_cliente='LLAMADO'`) | `estado='LIBRE'`, `solicitud_cliente=null`, `id_mesero_asignado=null`, `asignada_at=null`, `solicitud_at=null` |
| Mesero toca **Tomar pedido** | `solicitud_cliente=null`, `solicitud_at=null` (mesa sigue OCUPADA, mesero asignado) |
| Cliente toca **Pedir cuenta / Pedir más** | `solicitud_cliente='CUENTA'` o `'PEDIR_MAS'`, `solicitud_at=now()` |
| Mesero toca **Atendido** en el banner de cuenta/pedir más | `solicitud_cliente=null`, `solicitud_at=null` |

Importante: hoy `_app.servicio.$idMesa.tsx` limpia automáticamente la solicitud al abrir la mesa. Eso se quita; la solicitud solo se limpia con acción explícita del mesero (o cuando se cobra la cuenta).

---

## 2) Server functions

### `src/lib/menu-publico.functions.ts`
- `llamarMesero`: además de marcar `OCUPADA` y asignar mesero, setear `solicitud_cliente='LLAMADO'` y `solicitud_at=now()`.

### `src/lib/servicio.functions.ts`
- Nueva `detenerAlertaLlamado({ idMesa })`: valida que `solicitud_cliente='LLAMADO'` y que el caller es el mesero asignado (o admin); libera la mesa según la tabla de arriba.
- Nueva `tomarPedidoLlamado({ idMesa })`: limpia solo `solicitud_cliente` y `solicitud_at`; mantiene mesero y `OCUPADA`.
- Renombrar el uso actual de `limpiarSolicitudCliente` para que cubra `CUENTA`/`PEDIR_MAS` (ya existe la RPC `limpiar_solicitud_cliente`, sigue sirviendo como "marcar atendido").
- Quitar el `useEffect` de `_app.servicio.$idMesa.tsx` que llamaba a `limpiarSolicitudCliente` automáticamente.

---

## 3) UI mesero

### Banner global de alertas (componente nuevo `AlertasMeseroBanner`)
Se renderiza en `src/routes/_app.servicio.tsx` (encima del `<Outlet/>`) para que esté visible en la lista de mesas y en el detalle. Hace polling + realtime sobre `mesas` y filtra las que tienen `solicitud_cliente IS NOT NULL` asignadas al mesero actual (o todas si es admin).

Cada alerta es una tarjeta llamativa, sticky en el top, con animación `animate-pulse` + sonido `beepListo` la primera vez que aparece:

- **LLAMADO** (rojo/primary, más prominente):
  - Texto: "Mesa {identificador} te está llamando" + tiempo transcurrido.
  - Botón principal "Ir a la mesa" → navega a `/servicio/$idMesa`.
- **CUENTA** (verde):
  - Texto: "Mesa {identificador} pide la cuenta 🧾".
  - Botones: "Ir a la mesa" y "Atendido" (limpia solicitud).
- **PEDIR_MAS** (azul):
  - Texto: "Mesa {identificador} quiere pedir más ➕".
  - Botones: "Ir a la mesa" y "Atendido".

Se quitan los toasts efímeros actuales (`toast.info` por `solicitud_cliente`) para no duplicar, pero se conserva el `beepListo` y el toast de "asignación nueva".

### Detalle de mesa cuando `solicitud_cliente='LLAMADO'`
En `_app.servicio.$idMesa.tsx`, encima de `MesaHeader`, mostrar un panel grande con dos botones del mismo tamaño:

```text
┌─────────────────────────────────────────┐
│  🔔 Mesa {identificador} te llamó       │
│  Hace 2 min                              │
│                                          │
│  [ Detener alerta ]  [ Tomar pedido ]   │
└─────────────────────────────────────────┘
```

- **Detener alerta** (variante outline destructive): ejecuta `detenerAlertaLlamado` y al éxito navega a `/servicio`. Esto deja la mesa LIBRE, lo cual reactiva el botón "Llamar mesero" en la carta del cliente (la carta ya muestra ese botón cuando `estado!='OCUPADA'`).
- **Tomar pedido** (variante primary, grande): ejecuta `tomarPedidoLlamado` y el panel desaparece; el flujo actual del detalle continúa normal.

### Detalle de mesa cuando `solicitud_cliente='CUENTA'` o `'PEDIR_MAS'`
Reemplazar el toast actual por un banner persistente similar arriba de `MesaHeader` con el texto correspondiente y un botón "Atendido" (llama a `limpiarSolicitudCliente`). Cuando se cobre la cuenta vía `PagarSheet`, también se limpia.

---

## 4) Archivos a tocar

- `src/lib/menu-publico.functions.ts` — ajustar `llamarMesero`.
- `src/lib/servicio.functions.ts` — agregar `detenerAlertaLlamado`, `tomarPedidoLlamado`.
- `src/components/servicio/alertas-mesero-banner.tsx` — nuevo.
- `src/components/servicio/llamado-panel.tsx` — nuevo (panel grande con los dos botones para LLAMADO).
- `src/components/servicio/solicitud-banner.tsx` — nuevo (banner CUENTA/PEDIR_MAS dentro del detalle).
- `src/routes/_app.servicio.tsx` — montar `AlertasMeseroBanner` encima del `<Outlet/>`.
- `src/routes/_app.servicio.$idMesa.tsx` — quitar limpieza automática + montar paneles según `solicitud_cliente`.
- `src/routes/_app.servicio.index.tsx` — quitar el `toast.info` duplicado de solicitud_cliente (el banner global ya lo cubre).

No se tocan el flujo de pagos, ni la carta pública, ni los componentes administrativos.

---

## 5) QA manual

1. Cliente toca "Llamar mesero" desde `/carta/{idMesa}` → en `/servicio` aparece banner rojo con la mesa, suena el beep, botón cliente cambia a "Mesero notificado".
2. Mesero entra a la mesa → ve panel con dos botones grandes.
3. Mesero toca "Detener alerta" → vuelve a `/servicio`, banner desaparece, en la carta del cliente vuelve a aparecer "Llamar mesero".
4. Mesero toca "Tomar pedido" → panel desaparece, flujo de toma normal.
5. Cliente toca "Pedir la cuenta" → en `/servicio` aparece banner verde persistente; al entrar a la mesa, banner CUENTA arriba; "Atendido" lo limpia; cobrar también lo limpia.
