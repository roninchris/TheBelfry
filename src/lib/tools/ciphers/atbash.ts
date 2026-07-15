/** Atbash mirror cipher — relocated from CryptoLab.tsx */
export function atbashCipher(text: string): string {
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(90 - (code - 65));
      }
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(122 - (code - 97));
      }
      return char;
    })
    .join("");
}

export const atbashEncode = atbashCipher;
export const atbashDecode = atbashCipher;
