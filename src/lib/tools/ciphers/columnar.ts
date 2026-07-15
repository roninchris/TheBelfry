import type { ToolOptions } from "../types";
import { columnarTransposeEncode, columnarTransposeDecode } from "../crypto-utils";

/**
 * Columnar Transposition Cipher — writes the message into a grid whose
 * width equals the key length, then reads the columns back out in the
 * key's alphabetical order (irregular / no padding).
 */

export function columnarEncode(text: string, options?: ToolOptions): string {
  const key = ((options?.key as string) || "KEY").trim() || "KEY";
  if (!text) return "";
  return columnarTransposeEncode(text, key);
}

export function columnarDecode(text: string, options?: ToolOptions): string {
  const key = ((options?.key as string) || "KEY").trim() || "KEY";
  if (!text) return "";
  return columnarTransposeDecode(text, key);
}
