import type { ToolOptions } from "../types";

/**
 * Grandpré Cipher — homophonic substitution over a 10x26 grid. Row r
 * (labeled by the r-th distinct letter of the keyword, default REPUBLICAN —
 * the historical 10-letter keyword) contains the alphabet Caesar-shifted by
 * r. A plaintext letter at position l can be encoded from any row r as
 * (rowLabel, columnLetter) where column = (l - r) mod 26 — giving every
 * letter up to 10 different valid ciphertext pairs (true homophony), while
 * decoding is unambiguous: l = (column + r) mod 26 regardless of which row
 * was used to encode it.
 */

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function normalizeKeyword(keyword: string): string[] {
  const clean = keyword.toUpperCase().replace(/[^A-Z]/g, "");
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const ch of clean) {
    if (!seen.has(ch)) {
      seen.add(ch);
      rows.push(ch);
    }
    if (rows.length === 10) break;
  }
  for (const ch of ALPHA) {
    if (rows.length === 10) break;
    if (!seen.has(ch)) {
      seen.add(ch);
      rows.push(ch);
    }
  }
  return rows; // 10 distinct row-label letters
}

export function grandpreEncode(text: string, options?: ToolOptions): string {
  const keyword = ((options?.key as string) || "REPUBLICAN").trim() || "REPUBLICAN";
  const rows = normalizeKeyword(keyword);
  const out: string[] = [];
  for (const rawCh of text) {
    const ch = rawCh.toUpperCase();
    const l = ALPHA.indexOf(ch);
    if (l < 0) {
      if (rawCh === " ") out.push("/");
      continue;
    }
    const r = Math.floor(Math.random() * 10);
    const c = (l - r + 26) % 26;
    out.push(rows[r] + ALPHA[c]);
  }
  return out.join(" ");
}

export function grandpreDecode(text: string, options?: ToolOptions): string {
  const keyword = ((options?.key as string) || "REPUBLICAN").trim() || "REPUBLICAN";
  const rows = normalizeKeyword(keyword);
  const tokens = text.trim().split(/\s+/);
  let out = "";
  for (const tok of tokens) {
    if (tok === "/") {
      out += " ";
      continue;
    }
    if (tok.length !== 2) continue;
    const r = rows.indexOf(tok[0].toUpperCase());
    const c = ALPHA.indexOf(tok[1].toUpperCase());
    if (r < 0 || c < 0) continue;
    out += ALPHA[(c + r) % 26];
  }
  return out;
}
