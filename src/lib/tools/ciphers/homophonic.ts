import { ToolOptions, TransformOutput } from "../types";

/**
 * Homophonic Substitution Cipher
 * Each plaintext character maps to one or more potential numeric codes.
 * During encryption, a code is chosen randomly from the available set.
 */

const DEFAULT_KEY_MAP: Record<string, string[]> = {
  A: ["08", "11", "25", "37"],
  B: ["12"],
  C: ["13", "42"],
  D: ["14", "43"],
  E: ["01", "15", "26", "38", "49", "50", "61"],
  F: ["16"],
  G: ["17"],
  H: ["18", "44"],
  I: ["09", "19", "27", "39"],
  J: ["20"],
  K: ["21"],
  L: ["22", "45"],
  M: ["23", "46"],
  N: ["02", "24", "28", "40"],
  O: ["03", "29", "31", "41"],
  P: ["30"],
  Q: ["32"],
  R: ["04", "33", "47", "51"],
  S: ["05", "34", "48", "52"],
  T: ["06", "35", "53", "54", "62"],
  U: ["07", "36", "55"],
  V: ["56"],
  W: ["57"],
  X: ["58"],
  Y: ["59"],
  Z: ["60"],
  " ": ["00"],
};

export function homophonicEncode(text: string, options?: ToolOptions): string {
  const keyMap = (options?.keyMap as Record<string, string[]>) || DEFAULT_KEY_MAP;
  
  return text
    .toUpperCase()
    .split("")
    .map((char) => {
      const codes = keyMap[char];
      if (codes && codes.length > 0) {
        // Pick a random code from the homophones
        const index = Math.floor(Math.random() * codes.length);
        return codes[index];
      }
      return char;
    })
    .join(" ");
}

export function homophonicDecode(text: string, options?: ToolOptions): string {
  const keyMap = (options?.keyMap as Record<string, string[]>) || DEFAULT_KEY_MAP;
  
  // Create reverse map
  const reverseMap: Record<string, string> = {};
  Object.entries(keyMap).forEach(([char, codes]) => {
    codes.forEach((code) => {
      reverseMap[code] = char;
    });
  });

  return text
    .split(/\s+/)
    .map((code) => {
      if (reverseMap[code]) return reverseMap[code];
      return code;
    })
    .join("");
}
