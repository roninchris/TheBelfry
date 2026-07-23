/**
 * Image-decode module — turn an image of a cipher into the intermediate text
 * the existing decoders in `../registry` already understand.
 *
 * Two strategies, both fully offline:
 *   - "template" — normalized cross-correlation against a runtime-rendered glyph
 *                  atlas. Used for symbol ciphers (dancing men, pigpen, binary
 *                  tally strokes, braille, runic).
 *   - "ocr"      — tesseract.js, lazy-loaded. Used for printed text/digit ciphers.
 *
 * The output `notation` is dropped straight into The Codex input buffer, so the
 * normal decode pipeline runs unchanged.
 */

export type ImageDecodeMethod = "template" | "ocr";

/** One recognised glyph, with its source-pixel box (for an optional debug overlay). */
export interface ImageDecodeCell {
  char: string;
  score: number; // 0..1 match confidence for this cell
  box: [number, number, number, number]; // x, y, w, h in source-image pixels
}

export interface ImageDecodeResult {
  /** Text to drop into the input buffer (already in the cipher's notation). */
  notation: string;
  /** Overall confidence, 0..1. */
  confidence: number;
  method: ImageDecodeMethod;
  cells?: ImageDecodeCell[];
  /** Human-readable status / limitation note for the operator. */
  note?: string;
}

/** Per-cipher recipe: which strategies to try, and how to constrain them. */
export interface StrategyConfig {
  /** Strategies to attempt, best confidence wins. */
  order: ImageDecodeMethod[];
  /** Atlas id for the template strategy (key into the glyph registry). */
  atlas?: string;
  /** tesseract `tessedit_char_whitelist` for the OCR strategy. */
  ocrCharset?: string;
  /** Short operator-facing hint shown in the intake panel. */
  hint?: string;
}

/** Draws a single glyph, ink in white, centred in a `size`×`size` context. */
export type GlyphRenderer = (ctx: CanvasRenderingContext2D, size: number) => void;

export interface AtlasEntry {
  /** Notation contributed when this glyph is matched (e.g. "1", "⠿", "[M01]", "1-UL"). */
  emit: string;
  render: GlyphRenderer;
}

export interface Atlas {
  entries: AtlasEntry[];
  /** Joiner placed between emitted tokens on the same line (default ""). */
  join?: string;
  /** Joiner placed between separate text lines (default " "). */
  lineJoin?: string;
}
