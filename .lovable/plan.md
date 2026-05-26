## Objetivo

Hacer el menú público mucho más atractivo y verdaderamente diferenciado entre temas (no solo color/tipografía), y permitir abrir el detalle de un producto con foto grande, descripción y precio.

---

## 1. Rediseñar los temas como **estilos visuales distintos**, no solo paletas

Cada tema tendrá su propia **personalidad de layout** (no solo colores/fuentes). Para esto extendemos `MenuTheme` con propiedades visuales:

- `cardStyle`: `"clasico"` | `"editorial"` | `"vibrante"` | `"minimal"` | `"artesanal"` | `"luxe"`
- `productLayout`: `"horizontal"` | `"vertical-grande"` | `"hero-grid"` | `"lista-densa"` 
- `headerStyle`: estilo del header (hero con imagen, banner con patrón, minimal sticky, etc.)
- `categoryStyle`: pills, tabs subrayadas, chips con icono, o navegación lateral
- `decoraciones`: gradientes, patrones SVG sutiles, bordes ornamentales, sombras dramáticas, etiquetas de precio tipo "tag"

### Mapeo por tema (ejemplos):

| Tema | Layout productos | Header | Categorías | Detalle visual |
|---|---|---|---|---|
| **Verde Bosque** (Editorial) | Vertical grande con imagen ancha | Hero con divisor ornamental | Tabs subrayadas serif | Precio en tag dorado |
| **Noir & Gold** (Luxe) | Hero-grid con cards oscuras | Header negro con logo grande centrado | Pills doradas con borde fino | Precio con línea ornamental |
| **Terracota Cálido** (Artesanal) | Vertical grande con esquinas redondeadas | Banner con textura papel | Chips circulares grandes | Precio manuscrito tipo "stamp" |
| **Océano Minimal** (Minimal) | Lista densa 2 col, foto cuadrada | Header limpio mínimo | Tabs sin fondo | Precio sobrio alineado |
| **Sunset Vibrante** (Vibrante) | Hero-grid con gradientes y badges | Header con gradiente coral/magenta | Pills con sombra de color | Precio con badge gradiente |
| **Cacao Artesanal** (Artesanal) | Horizontal cálido con bordes suaves | Banner crema con icono | Chips con icono café | Precio con underline ondulado |

### Implementación

- Extender `src/lib/menu-themes.ts` con los nuevos campos `cardStyle`, `productLayout`, `headerStyle`, `categoryStyle`, `decoraciones` (opcional, defaults por tema).
- En `src/routes/carta.$idMesa.tsx`:
  - Refactorizar `ProductoCard` para tomar `productLayout` y renderizar variantes (horizontal, vertical grande, hero-grid).
  - Refactorizar `CategoryPill` → `<CategoryNav>` que renderice según `categoryStyle`.
  - El header obtiene variantes (hero con imagen, banner con patrón, minimal).
  - Añadir nuevas CSS vars opcionales: `--menu-gradient`, `--menu-shadow`, `--menu-decoration` (patrón SVG en base64).
- Añadir 1–2 temas nuevos para más variedad visual: por ejemplo **"Brutalist Pop"** (alta densidad, contrastes duros, fuentes mono) y **"Pastel Café"** (lifestyle pastel, layout tipo revista).

### Personalización extra (sin entrar a sobre-ingeniería)
- En `_app.configuracion.apariencia.tsx`, mejorar el preview de cada tema con un **mini-mockup real** (mini card de producto + mini header + mini precio) usando las variables del tema, en lugar de solo swatches. Así el usuario "ve" la diferencia antes de aplicar.

---

## 2. Modal de detalle de producto

Cuando el cliente toca una `ProductoCard`, abre un `Dialog` con:

- **Foto grande** (ratio 4:3 o cuadrada según tema, full width del modal, hasta ~360px alto)
- **Nombre del producto** (heading grande con la fuente del tema)
- **Descripción completa** (sin `line-clamp`)
- **Precio destacado** (estilo según `cardStyle` del tema)
- Botón cerrar
- Estilizado con las CSS vars del tema (mismo look & feel)

### Implementación

- Nuevo componente `ProductoDetalleDialog` dentro del mismo `carta.$idMesa.tsx` (o `src/components/menu-publico/producto-detalle-dialog.tsx`).
- Estado `productoSeleccionado: CartaProducto | null` en `CartaPage`.
- `ProductoCard` envuelto en `<button>` que llama `setProductoSeleccionado(p)`.
- El dialog usa el `themeStyle` para mantener coherencia visual.
- En móvil: ocupa casi pantalla completa con scroll interno si la descripción es larga.

---

## Archivos a modificar

- `src/lib/menu-themes.ts` — extender tema con campos de layout/estilo, añadir 1–2 temas nuevos
- `src/routes/carta.$idMesa.tsx` — refactor de `ProductoCard`, `CategoryPill`, header; añadir modal de detalle
- `src/routes/_app.configuracion.apariencia.tsx` — mejorar previews con mini-mockups reales
- (opcional) `src/components/menu-publico/producto-detalle-dialog.tsx` — extraer modal si crece demasiado

## Fuera de alcance

- Editor de tema personalizado (elegir cualquier color a mano) — sería un siguiente paso si lo quieres.
- Cambios en backend / base de datos: no hace falta, `tema_menu` ya está guardado en `negocio`.
- Cambios en el panel admin más allá del preview visual de temas.
