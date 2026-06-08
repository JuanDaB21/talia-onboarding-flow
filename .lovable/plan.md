## Propina inline al cobrar (10% por defecto, edición discreta)

Hoy al cobrar el mesero ve una pantalla dedicada de "Propina" como **primer paso** del `PagarSheet` con botones grandes (Sin propina / 5% / 10% / 15% + monto fijo). La propina ya queda en el resumen del paso "Método", con un link "editar" que devuelve al primer paso.

El cliente debería ver la propina al **momento del cobro**, ya prellenada al 10% del total, con un botón **discreto** para editarla, y poder bajarla a 0 — pero la línea de propina no se elimina.

### Cambios

**Editar `src/components/servicio/pagar-sheet.tsx`**

1. **Eliminar el paso dedicado `propina`.** El sheet ahora arranca en `items`.
   - Quitar `"propina"` del tipo `Paso` y de las inicializaciones / resets.
   - `setPaso("propina")` → `setPaso("items")` en `useEffect` de apertura y en el `onSuccess` del pago.
   - Quitar el bloque `paso === "propina" ? <PasoPropina .../>` del render.
   - Quitar `backTo` de `items` (ya no hay paso previo); en `metodo` el back vuelve a `items`.

2. **Estado de propina simplificado.** Mantener una sola fuente: `propinaPct` (default `0.1`) y `propinaCustom` (number | null). El cálculo de `propina` queda igual.

3. **Nuevo componente discreto `PropinaResumenRow`** que se reutiliza en el resumen del paso `items` (footer) y en el resumen del paso `metodo` (caja superior):
   - Muestra `Propina · {pct}%` (o `monto fijo` si es custom) a la izquierda y `{fmt.format(propina)}` a la derecha.
   - Junto al label un botón pequeño tipo ghost/link (`text-xs text-muted-foreground underline-offset-2 hover:underline`, sin color primario, sin íconos llamativos) con texto "Editar".
   - Click abre un `Popover` (shadcn ya disponible) anclado al botón con:
     - 4 chips compactos: `0%`, `5%`, `10%`, `15%` (sin botón "Sin propina" — `0%` es la forma de poner cero, la fila sigue visible mostrando `$0`).
     - Input pequeño "Monto fijo" (numérico, ≥ 0) que al escribir setea `propinaCustom` y `propinaPct=null`.
     - Sin botón "Eliminar" ni opción para ocultar la propina.

4. **Borrar `PasoPropina`** (componente local del archivo) cuando ya no se use, junto con su import `HandCoins` si queda huérfano.

5. **`PasoMetodo`**: reemplazar el link `editar` actual (texto primario subrayado) por el nuevo `PropinaResumenRow` discreto. Quitar el prop `onEditarPropina`.

6. **`PasoItems`**: en el footer agregar la fila propina con el mismo `PropinaResumenRow`. Ya muestra Subtotal + Propina + Total — solo se reemplaza la fila propina estática por la versión editable.

### Detalles visuales

- Botón "Editar": `variant="ghost"`, `size="sm"`, `h-6 px-2 text-[11px] text-muted-foreground`. Sin `text-primary`, sin ícono, sin borde.
- Popover ancho compacto (`w-56`), chips en grid 4 columnas con `text-xs`.
- La línea de propina se renderiza siempre, incluso cuando vale `$0`, para dejar claro que el cliente decidió no dejar propina.

### Fuera de alcance

- No se modifica el backend ni el esquema (`registrarPago` ya recibe `propina: number`, acepta 0).
- No se toca la `CuentaDialog` del cliente en `carta.$idMesa.tsx` — el cobro real es presencial mediante `PagarSheet` (el mesero le pasa el dispositivo al cliente).
- No se cambia la lógica de selección de ítems ni los métodos de pago.