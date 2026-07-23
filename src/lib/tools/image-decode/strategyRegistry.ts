import type { StrategyConfig } from "./types";

/**
 * Per-cipher recipe for turning an image into notation.
 *
 * Scope is deliberately "free local OCR only": printed text/digit ciphers go
 * through OCR (tesseract.js) with a constrained charset, and `binary` also gets
 * a best-effort template match for tally-stroke (I/O) images. Pure visual-symbol
 * alphabets (dancing men, pigpen, runic, gematria) are NOT supported for image
 * intake — reading arbitrary real-world symbol art reliably needs a vision
 * model, which is out of scope. `IMAGE_INTAKE_UNSUPPORTED` gates the UI so those
 * ciphers don't offer an intake button that can't deliver.
 */

const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const az = "abcdefghijklmnopqrstuvwxyz";

const STRATEGIES: Record<string, StrategyConfig> = {
  // Binary: OCR reads printed 0/1 digits; the template matcher is a best-effort
  // fallback for tally-stroke (bar = 1, ring = 0) images.
  binary: {
    order: ["ocr", "template"],
    atlas: "binaryTally",
    ocrCharset: "01",
    hint: "Reads printed 0/1 digits (best); also tries bar/dot tally marks.",
  },

  // Text / digit ciphers: OCR with a constrained charset.
  hex: { order: ["ocr"], ocrCharset: "0123456789abcdefABCDEF ", hint: "Reads printed hex." },
  ascii: { order: ["ocr"], ocrCharset: "0123456789 ", hint: "Reads printed decimal codes." },
  a1z26: { order: ["ocr"], ocrCharset: "0123456789 -", hint: "Reads printed number groups." },
  base64: {
    order: ["ocr"],
    ocrCharset: AZ + az + "0123456789+/=",
    hint: "Reads printed Base64 text.",
  },
  gronsfeld: { order: ["ocr"], ocrCharset: AZ + az + "0123456789 ", hint: "Reads printed text." },
};

/** Default for classical letter ciphers and anything unlisted: printed letters. */
const DEFAULT: StrategyConfig = {
  order: ["ocr"],
  ocrCharset: AZ + az + " ",
  hint: "Reads printed cipher text via OCR.",
};

/**
 * Pure visual-symbol alphabets — OCR can't read them and template matching
 * against a self-authored atlas only reads the app's own art, not real images.
 * Image intake is hidden for these rather than offering a button that fails.
 */
export const IMAGE_INTAKE_UNSUPPORTED = new Set([
  "pigpen",
  "dancingmen",
  "runic",
  "gematria",
  "braille",
]);

export function getStrategy(cipherId: string): StrategyConfig {
  return STRATEGIES[cipherId] ?? DEFAULT;
}

/** Whether image intake should be offered for this cipher. */
export function supportsImageIntake(cipherId: string): boolean {
  return !IMAGE_INTAKE_UNSUPPORTED.has(cipherId);
}
