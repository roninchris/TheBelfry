import type { ToolOptions } from "../types";

/**
 * One-Time Pad (Vernam Cipher) — modular addition of plaintext and key
 * letters (C = P + K mod 26). Unlike Vigenère, the key is never cycled: it
 * must be at least as long as the message, or the transform refuses to run,
 * since silently reusing key material is exactly what breaks a real OTP's
 * security guarantee.
 */

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function requireKey(text: string, key: string): void {
  const letterCount = text.replace(/[^A-Za-z]/g, "").length;
  if (letterCount > 0 && key.length < letterCount) {
    throw new Error(
      `One-Time Pad key must be at least as long as the message (need ${letterCount} letters, key has ${key.length}).`
    );
  }
}

export function oneTimePadEncode(text: string, options?: ToolOptions): string {
  const key = ((options?.key as string) || "").toUpperCase().replace(/[^A-Z]/g, "");
  requireKey(text, key);
  let keyIdx = 0;
  return text
    .split("")
    .map((ch) => {
      const upper = ch.toUpperCase();
      const p = ALPHA.indexOf(upper);
      if (p < 0) return ch;
      const k = ALPHA.indexOf(key[keyIdx++]);
      const c = ALPHA[(p + k) % 26];
      return ch === upper ? c : c.toLowerCase();
    })
    .join("");
}

export function oneTimePadDecode(text: string, options?: ToolOptions): string {
  const key = ((options?.key as string) || "").toUpperCase().replace(/[^A-Z]/g, "");
  requireKey(text, key);
  let keyIdx = 0;
  return text
    .split("")
    .map((ch) => {
      const upper = ch.toUpperCase();
      const c = ALPHA.indexOf(upper);
      if (c < 0) return ch;
      const k = ALPHA.indexOf(key[keyIdx++]);
      const p = ALPHA[(c - k + 26) % 26];
      return ch === upper ? p : p.toLowerCase();
    })
    .join("");
}
