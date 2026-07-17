import { getTool } from "./tools/registry";

/**
 * Registry ids that the Encoding Deck actually renders a row for.
 *
 * The Deck is a fixed breakout list rather than a registry-driven one, so it is
 * not enough for a tool to be `category: "encoding"` — `base32` is in the
 * registry but has no row, and routing to the Deck for it would land the user
 * on a page that never mentions the tool they clicked.
 */
const ENCODING_DECK_ROWS = new Set([
  "hex", "base64", "binary", "ascii", "morse", "url", "base62", "baudot",
  "tapcode", "phonekeypad", "piglatin", "base100", "geekcode", "base58",
  "base85", "braille",
]);

export interface ToolHome {
  /** `currentModule` id to switch to. */
  module: string;
  /** Display name of that module, for the button label. */
  label: string;
}

/**
 * Where a tool can be operated, or null if it has no home module.
 *
 * Three of the seventy registry tools currently have nowhere to go: `base32`
 * (no Deck row) and the two utilities, `rsafactorizer` and `hashlab`, which are
 * not surfaced by any module. Callers should hide the "open in" affordance
 * rather than route somewhere that cannot honour the request.
 */
export function moduleForTool(toolId: string): ToolHome | null {
  const entry = getTool(toolId);
  if (!entry) return null;

  if (entry.category === "cipher") {
    return { module: "crypto-lab", label: "The Codex" };
  }
  if (entry.category === "encoding" && ENCODING_DECK_ROWS.has(toolId)) {
    return { module: "encoding-lab", label: "Encoding Deck" };
  }
  return null;
}
