import type { ToolOptions } from "../types";

/**
 * ROT-N family — generalized Caesar rotation, plus the two other common
 * fixed rotations: ROT5 (digits only) and ROT18 (ROT13 letters + ROT5
 * digits combined, both self-inverse).
 */

function shiftLetters(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + s) % 26) + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + s) % 26) + 97);
      return ch;
    })
    .join("");
}

function shiftDigits(text: string, shift: number): string {
  const s = ((shift % 10) + 10) % 10;
  return text
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 48 && code <= 57) return String.fromCharCode(((code - 48 + s) % 10) + 48);
      return ch;
    })
    .join("");
}

/** ROT-N — configurable-shift rotation over the Latin alphabet only. */
export function rotNEncode(text: string, options?: ToolOptions): string {
  const n = (options?.shift as number) ?? 13;
  return shiftLetters(text, n);
}
export function rotNDecode(text: string, options?: ToolOptions): string {
  const n = (options?.shift as number) ?? 13;
  return shiftLetters(text, -n);
}

/** ROT5 — rotates digits 0-9 by 5; letters untouched. Self-inverse. */
export function rot5Encode(text: string): string {
  return shiftDigits(text, 5);
}
export function rot5Decode(text: string): string {
  return shiftDigits(text, 5);
}

/** ROT18 — ROT13 on letters combined with ROT5 on digits. Self-inverse. */
export function rot18Encode(text: string): string {
  return shiftDigits(shiftLetters(text, 13), 5);
}
export function rot18Decode(text: string): string {
  return shiftDigits(shiftLetters(text, 13), 5);
}
