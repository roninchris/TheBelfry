import { ToolOptions, TransformOutput } from "../types";

/**
 * Nihilist Substitution Cipher
 * Uses a keyed Polybius square and a secondary numeric keyword.
 * Step 1: Convert plaintext to Polybius coordinates.
 * Step 2: Convert key to Polybius coordinates.
 * Step 3: Add the two sequences of numbers together.
 */

function getPolybiusSquare(keyword: string = ""): string[][] {
  const alphabet = "ABCDEFGHIKLMNOPQRSTUVWXYZ"; // No J
  const cleanKeyword = keyword.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
  const seen = new Set<string>();
  const squareStr: string[] = [];

  for (const char of cleanKeyword) {
    if (!seen.has(char)) {
      seen.add(char);
      squareStr.push(char);
    }
  }

  for (const char of alphabet) {
    if (!seen.has(char)) {
      seen.add(char);
      squareStr.push(char);
    }
  }

  const square: string[][] = [];
  for (let i = 0; i < 5; i++) {
    square.push(squareStr.slice(i * 5, (i + 1) * 5));
  }
  return square;
}

function charToCoords(char: string, square: string[][]): number {
  const c = char === "J" ? "I" : char;
  for (let r = 0; r < 5; r++) {
    for (let col = 0; col < 5; col++) {
      if (square[r][col] === c) {
        return (r + 1) * 10 + (col + 1);
      }
    }
  }
  return 0;
}

function coordsToChar(coords: number, square: string[][]): string {
  const r = Math.floor(coords / 10) - 1;
  const col = (coords % 10) - 1;
  if (r >= 0 && r < 5 && col >= 0 && col < 5) {
    return square[r][col];
  }
  return "";
}

export function nihilistEncode(text: string, options?: ToolOptions): string {
  const keyword = (options?.keyword as string) || "SECRET";
  const key = (options?.key as string) || "CIPHER";
  const square = getPolybiusSquare(keyword);

  const plainCoords = text
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map((c) => charToCoords(c, square));

  const keyCoords = key
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map((c) => charToCoords(c, square));

  if (keyCoords.length === 0) throw new Error("Numeric key is required for Nihilist cipher");

  return plainCoords
    .map((p, i) => {
      const k = keyCoords[i % keyCoords.length];
      return p + k;
    })
    .join(" ");
}

export function nihilistDecode(text: string, options?: ToolOptions): string {
  const keyword = (options?.keyword as string) || "SECRET";
  const key = (options?.key as string) || "CIPHER";
  const square = getPolybiusSquare(keyword);

  const keyCoords = key
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map((c) => charToCoords(c, square));

  if (keyCoords.length === 0) throw new Error("Numeric key is required for Nihilist cipher");

  const cipherCoords = text
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10));

  return cipherCoords
    .map((c, i) => {
      const k = keyCoords[i % keyCoords.length];
      const p = c - k;
      return coordsToChar(p, square);
    })
    .join("");
}
