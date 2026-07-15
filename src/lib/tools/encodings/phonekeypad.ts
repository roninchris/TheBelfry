import { ToolOptions } from "../types";

/**
 * Phone Keypad (Multi-tap) encoding
 */

const MAP: Record<string, string> = {
  "A": "2", "B": "22", "C": "222",
  "D": "3", "E": "33", "F": "333",
  "G": "4", "H": "44", "I": "444",
  "J": "5", "K": "55", "L": "555",
  "M": "6", "N": "66", "O": "666",
  "P": "7", "Q": "77", "R": "777", "S": "7777",
  "T": "8", "U": "88", "V": "888",
  "W": "9", "X": "99", "Y": "999", "Z": "9999",
  " ": "0"
};

const REVERSE_MAP: Record<string, string> = {};
for (const key in MAP) {
  REVERSE_MAP[MAP[key]] = key;
}

export function phoneKeypadEncode(text: string): string {
  const up = text.toUpperCase();
  const results: string[] = [];

  for (const char of up) {
    if (MAP[char]) {
      results.push(MAP[char]);
    }
  }
  return results.join(" ");
}

export function phoneKeypadDecode(text: string): string {
  const codes = text.trim().split(/\s+/);
  let result = "";

  for (const code of codes) {
    result += REVERSE_MAP[code] || "";
  }
  return result;
}
