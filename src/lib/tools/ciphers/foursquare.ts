import type { ToolOptions } from "../types";

/**
 * Four-Square Cipher — two plaintext squares (standard A-Z order, I/J
 * merged, top-left and bottom-right) and two keyed ciphertext squares
 * (top-right from key1, bottom-left from key2). For plaintext digraph
 * (p1, p2): c1 = TR[row(p1), col(p2)], c2 = BL[row(p2), col(p1)].
 */

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
  return chars;
}

function coords(square: string[], ch: string): [number, number] {
  const idx = square.indexOf(ch);
  if (idx < 0) return [0, 0];
  return [Math.floor(idx / 5), idx % 5];
}

function prepText(text: string): string {
  const clean = text.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
  let out = "";
  for (let i = 0; i < clean.length; i++) {
    out += clean[i];
    if (i + 1 < clean.length && clean[i] === clean[i + 1]) {
      out += "X";
    }
  }
  if (out.length % 2 !== 0) out += "X";
  return out;
}

export function foursquareEncode(text: string, options?: ToolOptions): string {
  const key1 = ((options?.key1 as string) || "EXAMPLE").trim() || "EXAMPLE";
  const key2 = ((options?.key2 as string) || "KEYWORD").trim() || "KEYWORD";
  const plain = ALPHA25.split("");
  const tr = buildSquare(key1);
  const bl = buildSquare(key2);
  const prepped = prepText(text);
  if (!prepped) return "";

  let out = "";
  for (let i = 0; i < prepped.length; i += 2) {
    const [r1, c1] = coords(plain, prepped[i]);
    const [r2, c2] = coords(plain, prepped[i + 1]);
    out += tr[r1 * 5 + c2];
    out += bl[r2 * 5 + c1];
  }
  return out;
}

export function foursquareDecode(text: string, options?: ToolOptions): string {
  const key1 = ((options?.key1 as string) || "EXAMPLE").trim() || "EXAMPLE";
  const key2 = ((options?.key2 as string) || "KEYWORD").trim() || "KEYWORD";
  const plain = ALPHA25.split("");
  const tr = buildSquare(key1);
  const bl = buildSquare(key2);
  const clean = text.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
  if (!clean) return "";

  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const [r1, colP2] = coords(tr, clean[i]);
    const [r2, colP1] = coords(bl, clean[i + 1]);
    out += plain[r1 * 5 + colP1];
    out += plain[r2 * 5 + colP2];
  }
  return out;
}
