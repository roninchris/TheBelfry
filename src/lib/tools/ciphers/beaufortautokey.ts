import { ToolOptions } from "../types";

/**
 * Beaufort Autokey Cipher
 * Beaufort cipher with a running key extended by the plaintext.
 */
export function beaufortAutokeyEncode(text: string, options?: ToolOptions): string {
  const key = (options?.key as string) || "BATMAN";
  const cleanKey = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (!cleanKey) return text;

  const cleanText = text.toUpperCase().replace(/[^A-Z]/g, "");
  const fullKey = (cleanKey + cleanText).toUpperCase();
  
  let keyIndex = 0;
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      let isUpper = false;
      if (code >= 65 && code <= 90) isUpper = true;
      else if (code >= 97 && code <= 122) isUpper = false;
      else return char;

      const k = fullKey.charCodeAt(keyIndex) - 65;
      keyIndex++;

      const base = isUpper ? 65 : 97;
      const p = code - base;
      return String.fromCharCode(((k - p + 26) % 26) + base);
    })
    .join("");
}

export function beaufortAutokeyDecode(text: string, options?: ToolOptions): string {
  const key = (options?.key as string) || "BATMAN";
  const cleanKey = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (!cleanKey) return text;

  let result = "";
  let keyIndex = 0;
  let keystream = cleanKey;

  const chars = text.split("");
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const code = char.charCodeAt(0);
    let isUpper = false;
    if (code >= 65 && code <= 90) isUpper = true;
    else if (code >= 97 && code <= 122) isUpper = false;
    else {
      result += char;
      continue;
    }

    const k = keystream.charCodeAt(keyIndex) - 65;
    const base = isUpper ? 65 : 97;
    const c = code - base;
    
    // Beaufort: P = (K - C) mod 26
    const p = (k - c + 26) % 26;
    const decodedChar = String.fromCharCode(p + base);
    result += decodedChar;
    
    // Add decoded char to keystream
    keystream += decodedChar.toUpperCase();
    keyIndex++;
  }

  return result;
}
