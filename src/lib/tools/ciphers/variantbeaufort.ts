import { ToolOptions } from "../types";

/**
 * Variant Beaufort Cipher
 * A variation where C = (P - K) mod 26.
 * Decoding is P = (C + K) mod 26.
 */
export function variantBeaufortEncode(text: string, options?: ToolOptions): string {
  const key = (options?.key as string) || "SECRET";
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
      // Formula: C = (P - K) mod 26
      return String.fromCharCode(((p - k + 26) % 26) + base);
    })
    .join("");
}

export function variantBeaufortDecode(text: string, options?: ToolOptions): string {
  const key = (options?.key as string) || "SECRET";
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
      const c = code - base;
      // Formula: P = (C + K) mod 26
      return String.fromCharCode(((c + k) % 26) + base);
    })
    .join("");
}
