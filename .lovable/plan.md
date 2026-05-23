
# Kanban tipo comanda agrupado por mesa

## Cambio de modelo visual

El Kanban de cocina y barra deja de mostrar items sueltos y pasa a mostrar **comandas** (un pedido por mesa). Cada tarjeta representa la comanda de una mesa con todos sus items de esa estación.

### Estados de columna (comanda completa)

La comanda vive en una sola columna activa, calculada a partir de los items de la estación:

- **En cola**: ningún item iniciado (todos `EN_COLA`).
- **En preparación**: al menos un item está en preparación o ya listo, pero queda algo sin terminar.
- **Listo**: todos los items están `LISTO` (ninguno entregado todavía o algunos ya entregados pero queda al menos uno listo).
- **Entregado (recientes)**: todos los items entregados — se muestran los últimos N de la última hora para feedback visual.

### Tarjeta de comanda (vista general)

```text
┌─────────────────────────────────┐
│ Mesa 5            🕒 12 min     │
│ Pedido #a1b2 · hace 8 min       │
│                                 │
│ ▓▓▓▓▓▓░░░░  2 / 4 listos        │
│                                 │
│ 🍔 ×2 Hamburguesa     ✓ listo   │
│ 🥗 ×1 Ensalada        ⏳ prep   │
│ 🍟 ×1 Papas           ⏸ cola   │
│                                 │
│ ⚠ Alergia · 📝 Notas            │
│                  [Ver comanda]  │
└─────────────────────────────────┘
```

- Cabecera: mesa, contador de tiempo del item más atrasado, badge de retraso si aplica.
- Barra de progreso `listos / total` de items de esa estación.
- Lista compacta de items con su estado individual.
- Indicadores agregados: alergia (si algún item la tiene), cantidad de notas/extras/exclusiones.
- Click en la tarjeta abre el detalle.

### Detalle (Sheet lateral)

Se abre un Sheet de shadcn sobre el Kanban (no navega de ruta).

```text
Comanda · Mesa 5                        ✕
Pedido confirmado hace 8 min · 2/4 listos
─────────────────────────────────────────
[⏸] ×2 Hamburguesa                       
     ⚠ Alergia · sin cebolla              
     + queso extra                        
     "término medio"                      
     ⏱ 18/15 min · retraso +3            
     [ Iniciar ]                          
─────────────────────────────────────────
[⏳] ×1 Ensalada                          
     ⏱ 4/10 min                          
     [ Marcar listo ]                     
─────────────────────────────────────────
[✓] ×1 Papas                              
     ⏱ listo hace 2 min                  
     [ Entregar ]                         
```

- Cada item muestra el detalle completo (extras, exclusiones, nota, alergia, tiempos).
- Un solo botón de acción por item que **avanza un paso** en el flujo `EN_COLA → EN_PREPARACION → LISTO → ENTREGADO` usando el RPC existente `avanzar_estado_item`.
- Acción rápida adicional: "Iniciar toda la comanda" en el header del sheet (avanza todos los items en `EN_COLA` a `EN_PREPARACION` en una sola operación).
- Realtime mantiene el sheet sincronizado: si otra persona avanza un item, el check aparece sin recargar.

## Detalles técnicos

### Server function nueva: `listarComandasEstacion`

Reemplaza/complementa `listarItemsEstacion` en `src/lib/preparacion.functions.ts`. Devuelve los items agrupados por pedido:

```ts
interface ComandaEstacion {
  id_pedido: string;
  mesa_identificador: string;
  pedido_created_at: string;
  confirmado_at: string;       // created_at o updated_at del paso a CONFIRMADO
  items: ItemPreparacion[];    // solo de esta estación
  // derivados en el cliente:
  // estado_grupo, listos, total, max_retraso, tiene_alergia
}
```

Se mantiene el filtro `pedidos.estado = 'CONFIRMADO'` y `destino = COCINA|BARRA`. Para la columna "Entregado" se hace una segunda query opcional con items entregados en la última hora (límite 20 pedidos).

### Acción "iniciar toda la comanda"

Nueva server function `iniciarComanda({ idPedido, destino })` que llama a `avanzar_estado_item` para cada item de esa estación que esté en `EN_COLA`. Se hace dentro de una transacción RPC nueva `iniciar_comanda_estacion(p_id_pedido, p_destino)` para evitar N round-trips.

### Cálculo del estado de columna (cliente)

```ts
function estadoComanda(items): "EN_COLA" | "EN_PREPARACION" | "LISTO" | "ENTREGADO" {
  if (items.every(i => i.estado === "ENTREGADO")) return "ENTREGADO";
  if (items.every(i => i.estado === "LISTO" || i.estado === "ENTREGADO")) return "LISTO";
  if (items.some(i => i.estado !== "EN_COLA")) return "EN_PREPARACION";
  return "EN_COLA";
}
```

### Componentes

- **Refactor** `src/components/preparacion/kanban-board.tsx`: agrupa por pedido, renderiza `ComandaCard` en lugar de `ItemCard`, mantiene la suscripción realtime existente.
- **Nuevo** `src/components/preparacion/comanda-card.tsx`: tarjeta resumen + barra de progreso + indicadores.
- **Nuevo** `src/components/preparacion/comanda-sheet.tsx`: Sheet con la lista interactiva de items. Reutiliza la lógica de tiempos/alertas de `ItemCard` extrayéndola a un helper.
- **Mantener** `src/components/preparacion/item-card.tsx` solo si se reutiliza dentro del sheet; si no, eliminar.

### Sin cambios en BD para el flujo principal

El esquema de `pedido_items` y `avanzar_estado_item` ya soporta lo necesario. Solo se añade el RPC `iniciar_comanda_estacion` como conveniencia.

## Archivos afectados

- `src/lib/preparacion.functions.ts` — refactor a `listarComandasEstacion` + nueva `iniciarComanda`.
- `src/components/preparacion/kanban-board.tsx` — agrupación por mesa, render de `ComandaCard`, manejo del sheet abierto.
- `src/components/preparacion/comanda-card.tsx` — nuevo.
- `src/components/preparacion/comanda-sheet.tsx` — nuevo.
- `src/components/preparacion/item-card.tsx` — se simplifica o reemplaza por filas dentro del sheet.
- `supabase/migrations/*` — nueva RPC `iniciar_comanda_estacion`.
