// Definición de temas visuales para el menú público (/carta/$idMesa).
// Cada tema define no solo paleta/tipografía sino también layout,
// estilo de cards, header y categorías para que se sientan distintos.

export type MenuThemeId =
  | "verde-bosque"
  | "noir-gold"
  | "terracota-calido"
  | "oceano-minimal"
  | "sunset-vibrante"
  | "cacao-artesanal"
  | "brutalist-pop"
  | "pastel-cafe";

export type ProductLayout =
  | "horizontal" // imagen izquierda, texto derecha (compacto)
  | "vertical-grande" // foto ancha arriba, contenido abajo
  | "hero-grid" // grid 2 columnas, fotos cuadradas grandes
  | "lista-densa"; // sin imagen prominente, texto al frente

export type HeaderStyle =
  | "minimal" // sticky simple, logo a la derecha
  | "hero-centrado" // logo grande centrado con divisor ornamental
  | "banner-gradiente" // banner con gradiente vibrante
  | "editorial"; // título tipo revista con subtítulo y línea

export type CategoryStyle =
  | "pills" // pills clásicas
  | "tabs-subrayadas" // texto con underline en activa
  | "chips-grandes" // chips redondas grandes
  | "tags-duros"; // bordes duros, sin radius, contraste alto

export type PriceStyle =
  | "tag" // etiqueta tipo precinto
  | "linea" // con línea ornamental encima
  | "badge-gradiente" // badge gradiente vibrante
  | "subrayado" // simple con underline
  | "plano"; // texto simple

export interface MenuTheme {
  id: MenuThemeId;
  nombre: string;
  descripcion: string;
  productLayout: ProductLayout;
  headerStyle: HeaderStyle;
  categoryStyle: CategoryStyle;
  priceStyle: PriceStyle;
  vars: {
    "--menu-bg": string;
    "--menu-surface": string;
    "--menu-surface-2": string;
    "--menu-foreground": string;
    "--menu-muted": string;
    "--menu-border": string;
    "--menu-primary": string;
    "--menu-primary-foreground": string;
    "--menu-accent": string;
    "--menu-radius": string;
    "--menu-heading-font": string;
    "--menu-body-font": string;
    "--menu-gradient"?: string;
    "--menu-shadow"?: string;
  };
  /** Familias Google a precargar */
  fonts: string[];
}

export const MENU_THEMES: Record<MenuThemeId, MenuTheme> = {
  "verde-bosque": {
    id: "verde-bosque",
    nombre: "Verde Bosque",
    descripcion: "Editorial elegante, verde profundo con dorado y serif refinada.",
    productLayout: "vertical-grande",
    headerStyle: "editorial",
    categoryStyle: "tabs-subrayadas",
    priceStyle: "tag",
    vars: {
      "--menu-bg": "oklch(0.97 0.012 95)",
      "--menu-surface": "oklch(0.99 0.008 95)",
      "--menu-surface-2": "oklch(0.94 0.015 95)",
      "--menu-foreground": "oklch(0.22 0.03 155)",
      "--menu-muted": "oklch(0.48 0.02 155)",
      "--menu-border": "oklch(0.88 0.015 95)",
      "--menu-primary": "oklch(0.32 0.06 155)",
      "--menu-primary-foreground": "oklch(0.97 0.012 95)",
      "--menu-accent": "oklch(0.72 0.13 80)",
      "--menu-radius": "0.75rem",
      "--menu-heading-font": "'Playfair Display', Georgia, serif",
      "--menu-body-font": "'Inter', system-ui, sans-serif",
      "--menu-shadow": "0 8px 30px -12px oklch(0.32 0.06 155 / 0.18)",
    },
    fonts: ["Playfair+Display:wght@600;700;900", "Inter:wght@400;500;600"],
  },
  "noir-gold": {
    id: "noir-gold",
    nombre: "Noir & Gold",
    descripcion: "Fine dining: negro profundo, dorado y cards tipo hero.",
    productLayout: "hero-grid",
    headerStyle: "hero-centrado",
    categoryStyle: "pills",
    priceStyle: "linea",
    vars: {
      "--menu-bg": "oklch(0.14 0.008 60)",
      "--menu-surface": "oklch(0.19 0.01 60)",
      "--menu-surface-2": "oklch(0.24 0.012 60)",
      "--menu-foreground": "oklch(0.95 0.02 80)",
      "--menu-muted": "oklch(0.65 0.02 80)",
      "--menu-border": "oklch(0.30 0.015 60)",
      "--menu-primary": "oklch(0.78 0.14 82)",
      "--menu-primary-foreground": "oklch(0.14 0.008 60)",
      "--menu-accent": "oklch(0.85 0.10 82)",
      "--menu-radius": "0.5rem",
      "--menu-heading-font": "'Cormorant Garamond', Georgia, serif",
      "--menu-body-font": "'Inter', system-ui, sans-serif",
      "--menu-shadow": "0 12px 40px -10px oklch(0 0 0 / 0.6)",
    },
    fonts: ["Cormorant+Garamond:wght@500;700", "Inter:wght@400;500;600"],
  },
  "terracota-calido": {
    id: "terracota-calido",
    nombre: "Terracota Cálido",
    descripcion: "Rústico mediterráneo, beige arena con terracota y bordes suaves.",
    productLayout: "vertical-grande",
    headerStyle: "banner-gradiente",
    categoryStyle: "chips-grandes",
    priceStyle: "tag",
    vars: {
      "--menu-bg": "oklch(0.96 0.02 75)",
      "--menu-surface": "oklch(0.99 0.012 75)",
      "--menu-surface-2": "oklch(0.92 0.025 75)",
      "--menu-foreground": "oklch(0.28 0.04 40)",
      "--menu-muted": "oklch(0.52 0.04 40)",
      "--menu-border": "oklch(0.86 0.03 60)",
      "--menu-primary": "oklch(0.58 0.13 40)",
      "--menu-primary-foreground": "oklch(0.99 0.012 75)",
      "--menu-accent": "oklch(0.65 0.09 145)",
      "--menu-radius": "1.25rem",
      "--menu-heading-font": "'DM Serif Display', Georgia, serif",
      "--menu-body-font": "'Karla', system-ui, sans-serif",
      "--menu-gradient":
        "linear-gradient(135deg, oklch(0.58 0.13 40), oklch(0.68 0.12 55))",
      "--menu-shadow": "0 10px 30px -12px oklch(0.58 0.13 40 / 0.25)",
    },
    fonts: ["DM+Serif+Display", "Karla:wght@400;500;600"],
  },
  "oceano-minimal": {
    id: "oceano-minimal",
    nombre: "Océano Minimal",
    descripcion: "Cafetería moderna: blanco impecable, lista densa y tabs limpias.",
    productLayout: "lista-densa",
    headerStyle: "minimal",
    categoryStyle: "tabs-subrayadas",
    priceStyle: "plano",
    vars: {
      "--menu-bg": "oklch(0.99 0.005 240)",
      "--menu-surface": "oklch(1 0 0)",
      "--menu-surface-2": "oklch(0.96 0.008 240)",
      "--menu-foreground": "oklch(0.22 0.04 245)",
      "--menu-muted": "oklch(0.55 0.03 240)",
      "--menu-border": "oklch(0.91 0.01 240)",
      "--menu-primary": "oklch(0.42 0.13 245)",
      "--menu-primary-foreground": "oklch(0.99 0.005 240)",
      "--menu-accent": "oklch(0.42 0.13 245)",
      "--menu-radius": "0.5rem",
      "--menu-heading-font": "'Space Grotesk', system-ui, sans-serif",
      "--menu-body-font": "'DM Sans', system-ui, sans-serif",
    },
    fonts: ["Space+Grotesk:wght@500;700", "DM+Sans:wght@400;500;600"],
  },
  "sunset-vibrante": {
    id: "sunset-vibrante",
    nombre: "Sunset Vibrante",
    descripcion: "Bares y heladerías: coral, magenta, gradientes y energía joven.",
    productLayout: "hero-grid",
    headerStyle: "banner-gradiente",
    categoryStyle: "chips-grandes",
    priceStyle: "badge-gradiente",
    vars: {
      "--menu-bg": "oklch(0.98 0.018 30)",
      "--menu-surface": "oklch(1 0 0)",
      "--menu-surface-2": "oklch(0.95 0.03 30)",
      "--menu-foreground": "oklch(0.25 0.05 15)",
      "--menu-muted": "oklch(0.55 0.04 15)",
      "--menu-border": "oklch(0.90 0.025 30)",
      "--menu-primary": "oklch(0.65 0.22 25)",
      "--menu-primary-foreground": "oklch(0.99 0.01 30)",
      "--menu-accent": "oklch(0.62 0.22 340)",
      "--menu-radius": "1.5rem",
      "--menu-heading-font": "'Syne', system-ui, sans-serif",
      "--menu-body-font": "'Plus Jakarta Sans', system-ui, sans-serif",
      "--menu-gradient":
        "linear-gradient(135deg, oklch(0.65 0.22 25), oklch(0.62 0.22 340))",
      "--menu-shadow": "0 14px 40px -10px oklch(0.65 0.22 25 / 0.35)",
    },
    fonts: ["Syne:wght@600;800", "Plus+Jakarta+Sans:wght@400;500;600"],
  },
  "cacao-artesanal": {
    id: "cacao-artesanal",
    nombre: "Cacao Artesanal",
    descripcion: "Panadería bistró: marrón cálido, crema y formato horizontal acogedor.",
    productLayout: "horizontal",
    headerStyle: "editorial",
    categoryStyle: "pills",
    priceStyle: "subrayado",
    vars: {
      "--menu-bg": "oklch(0.95 0.02 70)",
      "--menu-surface": "oklch(0.98 0.012 70)",
      "--menu-surface-2": "oklch(0.91 0.025 65)",
      "--menu-foreground": "oklch(0.25 0.04 50)",
      "--menu-muted": "oklch(0.50 0.04 50)",
      "--menu-border": "oklch(0.84 0.03 60)",
      "--menu-primary": "oklch(0.38 0.06 45)",
      "--menu-primary-foreground": "oklch(0.97 0.015 70)",
      "--menu-accent": "oklch(0.55 0.13 45)",
      "--menu-radius": "0.875rem",
      "--menu-heading-font": "'Fraunces', Georgia, serif",
      "--menu-body-font": "'Nunito Sans', system-ui, sans-serif",
      "--menu-shadow": "0 8px 24px -12px oklch(0.38 0.06 45 / 0.2)",
    },
    fonts: ["Fraunces:wght@500;700", "Nunito+Sans:wght@400;500;600"],
  },
  "brutalist-pop": {
    id: "brutalist-pop",
    nombre: "Brutalist Pop",
    descripcion: "Neo-brutalismo: contrastes duros, bordes gruesos y mono.",
    productLayout: "horizontal",
    headerStyle: "minimal",
    categoryStyle: "tags-duros",
    priceStyle: "tag",
    vars: {
      "--menu-bg": "oklch(0.98 0.01 90)",
      "--menu-surface": "oklch(1 0 0)",
      "--menu-surface-2": "oklch(0.95 0.02 90)",
      "--menu-foreground": "oklch(0.15 0 0)",
      "--menu-muted": "oklch(0.40 0 0)",
      "--menu-border": "oklch(0.15 0 0)",
      "--menu-primary": "oklch(0.65 0.25 30)",
      "--menu-primary-foreground": "oklch(1 0 0)",
      "--menu-accent": "oklch(0.85 0.22 95)",
      "--menu-radius": "0rem",
      "--menu-heading-font": "'Archivo Black', system-ui, sans-serif",
      "--menu-body-font": "'JetBrains Mono', monospace",
      "--menu-shadow": "6px 6px 0 0 oklch(0.15 0 0)",
    },
    fonts: ["Archivo+Black", "JetBrains+Mono:wght@400;500;700"],
  },
  "pastel-cafe": {
    id: "pastel-cafe",
    nombre: "Pastel Café",
    descripcion: "Lifestyle suave: rosas y lavandas pastel, layout tipo revista.",
    productLayout: "hero-grid",
    headerStyle: "hero-centrado",
    categoryStyle: "chips-grandes",
    priceStyle: "subrayado",
    vars: {
      "--menu-bg": "oklch(0.98 0.012 350)",
      "--menu-surface": "oklch(1 0 0)",
      "--menu-surface-2": "oklch(0.95 0.025 340)",
      "--menu-foreground": "oklch(0.28 0.05 325)",
      "--menu-muted": "oklch(0.55 0.04 325)",
      "--menu-border": "oklch(0.91 0.02 340)",
      "--menu-primary": "oklch(0.62 0.13 340)",
      "--menu-primary-foreground": "oklch(0.99 0.01 340)",
      "--menu-accent": "oklch(0.68 0.12 290)",
      "--menu-radius": "1.5rem",
      "--menu-heading-font": "'Cormorant Garamond', Georgia, serif",
      "--menu-body-font": "'Outfit', system-ui, sans-serif",
      "--menu-gradient":
        "linear-gradient(135deg, oklch(0.62 0.13 340 / 0.18), oklch(0.68 0.12 290 / 0.18))",
      "--menu-shadow": "0 12px 36px -14px oklch(0.62 0.13 340 / 0.25)",
    },
    fonts: ["Cormorant+Garamond:wght@500;700", "Outfit:wght@400;500;600;700"],
  },
};

export const MENU_THEME_IDS = Object.keys(MENU_THEMES) as MenuThemeId[];

export function getMenuTheme(id: string | null | undefined): MenuTheme {
  if (id && id in MENU_THEMES) return MENU_THEMES[id as MenuThemeId];
  return MENU_THEMES["verde-bosque"];
}

export function getThemeStyle(id: string | null | undefined): React.CSSProperties {
  const theme = getMenuTheme(id);
  return theme.vars as unknown as React.CSSProperties;
}

export function getThemeFontsUrl(id: string | null | undefined): string {
  const theme = getMenuTheme(id);
  const families = theme.fonts.map((f) => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
