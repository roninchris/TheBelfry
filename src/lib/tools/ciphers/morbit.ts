import type { ToolOptions } from "../types";
import { MORSE_ALPHABET, MORSE_ALPHABET_REVERSE } from "../crypto-utils";

/**
 * Morbit Cipher — converts text to Morse (letters joined by a single 'x',
 * words by 'xx'), then reads the resulting dot/dash/x stream two symbols at
 * a time. Each of the 9 possible pairs (from {., -, x} x {., -, x}) maps to
 * a distinct digit 1-9 via a keyed permutation, so the ciphertext is a
 * string of digits.
 */

const PAIR_ORDER = ["..", ".-", ".x", "-.", "--", "-x", "x.", "x-", "xx"];

function normalizeDigitKey(key: string): string[] {
  const digits = (key || "").replace(/[^1-9]/g, "").split("");
  const seen = new Set<string>();
  const order: string[] = [];
  for (const d of digits) {
    if (!seen.has(d)) {
      seen.add(d);
      order.push(d);
    }
  }
  for (let d = 1; d <= 9; d++) {
    const s = String(d);
    if (!seen.has(s)) {
      seen.add(s);
      order.push(s);
    }
  }
  return order; // 9 distinct digits '1'-'9' in pair-assignment order
}

export function morbitEncode(text: string, options?: ToolOptions): string {
  const digitOrder = normalizeDigitKey((options?.key as string) || "123456789");
  const pairToDigit: Record<string, string> = {};
  PAIR_ORDER.forEach((pair, i) => {
    pairToDigit[pair] = digitOrder[i];
  });

  const clean = text.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
  const words = clean.split(" ").filter(Boolean);
  if (words.length === 0) return "";

  let morseStream = words
    .map((word) => word.split("").map((ch) => MORSE_ALPHABET[ch] || "").join("x"))
    .join("xx");
  if (morseStream.length % 2 !== 0) morseStream += "x";

  let out = "";
  for (let i = 0; i < morseStream.length; i += 2) {
    out += pairToDigit[morseStream.slice(i, i + 2)] ?? "";
  }
  return out;
}

export function morbitDecode(text: string, options?: ToolOptions): string {
  const digitOrder = normalizeDigitKey((options?.key as string) || "123456789");
  const digitToPair: Record<string, string> = {};
  digitOrder.forEach((d, i) => {
    digitToPair[d] = PAIR_ORDER[i];
  });

  const digits = text.replace(/[^1-9]/g, "").split("");
  const morseStream = digits.map((d) => digitToPair[d] ?? "").join("");

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
