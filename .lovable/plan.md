## Objetivo

Agregar una sección "Menú público" en Configuración donde el admin pueda:

1. Elegir entre **6 temas pre-diseñados** de menú público (uno de ellos: **Verde Bosque** elegante por defecto del pedido).
2. Subir/cambiar el **logo del negocio**, que se mostrará arriba a la derecha del menú público (`/carta/$idMesa`).

## Temas disponibles

Se generan 6 estilos genéricos, todos atractivos y diferenciados (color, tipografía, radius, vibe):

1. **Verde Bosque** (elegante, default solicitado) — fondo crema, primario verde oscuro `oklch(0.32 0.06 155)`, acento dorado, serif display.
2. **Noir & Gold** — negro profundo, dorado, alto contraste, fine dining.
3. **Terracota Cálido** — beige arena, terracota, sage, rústico mediterráneo.
4. **Océano Minimalista** — blanco, azul profundo, sans-serif limpio (cafetería/saludable).
5. **Sunset Vibrante** — coral/magenta gradiente, juvenil (heladería/bar).
6. **Cacao Artesanal** — marrón cálido, crema, panadería/bistró.

Cada tema define: `bg`, `surface`, `primary`, `primary-foreground`, `accent`, `muted`, `border`, `heading-font`, `body-font`, `radius`.

## Cambios

### 1. Base de datos (migración)

Agregar a tabla `negocio`:

- `tema_menu text not null default 'verde-bosque'`
- (la columna `url_logo` ya existe)

Crear bucket público `negocio-logos` con políticas RLS (cualquiera lee; solo staff del negocio escribe/borra en su carpeta `{id_negocio}/...`).

### 2. Server functions (`src/lib/negocio.functions.ts` nuevo)

- `getNegocioConfig()` — devuelve `{ id_negocio, nombre_comercial, url_logo, tema_menu }` del negocio actual.
- `updateNegocioApariencia({ tema_menu, url_logo })` — actualiza ambos campos, valida que `tema_menu` esté en la lista permitida.
- `getMenuPublico` (existente) — extender para devolver también `negocio: { nombre_comercial, url_logo, tema_menu }`.

### 3. Definición de temas (`src/lib/menu-themes.ts` nuevo)

Objeto `MENU_THEMES` con los 6 temas. Cada uno con tokens CSS (oklch) + clase de fuente. Helper `getThemeStyle(id)` que devuelve un objeto `style` con CSS variables (`--menu-bg`, `--menu-primary`, etc.) para inyectar en el `<main>` raíz del menú público.

### 4. UI Configuración (`src/routes/_app.configuracion.apariencia.tsx` nuevo)

- Card "Logo del negocio": preview circular del logo actual + botón "Subir logo" / "Quitar logo" (input file → upload a Storage → guarda `url_logo`).
- Card "Tema del menú público": grid de 6 tarjetas-preview, cada una mostrando una miniatura del tema (header con logo placeholder + 2 product cards mock con los colores del tema). La tarjeta seleccionada lleva ring + check. Click selecciona y guarda.
- Botón "Ver vista previa" abre `/carta/{primeraMesa}` en nueva pestaña.

### 5. Sidebar (`src/components/app-sidebar.tsx`)

Agregar item "Apariencia" bajo Configuración (junto a Usuarios y Mesas), ícono `Palette`.

### 6. Aplicar tema en menú público (`src/routes/carta.$idMesa.tsx`)

- Leer `data.negocio.tema_menu` y `data.negocio.url_logo`.
- Aplicar el tema vía CSS variables inline en el `<main>` y reemplazar clases `bg-background`/`bg-card`/`text-primary` por `bg-[var(--menu-bg)]` etc. (o un wrapper con clases derivadas).
- En el header sticky: a la izquierda título "Mesa X / Nuestra carta", a la derecha el logo (h-12 redondeado). Si no hay logo, no se renderiza.
- Los botones inferiores y category pills usan los colores del tema.
- Onboarding card también respeta el tema (logo grande arriba si existe).

## Detalles técnicos

- Upload de logo: usar `supabase.storage.from('negocio-logos').upload(\`${id_negocio}/logo-${Date.now()}.{ext})`, validar ≤2MB, tipos` image/png|jpeg|webp|svg+xml`.
- Inyección de tema: en lugar de tocar `src/styles.css`, cada tema expone un set de CSS vars que se aplican mediante `style={...}` en el contenedor raíz del menú público — así no afecta al admin panel.
- Tipografías: cargar las 2-3 familias necesarias (`Playfair Display`, `Cormorant`, `Inter`, `DM Sans`) desde Google Fonts en el `<head>` de la ruta `carta.$idMesa.tsx` vía `head().links`.
- `tema_menu` validado con Zod enum en el server fn.
- Default para negocios existentes: `'verde-bosque'`.

## Archivos a crear/editar

Crear:

- `supabase/migrations/<timestamp>_menu_themes_and_logo_bucket.sql`
- `src/lib/negocio.functions.ts`
- `src/lib/menu-themes.ts`
- `src/routes/_app.configuracion.apariencia.tsx`
- `src/components/configuracion/theme-preview-card.tsx`
- `src/components/configuracion/logo-uploader.tsx`

Editar:

- `src/lib/menu-publico.functions.ts` (incluir `negocio` en `getMenuPublico`)
- `src/routes/carta.$idMesa.tsx` (aplicar tema + logo)
- `src/components/app-sidebar.tsx` (item Apariencia)