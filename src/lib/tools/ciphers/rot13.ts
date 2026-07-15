import { caesarCipher } from "./caesar";

/** ROT13 — fixed Caesar shift of 13, relocated from CryptoLab.tsx */
export function rot13Encode(text: string): string {
  return caesarCipher(text, 13, false);
}

export function rot13Decode(text: string): string {
  return caesarCipher(text, 13, true);
}
