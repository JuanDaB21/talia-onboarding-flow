# Impresoras por espacio de trabajo (WebUSB, ESC/POS)

## Qué se va a construir

1. **En "Configuración > Espacios de trabajo"**: cada espacio muestra una nueva sección "Impresora local" con un botón **"Vincular impresora"**. Al pulsarlo, el navegador abre el diálogo nativo de USB, el usuario elige la térmica y queda guardada localmente para ese espacio.
2. **Al confirmar un pedido o marcar item para preparación**, el sistema arma la comanda de cada espacio (ya existe) y la envía **directo por USB** a la impresora vinculada en formato ESC/POS. No abre ventana de impresión.
3. **Si la impresión falla** (impresora desenchufada, apagada, sin papel), aparece una alerta en **Operación en vivo** con el espacio afectado, hora, y botón "Reintentar" / "Vincular otra".
4. **Fallback**: si un espacio no tiene impresora vinculada en ese equipo, la comanda cae al comportamiento actual (abrir ventana de impresión del navegador) para no bloquear al restaurante.

## Cómo funcionará para el usuario

- **Configuración inicial** (una vez por equipo/tablet):
  - Va a Configuración > Espacios de trabajo.
  - En "Cocina" pulsa "Vincular impresora" → aparece el diálogo del navegador con las impresoras USB conectadas → selecciona la Epson TM-T20 → toast "Impresora vinculada a Cocina".
  - Repite en "Barra" con otra térmica.
- **Operación normal**: el mesero confirma un pedido, el sistema imprime automáticamente la comanda de Cocina en la impresora de Cocina y la de Barra en la de Barra. Sin diálogos.
- **Si falla**: banner rojo en Operación en vivo → "Impresora de Barra no responde (comanda #A3F2, hace 12 s)" con acciones **Reintentar** y **Reimprimir manual**.

## Limitaciones importantes (a comunicar al usuario)

- **Solo Chrome, Edge u Opera de escritorio.** WebUSB **no funciona** en Safari, Firefox, iPad ni iPhone. Si el mesero usa iPad para tomar el pedido, la impresión debe dispararse desde un equipo con Chrome/Edge (por ejemplo el PC de caja o de la estación).
- **La vinculación es por equipo.** Cada tablet/PC que quiera imprimir debe vincular sus impresoras una sola vez (el permiso queda guardado por el navegador).
- **Requiere HTTPS** (ya lo tenemos en producción).
- **En Windows** algunas impresoras requieren desinstalar el driver del sistema o usar Zadig para exponerlas como dispositivo USB genérico — documentaremos el paso a paso.
- Compatible con impresoras **ESC/POS 58 mm y 80 mm** de marcas Epson, Xprinter, Bixolon, Star, 3nStar, Rongta, etc.

## Detalles técnicos

### Nueva tabla `espacio_impresora` (opcional, solo para saber "qué espacios deberían tener impresora")

```
id_espacio  uuid PK FK → espacios_trabajo
requiere_impresora  boolean default true
ancho_papel_mm  smallint default 80  -- 58 o 80
codepage  text default 'CP437'
```

Se usa para: (a) marcar el espacio como "necesita impresora", (b) que Operación en vivo sepa cuándo alertar (si `requiere_impresora=true` y no hay ninguna vinculada, muestra aviso suave). **La vinculación real vive en el navegador**, no en la BD, porque WebUSB no permite compartir permisos entre equipos.

### Servicio nuevo `src/services/usbPrinter.ts`

- `requestPrinter(idEspacio)` → `navigator.usb.requestDevice({ filters: [{ classCode: 7 }] })` + guarda `{ vendorId, productId, serialNumber }` en `localStorage` bajo la llave `talia.printer.<idEspacio>`.
- `getPrinter(idEspacio)` → recupera el device desde `navigator.usb.getDevices()` matcheando por vendor/product/serial. Devuelve `null` si no está conectada o el permiso se revocó.
- `printEscPos(device, bytes)` → `open` → `claimInterface` → `transferOut` al endpoint OUT → `releaseInterface`. Timeout 5 s.
- `renderComandaEscPos(comanda, anchoMm)` → convierte `ComandaPrintData` a bytes ESC/POS (init, encabezado grande, items, corte de papel). Formato equivalente al HTML actual.
- Emite eventos `usb.connect` / `usb.disconnect` que la UI escucha para las alertas.

### Cambios en la UI

**`src/routes/_app.configuracion.espacios.tsx`**
- Nueva fila por espacio con: estado (Vinculada / No vinculada), nombre del device, botones **Vincular**, **Cambiar**, **Probar impresión**, **Quitar**.
- Selector de ancho de papel (58/80 mm).

**`src/services/printService.ts` → integración**
- Nuevo `dispatchLocalPrintForComanda(idEspacio, comanda)` que reemplaza la ruta HTTP placeholder cuando hay device vinculado; si falla o no hay device, emite `printFailure` que Operación en vivo escuchará.

**`src/routes/_app.operacion.tsx`**
- Nuevo card **"Alertas de impresión"** (encima o al lado de "Alertas") que se llena desde un store en memoria (`usePrinterAlerts` hook) alimentado por los fallos que emite `printService`. Cada alerta: espacio, comanda, hora, botones Reintentar / Reimprimir manual (fallback a ventana). Auto-limpia al reintentar con éxito.

**`_app.servicio.$idMesa.tsx` y `comanda-sheet.tsx`**
- Antes de llamar `imprimirComandas` (ventana), intenta `dispatchLocalPrintForComanda`. Si retorna `ok`, no abre ventana. Si falla, abre ventana + registra alerta.

### Migración

```
create table public.espacio_impresora (
  id_espacio uuid primary key references espacios_trabajo(id_espacio) on delete cascade,
  requiere_impresora boolean not null default true,
  ancho_papel_mm smallint not null default 80 check (ancho_papel_mm in (58, 80)),
  codepage text not null default 'CP437',
  updated_at timestamptz not null default now()
);
-- GRANT + RLS scoped al negocio del espacio, ADMIN/SUPERADMIN editan, cualquier staff lee.
```

## Cómo lo verificaremos

1. Conectar una térmica USB, ir a Configuración > Espacios, vincular a Cocina → toast OK.
2. Pulsar "Probar impresión" → sale un ticket de prueba con "Talia — prueba".
3. Confirmar un pedido con items de Cocina y Barra → cada impresora imprime su comanda automáticamente sin diálogo.
4. Desenchufar la impresora de Barra, confirmar otro pedido → aparece alerta roja en Operación en vivo con botón Reintentar.
5. Volver a enchufar, pulsar Reintentar → imprime y la alerta desaparece.
6. Probar el fallback en Safari/iPad: al confirmar pedido se abre la ventana de impresión del navegador (comportamiento actual).

## Fuera de alcance de este plan

- Impresoras de red (IP) → futuro plan, requiere agente local.
- Impresión desde iPad/Safari sin ventana → no es posible sin agente nativo.
- Cola persistente de reintentos entre recargas → por ahora las alertas viven en memoria y en el listado de comandas del espacio (siempre se puede reimprimir manualmente).
