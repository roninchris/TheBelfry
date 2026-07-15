import type { ToolOptions } from "../types";
import { columnarTransposeEncode, columnarTransposeDecode } from "../crypto-utils";

/**
 * ADFGX Cipher — WWI German field cipher. Plaintext letters (I/J merged) are
 * looked up in a keyed 5x5 square and replaced by their row/column labels
 * (A, D, F, G, X). The resulting letter-pair stream is then scrambled with a
 * second, independent keyed columnar transposition.
 */

const LABELS = ["A", "D", "F", "G", "X"];
const ALPHA25 = "ABCDEFGHIKLMNOPQRSTUVWXYZ"; // J -> I

function buildSquare(key: string): string[] {
  const clean = key.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
  const seen = new Set<string>();
  const chars: string[] = [];
  for (const ch of clean + ALPHA25) {
    if (!seen.has(ch) && ALPHA25.includes(ch)) {
      seen.add(ch);
      chars.push(ch);
    }
  }
  return chars; // 25 letters, row-major 5x5
}

function fractionate(text: string, square: string[]): string {
  const clean = text.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
  let out = "";
  for (const ch of clean) {
    const pos = square.indexOf(ch);
    if (pos < 0) continue;
    out += LABELS[Math.floor(pos / 5)] + LABELS[pos % 5];
  }
  return out;
}

function unfractionate(pairs: string, square: string[]): string {
  let out = "";
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const row = LABELS.indexOf(pairs[i]);
    const col = LABELS.indexOf(pairs[i + 1]);
    if (row < 0 || col < 0) continue;
    out += square[row * 5 + col];
  }
  return out;
}

export function adfgxEncode(text: string, options?: ToolOptions): string {
  const squareKey = ((options?.squareKey as string) || "KEYWORD").trim() || "KEYWORD";
  const transKey = ((options?.key as string) || "CIPHER").trim() || "CIPHER";
  const square = buildSquare(squareKey);
  const fractionated = fractionate(text, square);
  if (!fractionated) return "";
  return columnarTransposeEncode(fractionated, transKey);
}

export function adfgxDecode(text: string, options?: ToolOptions): string {
  const squareKey = ((options?.squareKey as string) || "KEYWORD").trim() || "KEYWORD";
  const transKey = ((options?.key as string) || "CIPHER").trim() || "CIPHER";
  const square = buildSquare(squareKey);
  const cleanCipher = text.toUpperCase().replace(/[^ADFGX]/g, "");
  if (!cleanCipher) return "";
  const untransposed = columnarTransposeDecode(cleanCipher, transKey);
  return unfractionate(untransposed, square);
}
