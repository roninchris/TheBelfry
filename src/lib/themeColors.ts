/**
 * Resolves theme colours to concrete values for canvas drawing.
 *
 * A canvas 2D context cannot parse CSS custom properties: assigning
 * `ctx.fillStyle = "var(--color-accent-primary)"` is silently ignored and the
 * context keeps whatever colour it had (black by default). There is no error
 * and no warning — the drawing just disappears. So anything painted to a canvas
 * has to read the variable off the document first, which is what this does.
 *
 * Values are cached and the cache is dropped whenever the theme attribute
 * changes, so callers can call this per frame without paying for a
 * getComputedStyle on every draw.
 */

type ColorVar =
  | "--color-accent-primary"
  | "--color-cyan-primary"
  | "--color-cyan-dim"
  | "--color-cyan-text"
  | "--color-bg-void"
  | "--color-red-threat"
  | "--color-amber-alert"
  | "--color-green-verified"
  | "--color-text-primary";

type ChannelVar = "--rgb-accent" | "--rgb-primary" | "--rgb-threat" | "--rgb-amber";

const cache = new Map<string, string>();

if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
  new MutationObserver(() => cache.clear()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const out = v || fallback;
  cache.set(name, out);
  return out;
}

/** Solid colour, e.g. "#00f3ff". */
export function themeColor(name: ColorVar, fallback = "#00f3ff"): string {
  return readVar(name, fallback);
}

/**
 * Colour with alpha, e.g. themeRgba("--rgb-accent", 0.4) -> "rgba(0 243 255 / 0.4)".
 * The channel vars hold space-separated triplets ("0 243 255").
 */
export function themeRgba(name: ChannelVar, alpha: number): string {
  const triplet = readVar(name, "0 243 255");
  return `rgba(${triplet.replace(/\s+/g, ", ")}, ${alpha})`;
}

/** Clears the cache. Only needed if variables change without the attribute. */
export function invalidateThemeColors() {
  cache.clear();
}
