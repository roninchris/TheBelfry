import { ToolOptions, TransformOutput } from "../types";

/**
 * Double Columnar Transposition Cipher
 * Applies two columnar transpositions in sequence.
 * Uses two keys: key1 and key2.
 */

function columnarEncode(text: string, key: string): string {
  const cleanText = text.replace(/\s+/g, "");
  const numCols = key.length;
  const keyOrder = key
    .split("")
    .map((char, i) => ({ char, i }))
    .sort((a, b) => a.char.localeCompare(b.char))
    .map((item) => item.i);

  const numRows = Math.ceil(cleanText.length / numCols);
  let result = "";

  for (const colIdx of keyOrder) {
    for (let r = 0; r < numRows; r++) {
      const charIdx = r * numCols + colIdx;
      if (charIdx < cleanText.length) {
        result += cleanText[charIdx];
      }
    }
  }
  return result;
}

function columnarDecode(text: string, key: string): string {
  const numCols = key.length;
  const numRows = Math.ceil(text.length / numCols);
  const fullCols = text.length % numCols;
  
  const keyOrder = key
    .split("")
    .map((char, i) => ({ char, i }))
    .sort((a, b) => a.char.localeCompare(b.char))
    .map((item) => ({ ...item, order: 0 }));

  keyOrder.forEach((item, index) => {
    item.order = index;
  });

  const colLengths = new Array(numCols).fill(numRows);
  if (fullCols !== 0) {
    for (let i = fullCols; i < numCols; i++) {
      colLengths[i]--;
    }
  }

  const sortedKeyOrder = [...keyOrder].sort((a, b) => a.i - b.i);
  const grid: string[][] = Array.from({ length: numRows }, () => new Array(numCols).fill(""));
  
  let currentIdx = 0;
  // Columns in the order they were written (alphabetical key order)
  const alphabeticalOrder = [...keyOrder].sort((a, b) => a.char.localeCompare(b.char) || a.i - b.i);
  
  for (const colInfo of alphabeticalOrder) {
    const len = colLengths[colInfo.i];
    for (let r = 0; r < len; r++) {
      grid[r][colInfo.i] = text[currentIdx++];
    }
  }

  let result = "";
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (grid[r][c]) result += grid[r][c];
    }
  }
  return result;
}

export function doubleTranspositionEncode(text: string, options?: ToolOptions): string {
  const key1 = (options?.key1 as string) || "SECRET";
  const key2 = (options?.key2 as string) || "CIPHER";
  
  const firstPass = columnarEncode(text, key1);
  return columnarEncode(firstPass, key2);
}

export function doubleTranspositionDecode(text: string, options?: ToolOptions): string {
  const key1 = (options?.key1 as string) || "SECRET";
  const key2 = (options?.key2 as string) || "CIPHER";
  
  const firstPass = columnarDecode(text, key2);
  return columnarDecode(firstPass, key1);
}
