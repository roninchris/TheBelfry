
/**
 * Shared cryptographic utilities for identification and brute-forcing.
 */

/**
 * Calculates the Hamming distance between two byte arrays.
 * This is the number of bits that differ between the two arrays.
 */
export function hammingDistance(buf1: Uint8Array, buf2: Uint8Array): number {
  let dist = 0;
  const len = Math.min(buf1.length, buf2.length);
  for (let i = 0; i < len; i++) {
    let xor = buf1[i] ^ buf2[i];
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * Estimates the likely key length for a repeating-key XOR cipher
 * using normalized Hamming distance between consecutive blocks.
 */
export function estimateXorKeyLength(text: string): { keySize: number; distance: number } | null {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length < 10) return null;

  let bestKeySize = 0;
  let bestDist = Infinity;
  const maxKeysize = Math.min(40, Math.floor(bytes.length / 2));
  
  for (let keysize = 2; keysize <= maxKeysize; keysize++) {
    let totalDist = 0;
    let blocks = 0;
    for (let i = 0; i + keysize * 2 <= bytes.length && blocks < 4; i += keysize) {
      const block1 = bytes.slice(i, i + keysize);
      const block2 = bytes.slice(i + keysize, i + keysize * 2);
      totalDist += hammingDistance(block1, block2) / keysize;
      blocks++;
    }
    if (blocks > 0) {
      const avgDist = totalDist / blocks;
      if (avgDist < bestDist) {
        bestDist = avgDist;
        bestKeySize = keysize;
      }
    }
  }

  if (bestKeySize > 0 && bestDist < 2.9) {
    return { keySize: bestKeySize, distance: bestDist };
  }
  return null;
}

/**
 * Computes Greatest Common Divisor
 */
export function gcd(a: number, b: number): number {
  return !b ? a : gcd(b, a % b);
}

/**
 * Given a transposition key, returns the order in which columns should be
 * read (each entry is the original 0-based column index), sorted by the
 * alphabetical rank of the key's letters (ties broken by original position).
 * Shared by all keyed columnar-transposition ciphers (Columnar, ADFGX, ADFGVX).
 */
export function keyToColumnOrder(key: string): number[] {
  const indexed = key.split("").map((ch, idx) => ({ ch: ch.toUpperCase(), idx }));
  indexed.sort((a, b) => (a.ch < b.ch ? -1 : a.ch > b.ch ? 1 : a.idx - b.idx));
  return indexed.map((item) => item.idx);
}

/**
 * Generic keyed columnar transposition (irregular, no padding): writes `text`
 * into a grid row-major with `key.length` columns, then reads the columns out
 * in the key's alphabetical order.
 */
export function columnarTransposeEncode(text: string, key: string): string {
  const cols = key.length;
  if (cols === 0 || !text) return text;
  const order = keyToColumnOrder(key);
  const grid: string[] = new Array(cols).fill("");
  for (let i = 0; i < text.length; i++) {
    grid[i % cols] += text[i];
  }
  return order.map((colIdx) => grid[colIdx]).join("");
}

/**
 * Inverse of columnarTransposeEncode. `originalLength` defaults to the
 * ciphertext length, which is correct whenever the cipher operates on a
 * fixed-length fractionated stream (ADFGX/ADFGVX); pass it explicitly if the
 * plaintext could contain characters stripped before encoding.
 */
export function columnarTransposeDecode(text: string, key: string, originalLength?: number): string {
  const cols = key.length;
  if (cols === 0 || !text) return text;
  const len = originalLength ?? text.length;
  const order = keyToColumnOrder(key);
  const rows = Math.ceil(len / cols);
  const numFullCols = len % cols === 0 ? cols : len % cols;
  const colLengths: number[] = [];
  for (let c = 0; c < cols; c++) {
    colLengths[c] = c < numFullCols ? rows : rows - 1;
  }
  const colTexts: string[] = new Array(cols);
  let pos = 0;
  for (const colIdx of order) {
    const colLen = colLengths[colIdx];
    colTexts[colIdx] = text.slice(pos, pos + colLen);
    pos += colLen;
  }
  let result = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (colTexts[c] && r < colTexts[c].length) {
        result += colTexts[c][r];
      }
    }
  }
  return result;
}

/**
 * Standard international Morse code table, shared by Morbit and Pollux
 * (both fractionate Morse symbols rather than emitting dots/dashes directly).
 */
export const MORSE_ALPHABET: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.",
  H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.",
  O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-",
  V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
};

export const MORSE_ALPHABET_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_ALPHABET).map(([k, v]) => [v, k])
);
