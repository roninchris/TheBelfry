/** Caesar shift cipher — relocated from CryptoLab.tsx */
export function caesarCipher(text: string, shift: number, decrypt = false): string {
  const s = decrypt ? (26 - (shift % 26)) % 26 : ((shift % 26) + 26) % 26;
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + s) % 26) + 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + s) % 26) + 97);
      }
      return char;
    })
    .join("");
}

export function caesarEncode(text: string, options?: { shift?: number }): string {
  return caesarCipher(text, options?.shift ?? 3, false);
}

export function caesarDecode(text: string, options?: { shift?: number }): string {
  return caesarCipher(text, options?.shift ?? 3, true);
}
