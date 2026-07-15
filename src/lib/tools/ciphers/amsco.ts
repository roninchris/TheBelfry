import { ToolOptions, TransformOutput } from "../types";

/**
 * Amsco Transposition Cipher
 * Text is written into a grid in alternating single letters and pairs.
 * The columns are then read out based on the alphabetical order of the keyword.
 */

export function amscoEncode(text: string, options?: ToolOptions): string {
  const keyword = (options?.key as string) || "BATMAN";
  const cleanText = text.replace(/\s+/g, "");
  const numCols = keyword.length;
  
  // Determine column order based on keyword
  const keyOrder = keyword
    .split("")
    .map((char, i) => ({ char, i }))
    .sort((a, b) => a.char.localeCompare(b.char))
    .map((item) => item.i);

  const rows: string[][] = [];
  let textIndex = 0;
  let isPair = true; // Start with pair or single? Amsco usually alternates.

  while (textIndex < cleanText.length) {
    const row: string[] = [];
    for (let c = 0; c < numCols; c++) {
      const take = isPair ? 2 : 1;
      row[c] = cleanText.substring(textIndex, textIndex + take);
      textIndex += take;
      isPair = !isPair;
      if (textIndex >= cleanText.length) break;
    }
    rows.push(row);
  }

  // Read out by columns in key order
  let result = "";
  for (const colIndex of keyOrder) {
    for (const row of rows) {
      if (row[colIndex]) result += row[colIndex];
    }
  }

  return result;
}

export function amscoDecode(text: string, options?: ToolOptions): string {
  const keyword = (options?.key as string) || "BATMAN";
  const numCols = keyword.length;
  const keyOrder = keyword
    .split("")
    .map((char, i) => ({ char, i }))
    .sort((a, b) => a.char.localeCompare(b.char))
    .map((item) => item.i);

  // First, reconstruct the grid structure (how many chars in each cell)
  const cellLengths: number[][] = [];
  let textLength = text.length;
  let textIndex = 0;
  let currentPos = 0;
  let isPair = true;

  const rowsCount = Math.ceil(text.length / 1.5 / numCols) + 2; // Rough estimate
  const grid: string[][] = Array.from({ length: rowsCount }, () => []);

  let charsProcessed = 0;
  let r = 0;
  while (charsProcessed < text.length) {
    for (let c = 0; c < numCols; c++) {
      const take = Math.min(isPair ? 2 : 1, text.length - charsProcessed);
      grid[r][c] = " ".repeat(take); // Placeholder
      charsProcessed += take;
      isPair = !isPair;
      if (charsProcessed >= text.length) break;
    }
    r++;
  }

  // Fill the grid based on column order
  let currentIdx = 0;
  for (const colIndex of keyOrder) {
    for (let rowIdx = 0; rowIdx < grid.length; rowIdx++) {
      if (grid[rowIdx] && grid[rowIdx][colIndex]) {
        const len = grid[rowIdx][colIndex].length;
        grid[rowIdx][colIndex] = text.substring(currentIdx, currentIdx + len);
        currentIdx += len;
      }
    }
  }

  // Read out the grid row by row
  let result = "";
  for (let rowIdx = 0; rowIdx < grid.length; rowIdx++) {
    for (let colIdx = 0; colIdx < numCols; colIdx++) {
      if (grid[rowIdx] && grid[rowIdx][colIdx]) {
        result += grid[rowIdx][colIdx];
      }
    }
  }

  return result;
}
