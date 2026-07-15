/** Vigenère polyalphabetic cipher — relocated from CryptoLab.tsx */
export function vigenereCipher(text: string, key: string, decrypt = false): string {
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
      const shift = decrypt ? (26 - k) % 26 : k;
      return String.fromCharCode(((code - base + shift) % 26) + base);
    })
    .join("");
}

export function vigenereEncode(text: string, options?: { key?: string }): string {
  return vigenereCipher(text, options?.key ?? "", false);
}

export function vigenereDecode(text: string, options?: { key?: string }): string {
  return vigenereCipher(text, options?.key ?? "", true);
}
