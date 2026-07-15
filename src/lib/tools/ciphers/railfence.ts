/** Rail Fence transposition cipher — ported from cryptii's RailFenceCipher encoder */
function rowForPosition(x: number, rails: number, offset: number): number {
  const cycle = rails * 2 - 2;
  if (cycle <= 0) return 0;
  return rails - 1 - Math.abs(cycle / 2 - ((x + offset) % cycle));
}

export function railFenceEncode(text: string, options?: { rails?: number; offset?: number }): string {
  const rails = options?.rails ?? 3;
  const offset = options?.offset ?? 0;
  if (rails < 2) return text;
  const rows: string[] = new Array(rails).fill("");
  for (let x = 0; x < text.length; x++) {
    rows[rowForPosition(x, rails, offset)] += text[x];
  }
  return rows.join("");
}

export function railFenceDecode(text: string, options?: { rails?: number; offset?: number }): string {
  const rails = options?.rails ?? 3;
  const offset = options?.offset ?? 0;
  if (rails < 2) return text;
  const n = text.length;
  const rowIdx = new Array(n);
  const rowCounts = new Array(rails).fill(0);
  for (let x = 0; x < n; x++) {
    const y = rowForPosition(x, rails, offset);
    rowIdx[x] = y;
    rowCounts[y]++;
  }
  const rowChars: string[][] = [];
  let pos = 0;
  for (let r = 0; r < rails; r++) {
    rowChars[r] = text.slice(pos, pos + rowCounts[r]).split("");
    pos += rowCounts[r];
  }
  const rowPointers = new Array(rails).fill(0);
  const result = new Array(n);
  for (let x = 0; x < n; x++) {
    const y = rowIdx[x];
    result[x] = rowChars[y][rowPointers[y]++];
  }
  return result.join("");
}