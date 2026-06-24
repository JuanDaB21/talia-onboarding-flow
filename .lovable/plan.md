## Configurar porcentaje de propinas que retiene el negocio

### Resumen
Agregar un parámetro configurable por negocio (`porcentaje_retencion_propina`, default 0, este negocio 30) que descuente del total de propinas antes del reparto a meseros.

### Cambios

**1. Migración DB**
- `ALTER TABLE public.negocio ADD COLUMN porcentaje_retencion_propina numeric NOT NULL DEFAULT 0 CHECK (porcentaje_retencion_propina >= 0 AND porcentaje_retencion_propina <= 100);`
- Reemplazar `public.calcular_propinas_por_usuario(_desde, _hasta)`:
  - Leer `porcentaje_retencion_propina` del negocio.
  - En el CTE `propinas_dia`, calcular `total_neto = SUM(propina) * (1 - retencion/100)`.
  - Repartir el neto entre meseros activos (lógica de días/turnos actual sin cambios).
- Setear el valor a `30` para el negocio actual vía `UPDATE` (insert tool).

**2. Backend (server functions)**
- `src/lib/negocio.functions.ts`:
  - Agregar `porcentaje_retencion_propina` a `NegocioConfig` y a `getNegocioConfig`.
  - Nueva función `updateNegocioPropinas({ porcentaje_retencion_propina })` (0–100, admin) que actualiza el campo.

**3. UI Configuración**
- Nueva sección "Propinas" en `/configuracion`:
  - Nuevo archivo `src/routes/_app.configuracion.propinas.tsx` con un input numérico (0–100) que muestra el valor actual y lo guarda con `updateNegocioPropinas`.
  - Texto explicativo: "Porcentaje de las propinas que retiene el negocio. El resto se reparte entre meseros en turno."
- Agregar entrada en `SECCIONES` de `src/routes/_app.configuracion.index.tsx` con ícono y descripción.

**4. Panel de propinas (informativo)**
- `src/components/operacion/propinas-panel.tsx`: mostrar el porcentaje de retención vigente como leyenda en el header del card ("Reparte el X% restante; el negocio retiene Y%"), leyendo de `getNegocioConfig`. El cálculo ya viene neto de la RPC.

### Notas técnicas
- El último valor guardado es el que aplica para futuros cálculos (la RPC lee el valor actual, no histórico). Cálculos pasados al cambiar el porcentaje se recalculan con el nuevo valor — coherente con "el último valor es el que se usa".
- No se modifica `pagos.propina` (sigue siendo la propina bruta cobrada). La retención se aplica solo al reparto.
