import type { TransformResult } from "../types";

/** XOR bitwise cipher — relocated from CryptoLab.tsx */
export function xorCipherHex(text: string, key: string): TransformResult {
  if (!key) return { text, hex: "" };
  const bytes = text.split("").map((char, index) => {
    const keyCode = key.charCodeAt(index % key.length);
    const charCode = char.charCodeAt(0);
    return charCode ^ keyCode;
  });

  const resultText = bytes
    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
    .join("");

  const hexText = bytes
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");

  return { text: resultText, hex: hexText };
}

export function xorEncode(text: string, options?: { key?: string }): TransformResult {
  return xorCipherHex(text, options?.key ?? "");
}

export function xorDecode(text: string, options?: { key?: string }): TransformResult {
  return xorCipherHex(text, options?.key ?? "");
}
