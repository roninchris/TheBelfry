import { ToolOptions, TransformOutput } from "../types";

const PIGPEN_MAP: Record<string, string> = {
  A: "1-UL", B: "1-UC", C: "1-UR",
  D: "1-ML", E: "1-MC", F: "1-MR",
  G: "1-LL", H: "1-LC", I: "1-LR",
  J: "2-UL", K: "2-UC", L: "2-UR",
  M: "2-ML", N: "2-MC", O: "2-MR",
  P: "2-LL", Q: "2-LC", R: "2-LR",
  S: "3-U", T: "3-L", U: "3-R", V: "3-D",
  W: "4-U", X: "4-L", Y: "4-R", Z: "4-D",
};

const REVERSE_PIGPEN_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PIGPEN_MAP).map(([k, v]) => [v, k])
);

/**
 * Pigpen (Masonic) Cipher
 * Represented as Grid-Position pairs (e.g., 1-UL for Grid 1, Upper Left).
 */
export function pigpenEncode(text: string): string {
  return text
    .toUpperCase()
    .split("")
    .map((char) => {
      if (char === " ") return " ";
      if (PIGPEN_MAP[char]) return PIGPEN_MAP[char];
      return char;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pigpenDecode(text: string): string {
  return text
    .split(" ")
    .map((part) => {
      if (part === "") return "";
      if (REVERSE_PIGPEN_MAP[part]) return REVERSE_PIGPEN_MAP[part];
      return part;
    })
    .join("");
}
