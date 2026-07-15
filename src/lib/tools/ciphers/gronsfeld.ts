import { ToolOptions, TransformOutput } from "../types";

/**
 * Gronsfeld Cipher
 * A variation of the Vigenère cipher where the key is a sequence of digits.
 * Each digit represents the shift for the corresponding character.
 */

export function gronsfeldEncode(text: string, options?: ToolOptions): string {
  const key = (options?.key as string) || "1234";
  if (!/^\d+$/.test(key)) {
    throw new Error("Gronsfeld key must consist of digits only.");
  }

  const digits = key.split("").map((d) => parseInt(d, 10));
  let keyIndex = 0;

  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      let shift = digits[keyIndex % digits.length];
      let result = char;

      if (code >= 65 && code <= 90) {
        result = String.fromCharCode(((code - 65 + shift) % 26) + 65);
        keyIndex++;
      } else if (code >= 97 && code <= 122) {
        result = String.fromCharCode(((code - 97 + shift) % 26) + 97);
        keyIndex++;
      }

      return result;
    })
    .join("");
}

export function gronsfeldDecode(text: string, options?: ToolOptions): string {
  const key = (options?.key as string) || "1234";
  if (!/^\d+$/.test(key)) {
    throw new Error("Gronsfeld key must consist of digits only.");
  }

  const digits = key.split("").map((d) => parseInt(d, 10));
  let keyIndex = 0;

  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      let shift = digits[keyIndex % digits.length];
      let result = char;

      if (code >= 65 && code <= 90) {
        result = String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
        keyIndex++;
      } else if (code >= 97 && code <= 122) {
        result = String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
        keyIndex++;
      }

      return result;
    })
    .join("");
}
