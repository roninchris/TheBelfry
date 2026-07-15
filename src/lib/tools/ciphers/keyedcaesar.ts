import { ToolOptions, TransformOutput } from "../types";

/**
 * Keyed Caesar Cipher
 * Like a standard Caesar shift, but the alphabet is reordered based on a keyword.
 * Example: Keyword "BATMAN" -> Alphabet: BATMNC DEFGHI...
 */

function getKeyedAlphabet(keyword: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const cleanKeyword = keyword.toUpperCase().replace(/[^A-Z]/g, "");
  const seen = new Set<string>();
  let result = "";

  for (const char of cleanKeyword) {
    if (!seen.has(char)) {
      seen.add(char);
      result += char;
    }
  }

  for (const char of alphabet) {
    if (!seen.has(char)) {
      seen.add(char);
      result += char;
    }
  }

  return result;
}

export function keyedCaesarEncode(text: string, options?: ToolOptions): string {
  const keyword = (options?.keyword as string) || "BATMAN";
  const shift = (options?.shift as number) || 0;
  const keyedAlphabet = getKeyedAlphabet(keyword);
  const standardAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  return text
    .toUpperCase()
    .split("")
    .map((char) => {
      const index = keyedAlphabet.indexOf(char);
      if (index === -1) return char;
      
      const newIndex = (index + shift + 26) % 26;
      return keyedAlphabet[newIndex];
    })
    .join("");
}

export function keyedCaesarDecode(text: string, options?: ToolOptions): string {
  const keyword = (options?.keyword as string) || "BATMAN";
  const shift = (options?.shift as number) || 0;
  const keyedAlphabet = getKeyedAlphabet(keyword);

  return text
    .toUpperCase()
    .split("")
    .map((char) => {
      const index = keyedAlphabet.indexOf(char);
      if (index === -1) return char;
      
      const newIndex = (index - shift + 26) % 26;
      return keyedAlphabet[newIndex];
    })
    .join("");
}
