## Objetivo

Agregar propina al checkout del mesero: se sugiere automáticamente el **10% del total a pagar**, el mesero puede modificarla desde valor o porcentaje (incluso ponerla en 0), se guarda por cada pago para que aparezca en contabilidad (caja diaria) y en el desempeño del mesero.

## Cambios

### 1. Base de datos (migración)

**Tabla `pagos**` — añadir columna:

- `propina numeric NOT NULL DEFAULT 0` (se guarda por pago, independiente de `monto` de los items).

Así cada transacción de pago lleva su propia propina, asociada al mesero (`id_mesero`) y a la mesa, lista para consumir desde reportes.

**RPC `public.registrar_pago**` — agregar parámetro `p_propina numeric DEFAULT 0`:

- Valida `p_propina >= 0`.
- Inserta en `pagos.propina`.
- El `monto` del pago sigue siendo el total de los items (no se suma la propina al monto base; quedan en columnas separadas para reportes claros).
- Para el cuadre de caja, lo que el cliente entrega físicamente = `monto + propina`. Eso se ajusta en el resumen (ver punto 4).

**RPC `public.resumen_caja_dia**` — sumar `propina` al desglose:

- `efectivo_propina`, `transferencia_propina`, `datafono_propina` y `propinas_total`.
- Ajustar `efectivo_fisico` esperado en `cerrar_caja`: `base + efectivo (monto) + efectivo_propina`. Es decir, la propina en efectivo también debe estar en caja.

### 2. Server function (`src/lib/pagos.functions.ts`)

`registrarPago`:

- Añadir `propina: z.number().min(0).max(10_000_000)` al schema.
- Pasarla al RPC como `p_propina`.

`resumenCajaTurno` (vista del mesero):

- Incluir `propinas` totales del turno por método (ya cuenta sus pagos del día).

### 3. UI checkout — `src/components/servicio/pagar-sheet.tsx`

En el paso `metodo` (después de elegir items y método, antes de confirmar):

- Mostrar bloque **Propina**:
  - Total seleccionado: `$X`.
  - Sugerido (10%): botón rápido que pone `Math.round(total * 0.10)`.
  - Botones rápidos: `0%`, `5%`, `10%`, `15%` (calculan sobre el total seleccionado).
  - Input editable (numérico, en pesos, sin decimales) — el mesero puede escribir cualquier monto.
  - Línea inferior: **Total a cobrar: `monto + propina**`.
- Al confirmar, enviar `propina` al `registrarPago`.
- Reset al cerrar/reabrir el sheet: vuelve a sugerir 10% del nuevo total seleccionado (recalcular cuando cambian los items seleccionados, salvo que el mesero ya tocó el campo).

### 4. Reportes (consumo de la nueva data)

- `src/lib/caja.functions.ts` (resumen del día visto por admin): mostrar **Propinas totales del día** y desglose por mesero (sumando `pagos.propina` agrupado por `id_mesero`, mismo filtro de fecha que `resumen_caja_dia`).
- `src/lib/turno.functions.ts` (cierre/turno del mesero): mostrar propinas acumuladas en su turno.

Estos puntos quedan listos para que la próxima iteración los grafique o exporte; la columna ya existe y los queries la exponen.

## Notas técnicas

- El total mostrado al cliente en la cuenta pública (`getCuentaPublica`) NO incluye propina (sigue siendo el total de productos). La propina es decisión del mesero al cobrar.
- `pago_items.monto` no cambia (sigue siendo el subtotal del item). La propina vive solo en `pagos.propina`.
- Cuando un pago `TRANSFERENCIA` se rechaza, su `propina` queda con el pago rechazado (no se cuenta en confirmados); igual que el `monto`.