import type { ToolOptions } from "../types";
import { columnarTransposeEncode, columnarTransposeDecode } from "../crypto-utils";

/**
 * ADFGVX Cipher — successor to ADFGX that adds digits 0-9, needing a 6x6
 * square instead of 5x5. Same two-stage design: fractionate through the
 * keyed square, then scramble with a keyed columnar transposition.
 */

const LABELS = ["A", "D", "F", "G", "V", "X"];
const ALPHANUM36 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function buildSquare(key: string): string[] {
  const clean = key.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const seen = new Set<string>();
  const chars: string[] = [];
  for (const ch of clean + ALPHANUM36) {
    if (!seen.has(ch) && ALPHANUM36.includes(ch)) {
      seen.add(ch);
      chars.push(ch);
    }
  }
  return chars; // 36 chars, row-major 6x6
}

function fractionate(text: string, square: string[]): string {
  const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let out = "";
  for (const ch of clean) {
    const pos = square.indexOf(ch);
    if (pos < 0) continue;
    out += LABELS[Math.floor(pos / 6)] + LABELS[pos % 6];
  }
  return out;
}

function unfractionate(pairs: string, square: string[]): string {
  let out = "";
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const row = LABELS.indexOf(pairs[i]);
    const col = LABELS.indexOf(pairs[i + 1]);
    if (row < 0 || col < 0) continue;
    out += square[row * 6 + col];
  }
  return out;
}

export function adfgvxEncode(text: string, options?: ToolOptions): string {
  const squareKey = ((options?.squareKey as string) || "KEYWORD").trim() || "KEYWORD";
  const transKey = ((options?.key as string) || "CIPHER").trim() || "CIPHER";
  const square = buildSquare(squareKey);
  const fractionated = fractionate(text, square);
  if (!fractionated) return "";
  return columnarTransposeEncode(fractionated, transKey);
}

export function adfgvxDecode(text: string, options?: ToolOptions): string {
  const squareKey = ((options?.squareKey as string) || "KEYWORD").trim() || "KEYWORD";
  const transKey = ((options?.key as string) || "CIPHER").trim() || "CIPHER";
  const square = buildSquare(squareKey);
  const cleanCipher = text.toUpperCase().replace(/[^ADFGVX]/g, "");
  if (!cleanCipher) return "";
  const untransposed = columnarTransposeDecode(cleanCipher, transKey);
  return unfractionate(untransposed, square);
}
