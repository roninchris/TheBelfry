import type { ToolOptions } from "../types";

/**
 * Substitution Cipher — general monoalphabetic substitution. The key seeds
 * a scrambled 26-letter cipher alphabet (key letters first, then the
 * remaining alphabet in order); every plaintext letter A-Z maps 1:1 to a
 * position in that scrambled alphabet. Case is preserved; non-letters pass
 * through untouched.
 */

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function buildCipherAlphabet(key: string): string {
  const clean = key.toUpperCase().replace(/[^A-Z]/g, "");
  const seen = new Set<string>();
  let out = "";
  for (const ch of clean + ALPHA) {
    if (!seen.has(ch) && ALPHA.includes(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}

export function substitutionEncode(text: string, options?: ToolOptions): string {
  const cipherAlpha = buildCipherAlphabet((options?.key as string) || "QWERTYUIOPASDFGHJKLZXCVBNM");
  return text
    .split("")
    .map((ch) => {
      const upper = ch.toUpperCase();
      const idx = ALPHA.indexOf(upper);
      if (idx < 0) return ch;
      const mapped = cipherAlpha[idx];
      return ch === upper ? mapped : mapped.toLowerCase();
    })
    .join("");
}

export function substitutionDecode(text: string, options?: ToolOptions): string {
  const cipherAlpha = buildCipherAlphabet((options?.key as string) || "QWERTYUIOPASDFGHJKLZXCVBNM");
  return text
    .split("")
    .map((ch) => {
      const upper = ch.toUpperCase();
      const idx = cipherAlpha.indexOf(upper);
      if (idx < 0) return ch;
      const mapped = ALPHA[idx];
      return ch === upper ? mapped : mapped.toLowerCase();
    })
    .join("");
}
