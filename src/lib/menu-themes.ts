// Definición de temas visuales para el menú público (/carta/$idMesa).
// Cada tema se inyecta como CSS variables en el contenedor raíz del menú,
// de manera que no afecta al panel administrativo.

export type MenuThemeId =
  | "verde-bosque"
  | "noir-gold"
  | "terracota-calido"
  | "oceano-minimal"
  | "sunset-vibrante"
  | "cacao-artesanal";

export interface MenuTheme {
  id: MenuThemeId;
  nombre: string;
  descripcion: string;
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
  };
  /** Familias Google a precargar */
  fonts: string[];
}

export const MENU_THEMES: Record<MenuThemeId, MenuTheme> = {
  "verde-bosque": {
    id: "verde-bosque",
    nombre: "Verde Bosque",
    descripcion: "Elegante, verde profundo con dorado y serif refinada.",
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
    },
    fonts: ["Playfair+Display:wght@600;700", "Inter:wght@400;500;600"],
  },
  "noir-gold": {
    id: "noir-gold",
    nombre: "Noir & Gold",
    descripcion: "Negro profundo y dorado. Fine dining, alta gama.",
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
    },
    fonts: ["Cormorant+Garamond:wght@500;700", "Inter:wght@400;500;600"],
  },
  "terracota-calido": {
    id: "terracota-calido",
    nombre: "Terracota Cálido",
    descripcion: "Beige arena con terracota. Rústico mediterráneo.",
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
      "--menu-radius": "1rem",
      "--menu-heading-font": "'DM Serif Display', Georgia, serif",
      "--menu-body-font": "'Karla', system-ui, sans-serif",
    },
    fonts: ["DM+Serif+Display", "Karla:wght@400;500;600"],
  },
  "oceano-minimal": {
    id: "oceano-minimal",
    nombre: "Océano Minimal",
    descripcion: "Blanco impecable y azul profundo. Cafetería moderna.",
    vars: {
      "--menu-bg": "oklch(0.99 0.005 240)",
      "--menu-surface": "oklch(1 0 0)",
      "--menu-surface-2": "oklch(0.96 0.008 240)",
      "--menu-foreground": "oklch(0.22 0.04 245)",
      "--menu-muted": "oklch(0.55 0.03 240)",
      "--menu-border": "oklch(0.91 0.01 240)",
      "--menu-primary": "oklch(0.42 0.13 245)",
      "--menu-primary-foreground": "oklch(0.99 0.005 240)",
      "--menu-accent": "oklch(0.72 0.12 200)",
      "--menu-radius": "0.5rem",
      "--menu-heading-font": "'Space Grotesk', system-ui, sans-serif",
      "--menu-body-font": "'DM Sans', system-ui, sans-serif",
    },
    fonts: ["Space+Grotesk:wght@500;700", "DM+Sans:wght@400;500;600"],
  },
  "sunset-vibrante": {
    id: "sunset-vibrante",
    nombre: "Sunset Vibrante",
    descripcion: "Coral y magenta. Heladerías, bares, energía joven.",
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
      "--menu-radius": "1.25rem",
      "--menu-heading-font": "'Syne', system-ui, sans-serif",
      "--menu-body-font": "'Plus Jakarta Sans', system-ui, sans-serif",
    },
    fonts: ["Syne:wght@600;800", "Plus+Jakarta+Sans:wght@400;500;600"],
  },
  "cacao-artesanal": {
    id: "cacao-artesanal",
    nombre: "Cacao Artesanal",
    descripcion: "Marrón cálido y crema. Panadería, bistró acogedor.",
    vars: {
      "--menu-bg": "oklch(0.95 0.02 70)",
      "--menu-surface": "oklch(0.98 0.012 70)",
      "--menu-surface-2": "oklch(0.91 0.025 65)",
      "--menu-foreground": "oklch(0.25 0.04 50)",
      "--menu-muted": "oklch(0.50 0.04 50)",
      "--menu-border": "oklch(0.84 0.03 60)",
      "--menu-primary": "oklch(0.38 0.06 45)",
      "--menu-primary-foreground": "oklch(0.97 0.015 70)",
      "--menu-accent": "oklch(0.70 0.10 55)",
      "--menu-radius": "0.875rem",
      "--menu-heading-font": "'Fraunces', Georgia, serif",
      "--menu-body-font": "'Nunito Sans', system-ui, sans-serif",
    },
    fonts: ["Fraunces:wght@500;700", "Nunito+Sans:wght@400;500;600"],
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
