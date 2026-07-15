import { ToolOptions } from "../types";

/**
 * Base100 (Emoji) encoding
 * Maps each byte to an emoji in the range U+1F400 to U+1F463
 */
export function base100Encode(str: string): string {
  if (!str) return "";
  const bytes = new TextEncoder().encode(str);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    // Range starts at 0x1F400
    result += String.fromCodePoint(0x1F400 + bytes[i]);
  }
  return result;
}

export function base100Decode(str: string): string {
  if (!str) return "";
  const result: number[] = [];
  // Use spread to handle multi-byte emoji correctly
  const chars = Array.from(str);
  for (const char of chars) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= 0x1F400 && code <= 0x1F4FF) {
      result.push(code - 0x1F400);
    }
  }
  return new TextDecoder().decode(new Uint8Array(result));
}
