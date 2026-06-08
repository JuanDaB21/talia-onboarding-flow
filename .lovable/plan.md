## Mejorar calendar select en mobile

El calendar de rango personalizado en el dashboard se ve muy comprimido en mobile porque muestra 2 meses simultáneos en un popover de ~390 px de ancho. Los días son diminutos y difíciles de tocar.

### Cambios propuestos

1. **Un solo mes en mobile**
   - Detectar viewport mobile con `useMediaQuery` o un hook custom basado en `window.matchMedia('(max-width: 639px)')`.
   - Pasar `numberOfMonths={isMobile ? 1 : 2}` al componente `<Calendar />`.

2. **Popover mejor posicionado en mobile**
   - En mobile usar `align="center"` y `side="bottom"` en `<PopoverContent>` para que el calendario quede centrado y no se corte por el borde derecho.
   - Hacer que el contenedor del popover sea `w-screen max-w-[360px]` en mobile para aprovechar todo el ancho disponible.

3. **Touch targets más grandes**
   - Inyectar CSS scoped solo para este calendario que aumente el padding de las celdas (`rdp-day_button`) en pantallas pequeñas, dejando un mínimo de `44 × 44 px` por celda.

4. **Presets responsivos (opcional, si hay overflow)**
   - Si los botones de preset (Hoy, 7 días, 30 días, Personalizado) hacen overflow horizontal, envolverlos en `flex-wrap` o reducir padding en mobile.

### Archivos a editar
- `src/components/dashboard/range-selector.tsx`
- Posiblemente un hook nuevo `src/hooks/use-media-query.ts` si no existe ya.

### Criterios de aceptación
- En viewport < 640 px el calendario muestra 1 mes con celdas tocables.
- El popover no se corta por los bordes de la pantalla.
- En desktop se conservan los 2 meses y la alineación actual.