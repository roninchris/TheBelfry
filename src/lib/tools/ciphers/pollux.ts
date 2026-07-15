import type { ToolOptions } from "../types";
import { MORSE_ALPHABET, MORSE_ALPHABET_REVERSE } from "../crypto-utils";

/**
 * Pollux Cipher — like Morbit but fractionates one Morse symbol per digit
 * instead of pairs. The 10 digits are split into three groups (default 4/3/3)
 * assigned to dot, dash, and the letter-separator respectively; encoding
 * picks a random digit from the correct group each time (homophonic), while
 * decoding just looks up which group a digit belongs to — unambiguous
 * regardless of which digit was chosen during encoding.
 */

function parseGroups(key: string): { dot: string[]; dash: string[]; x: string[] } {
  const digits = (key || "").replace(/[^0-9]/g, "");
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const d of digits) {
    if (!seen.has(d)) {
      seen.add(d);
      unique.push(d);
    }
  }
  for (let d = 0; d <= 9; d++) {
    const s = String(d);
    if (!seen.has(s)) {
      seen.add(s);
      unique.push(s);
    }
  }
  return {
    dot: unique.slice(0, 4),
    dash: unique.slice(4, 7),
    x: unique.slice(7, 10),
  };
}

export function polluxEncode(text: string, options?: ToolOptions): string {
  const groups = parseGroups((options?.key as string) || "0123456789");
  const clean = text.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
  const words = clean.split(" ").filter(Boolean);
  if (words.length === 0) return "";

  const morseStream = words
    .map((word) => word.split("").map((ch) => MORSE_ALPHABET[ch] || "").join("x"))
    .join("xx");

  let out = "";
  for (const sym of morseStream) {
    const pool = sym === "." ? groups.dot : sym === "-" ? groups.dash : groups.x;
    if (pool.length === 0) continue;
    out += pool[Math.floor(Math.random() * pool.length)];
  }
  return out;
}

export function polluxDecode(text: string, options?: ToolOptions): string {
  const groups = parseGroups((options?.key as string) || "0123456789");
  const digitToSymbol: Record<string, string> = {};
  groups.dot.forEach((d) => (digitToSymbol[d] = "."));
  groups.dash.forEach((d) => (digitToSymbol[d] = "-"));
  groups.x.forEach((d) => (digitToSymbol[d] = "x"));

  const digits = text.replace(/[^0-9]/g, "").split("");
  const morseStream = digits.map((d) => digitToSymbol[d] ?? "").join("");

  return morseStream
    .split("xx")
    .map((word) =>
      word
        .split("x")
        .map((sym) => MORSE_ALPHABET_REVERSE[sym] || "")
        .join("")
    )
    .join(" ");
}
