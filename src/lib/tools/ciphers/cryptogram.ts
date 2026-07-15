import type { ToolOptions } from "../types";

/**
 * Cryptogram — the classic "solve the quote" puzzle cipher: a keyword-mixed
 * monoalphabetic substitution that always preserves word spacing and
 * punctuation (unlike a stripped-down Substitution Cipher), since those
 * boundaries are exactly what a solver uses to crack it.
 */

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function keywordAlphabet(keyword: string): string {
  const clean = keyword.toUpperCase().replace(/[^A-Z]/g, "");
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

export function cryptogramEncode(text: string, options?: ToolOptions): string {
  const cipherAlpha = keywordAlphabet((options?.keyword as string) || "PUZZLE");
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

export function cryptogramDecode(text: string, options?: ToolOptions): string {
  const cipherAlpha = keywordAlphabet((options?.keyword as string) || "PUZZLE");
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
