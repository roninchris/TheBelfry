/**
 * Theme registry.
 *
 * Themes are pure CSS: each id corresponds to a `:root[data-theme="<id>"]`
 * block in index.css that overrides the --color-* / --rgb-* variables. Every
 * colour utility in the app compiles to a var() reference, so swapping the
 * attribute retints the whole UI with no rebuild and no per-component work.
 *
 * To add one: append a block in index.css and an entry here.
 */
export type ThemeId = "cyan" | "crimson" | "violet";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  description: string;
  /** Swatch shown in Settings — [chassis, structure, accent]. */
  swatch: [string, string, string];
}

export const THEMES: ThemeDef[] = [
  {
    id: "cyan",
    label: "Detective",
    description: "Default Batcomputer. Cold cyan on a near-black chassis.",
    swatch: ["#020912", "#70a2a8", "#00f3ff"],
  },
  {
    id: "crimson",
    label: "WayneTech",
    description: "Signal red on black. Alert-forward, high contrast.",
    swatch: ["#0b0406", "#a4838a", "#ff1f36"],
  },
  {
    id: "violet",
    label: "Nightfall",
    description: "Deep violet. Cooler and softer than the other two.",
    swatch: ["#05031a", "#737b9e", "#d633ff"],
  },
];

export const DEFAULT_THEME: ThemeId = "cyan";

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && THEMES.some((t) => t.id === v);
}

/** Applies a theme to the document root. Safe to call before React mounts. */
export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
}
