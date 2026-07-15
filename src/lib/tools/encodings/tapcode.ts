import { ToolOptions } from "../types";

/**
 * Tap Code
 * Based on a 5x5 Polybius square (usually C and K share a cell).
 * Format: row dots, then column dots. e.g., A = . .. (1, 1), but often represented as digits.
 * We will use dot notation as default.
 */

const GRID = [
  ["A", "B", "C", "D", "E"],
  ["F", "G", "H", "I", "J"],
  ["L", "M", "N", "O", "P"],
  ["Q", "R", "S", "T", "U"],
  ["V", "W", "X", "Y", "Z"]
];

const charToCode: Record<string, string> = {};
const codeToChar: Record<string, string> = {};

for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const char = GRID[r][c];
    const code = `${r + 1}.${c + 1}`;
    charToCode[char] = code;
    codeToChar[code] = char;
  }
}
// K is missing in standard Tap Code grid, maps to C
charToCode["K"] = charToCode["C"];

export function tapCodeEncode(text: string): string {
  const up = text.toUpperCase();
  const results: string[] = [];

  for (const char of up) {
    if (charToCode[char]) {
      const [r, c] = charToCode[char].split(".");
      results.push(".".repeat(parseInt(r)) + " " + ".".repeat(parseInt(c)));
    } else if (char === " ") {
      results.push("/");
    }
  }
  return results.join("  ");
}

export function tapCodeDecode(text: string): string {
  const parts = text.trim().split(/\s{2,}/);
  let result = "";

  for (const part of parts) {
    if (part === "/") {
      result += " ";
      continue;
    }
    const dots = part.split(/\s+/);
    if (dots.length === 2) {
      const r = dots[0].length;
      const c = dots[1].length;
      const code = `${r}.${c}`;
      result += codeToChar[code] || "";
    }
  }
  return result;
}
