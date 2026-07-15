import { ToolOptions, TransformOutput } from "../types";

/**
 * Scytale Transposition Cipher
 * Ancient Greek cipher using a rod of a certain diameter.
 * Diameter (number of rows) determines the transposition.
 */

export function scytaleEncode(text: string, options?: ToolOptions): string {
  const faces = (options?.faces as number) || 4;
  const cleanText = text.replace(/\s+/g, "");
  const numCols = Math.ceil(cleanText.length / faces);
  
  let result = "";
  for (let i = 0; i < faces; i++) {
    for (let j = 0; j < numCols; j++) {
      const idx = j * faces + i;
      if (idx < cleanText.length) {
        result += cleanText[idx];
      } else {
        result += "X"; // Padding
      }
    }
  }
  return result;
}

export function scytaleDecode(text: string, options?: ToolOptions): string {
  const faces = (options?.faces as number) || 4;
  const numCols = Math.ceil(text.length / faces);
  
  const grid: string[][] = Array.from({ length: faces }, () => new Array(numCols).fill(""));
  let textIdx = 0;
  for (let i = 0; i < faces; i++) {
    for (let j = 0; j < numCols; j++) {
      grid[i][j] = text[textIdx++];
    }
  }

  let result = "";
  for (let j = 0; j < numCols; j++) {
    for (let i = 0; i < faces; i++) {
      result += grid[i][j];
    }
  }
  return result.replace(/X+$/, "");
}
