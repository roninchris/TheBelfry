import { ToolOptions } from "../types";

/**
 * Beaufort Cipher
 * A reciprocal cipher where C = (K - P) mod 26.
 * Encoding and decoding use the same logic.
 */
export function beaufortCipher(text: string, key: string): string {
  if (!key) return text;
  const cleanKey = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (!cleanKey) return text;

  let keyIndex = 0;
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      let isUpper = false;
      if (code >= 65 && code <= 90) isUpper = true;
      else if (code >= 97 && code <= 122) isUpper = false;
      else return char;

      const k = cleanKey.charCodeAt(keyIndex % cleanKey.length) - 65;
      keyIndex++;

      const base = isUpper ? 65 : 97;
      const p = code - base;
      // Formula: C = (K - P) mod 26
      return String.fromCharCode(((k - p + 26) % 26) + base);
    })
    .join("");
}

export function beaufortEncode(text: string, options?: ToolOptions): string {
  return beaufortCipher(text, (options?.key as string) || "BATMAN");
}

export function beaufortDecode(text: string, options?: ToolOptions): string {
  return beaufortCipher(text, (options?.key as string) || "BATMAN");
}
