/**
 * Storefront presentation options.
 *
 * Every value a store can pick for how its shop looks is defined here, once, so
 * the dashboard picker, the validation schema and the storefront itself can't
 * drift apart. The colours live in `globals.css` under `[data-theme=...]`; this
 * module only carries the ids, labels and the swatches the picker previews.
 */

export const THEME_IDS = [
  "light",
  "dark",
  "sepia",
  "monochrome",
  "midnight",
  "amoled",
  "arbor",
  "slate",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  /** Swatch shown in the dashboard picker: page, card and text colours. */
  swatch: { bg: string; surface: string; fg: string };
  /**
   * Monochrome deliberately ignores the shop's accent colour, so the accent has
   * to resolve to the theme's own foreground instead of the stored hex.
   */
  forcedAccent?: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: "light",
    label: "Light",
    description: "White cards on a soft grey page.",
    swatch: { bg: "#fafafa", surface: "#ffffff", fg: "#171717" },
  },
  {
    id: "dark",
    label: "Dark",
    description: "Charcoal, easy on the eyes in a dim shop.",
    swatch: { bg: "#101114", surface: "#191b20", fg: "#f4f4f5" },
  },
  {
    id: "sepia",
    label: "Sepia",
    description: "Warm paper tones, like an old sleeve.",
    swatch: { bg: "#f4ecd8", surface: "#fbf5e6", fg: "#3b2f22" },
  },
  {
    id: "monochrome",
    label: "Monochrome",
    description: "Pure black and white. Ignores your accent colour.",
    swatch: { bg: "#ffffff", surface: "#ffffff", fg: "#111111" },
    forcedAccent: "#111111",
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep navy with cool highlights.",
    swatch: { bg: "#0b1220", surface: "#121b2e", fg: "#e8eefc" },
  },
  {
    id: "amoled",
    label: "AMOLED",
    description: "True black, so the covers are all you see.",
    swatch: { bg: "#000000", surface: "#000000", fg: "#ffffff" },
  },
  {
    id: "arbor",
    label: "Arbor",
    description: "Deep forest greens, dark without being flat black.",
    swatch: { bg: "#0b1310", surface: "#121c17", fg: "#e6f1e9" },
  },
  {
    id: "slate",
    label: "Slate",
    description: "Cool grey stone. Lighter than Dark, calmer than Light.",
    swatch: { bg: "#e8eaed", surface: "#f4f5f7", fg: "#232830" },
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function themeOption(value: string): ThemeOption {
  return THEMES.find((t) => t.id === value) ?? THEMES[0];
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export const HEADER_STYLE_IDS = ["compact", "banner"] as const;
export type HeaderStyleId = (typeof HEADER_STYLE_IDS)[number];

export const HEADER_STYLES: { id: HeaderStyleId; label: string; description: string }[] = [
  {
    id: "compact",
    label: "Compact",
    description: "One thin row: logo, name, and an expandable shop info panel.",
  },
  {
    id: "banner",
    label: "Banner",
    description: "Your banner image behind the name, with the profile picture on top.",
  },
];

export function isHeaderStyleId(value: unknown): value is HeaderStyleId {
  return typeof value === "string" && (HEADER_STYLE_IDS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Layouts                                                                    */
/* -------------------------------------------------------------------------- */

export const LAYOUT_IDS = ["grid", "list", "coverflow"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const LAYOUTS: { id: LayoutId; label: string; description: string }[] = [
  { id: "grid", label: "Grid", description: "Covers in a grid. Good default on any screen." },
  { id: "list", label: "List", description: "One record per row, with more detail visible." },
  {
    id: "coverflow",
    label: "Cover flow",
    description: "Swipe through covers side on, like an iPod. Best on a phone.",
  },
];

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === "string" && (LAYOUT_IDS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Featured section                                                           */
/* -------------------------------------------------------------------------- */

export const FEATURED_LAYOUT_IDS = ["carousel", "grid", "list"] as const;
export type FeaturedLayoutId = (typeof FEATURED_LAYOUT_IDS)[number];

export const FEATURED_LAYOUTS: { id: FeaturedLayoutId; label: string; description: string }[] = [
  {
    id: "carousel",
    label: "Carousel",
    description: "A swipeable row. Keeps featured picks to one line on a phone.",
  },
  { id: "grid", label: "Grid", description: "A fixed grid of your featured picks." },
  { id: "list", label: "List", description: "A compact list, useful for longer titles." },
];

export function isFeaturedLayoutId(value: unknown): value is FeaturedLayoutId {
  return typeof value === "string" && (FEATURED_LAYOUT_IDS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Accent colour                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Picks black or white text for a filled accent-coloured surface.
 *
 * Stores choose their own accent, and a pale one with white text on it is
 * unreadable, so the contrast has to be worked out rather than assumed. Uses
 * the sRGB relative-luminance formula, with 0.55 as the crossover point.
 */
export function accentForeground(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "#ffffff";
  const value = parseInt(match[1], 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111111" : "#ffffff";
}

export interface StorePresentation {
  theme: ThemeId;
  headerStyle: HeaderStyleId;
  defaultLayout: LayoutId;
  featuredLayout: FeaturedLayoutId;
  accent: string;
  accentFg: string;
}

/**
 * Normalises whatever is on the store row into presentation values that are
 * always valid. The columns are plain strings, so an older row (or a hand-edited
 * one) can hold something we no longer support; falling back beats rendering an
 * unstyled page.
 */
export function resolvePresentation(store: {
  theme: string;
  headerStyle: string;
  defaultLayout: string;
  featuredLayout: string;
  accentColor: string;
}): StorePresentation {
  const theme = isThemeId(store.theme) ? store.theme : "light";
  const accent = themeOption(theme).forcedAccent ?? store.accentColor;

  return {
    theme,
    headerStyle: isHeaderStyleId(store.headerStyle) ? store.headerStyle : "compact",
    defaultLayout: isLayoutId(store.defaultLayout) ? store.defaultLayout : "grid",
    featuredLayout: isFeaturedLayoutId(store.featuredLayout) ? store.featuredLayout : "carousel",
    accent,
    accentFg: accentForeground(accent),
  };
}
