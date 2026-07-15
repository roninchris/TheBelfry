function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function getSubmatrix(matrix: number[][], row: number, col: number): number[][] {
  return matrix
    .filter((_, r) => r !== row)
    .map((r) => r.filter((_, c) => c !== col));
}

function determinant(matrix: number[][]): number {
  const n = matrix.length;
  if (n === 1) return matrix[0][0];
  if (n === 2) {
    return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  }
  let det = 0;
  for (let c = 0; c < n; c++) {
    const sub = getSubmatrix(matrix, 0, c);
    const sign = c % 2 === 0 ? 1 : -1;
    det += sign * matrix[0][c] * determinant(sub);
  }
  return det;
}

function adjugate(matrix: number[][]): number[][] {
  const n = matrix.length;
  const adj: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  if (n === 1) {
    adj[0][0] = 1;
    return adj;
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const sub = getSubmatrix(matrix, r, c);
      const sign = (r + c) % 2 === 0 ? 1 : -1;
      adj[c][r] = sign * determinant(sub);
    }
  }
  return adj;
}

function modInverse26(a: number): number {
  const m = 26;
  a = ((a % m) + m) % m;
  for (let x = 1; x < m; x++) {
    if ((a * x) % m === 1) {
      return x;
    }
  }
  return -1;
}

function invertMatrix26(matrix: number[][]): number[][] {
  const det = determinant(matrix);
  const detMod = ((det % 26) + 26) % 26;
  if (gcd(detMod, 26) !== 1) {
    throw new Error("Matrix has no inverse mod 26 — choose different key values");
  }
  const detInv = modInverse26(detMod);
  const adj = adjugate(matrix);
  const n = matrix.length;
  const inv: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      inv[r][c] = (((adj[r][c] * detInv) % 26) + 26) % 26;
    }
  }
  return inv;
}

interface AlphabeticChar {
  char: string;
  isUpper: boolean;
  originalIndex?: number;
}

const DEFAULT_MATRIX = [
  [5, 17],
  [8, 3],
];

export function hillEncode(text: string, options?: { matrix?: number[][] }): string {
  const matrix = options?.matrix ?? DEFAULT_MATRIX;
  const m = matrix.length;
  if (m === 0) return text;

  // Validate matrix determinant is coprime to 26
  const det = determinant(matrix);
  const detMod = ((det % 26) + 26) % 26;
  if (gcd(detMod, 26) !== 1) {
    throw new Error("Matrix has no inverse mod 26 — choose different key values");
  }

  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // 1. Extract alphabetic characters
  const originalChars: AlphabeticChar[] = [];
  const textChars = text.split("");

  textChars.forEach((char, index) => {
    const upper = char.toUpperCase();
    if (alpha.includes(upper)) {
      originalChars.push({
        char: upper,
        isUpper: char === upper,
        originalIndex: index,
      });
    }
  });

  // 2. Pad with 'X' to multiple of m
  const processedChars = [...originalChars];
  while (processedChars.length % m !== 0) {
    processedChars.push({
      char: "X",
      isUpper: true,
      originalIndex: undefined,
    });
  }

  // 3. Encode in blocks of size m
  const encodedChars: AlphabeticChar[] = [];
  for (let i = 0; i < processedChars.length; i += m) {
    const block = processedChars.slice(i, i + m);
    const vector = block.map((c) => alpha.indexOf(c.char));

    const resultVector = Array(m).fill(0);
    for (let r = 0; r < m; r++) {
      let sum = 0;
      for (let c = 0; c < m; c++) {
        sum += matrix[r][c] * vector[c];
      }
      resultVector[r] = ((sum % 26) + 26) % 26;
    }

    for (let r = 0; r < m; r++) {
      encodedChars.push({
        char: alpha[resultVector[r]],
        isUpper: block[r].isUpper,
        originalIndex: block[r].originalIndex,
      });
    }
  }

  // 4. Reconstruct output
  let output = "";
  let encodedIndex = 0;

  for (let idx = 0; idx < text.length; idx++) {
    const char = text[idx];
    const upper = char.toUpperCase();

    if (alpha.includes(upper)) {
      while (
        encodedIndex < encodedChars.length &&
        encodedChars[encodedIndex].originalIndex === undefined
      ) {
        const fill = encodedChars[encodedIndex];
        output += fill.isUpper ? fill.char : fill.char.toLowerCase();
        encodedIndex++;
      }

      if (encodedIndex < encodedChars.length) {
        const enc = encodedChars[encodedIndex];
        output += enc.isUpper ? enc.char : enc.char.toLowerCase();
        encodedIndex++;
      }
    } else {
      output += char;
    }
  }

  // Trailing padding chars
  while (encodedIndex < encodedChars.length) {
    const fill = encodedChars[encodedIndex];
    output += fill.isUpper ? fill.char : fill.char.toLowerCase();
    encodedIndex++;
  }

  return output;
}

export function hillDecode(text: string, options?: { matrix?: number[][] }): string {
  const matrix = options?.matrix ?? DEFAULT_MATRIX;
  const m = matrix.length;
  if (m === 0) return text;

  // Invert the matrix. Throws clear error if not coprime with 26.
  const invMatrix = invertMatrix26(matrix);

  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // 1. Extract alphabetic characters
  const originalChars: AlphabeticChar[] = [];
  const textChars = text.split("");

  textChars.forEach((char, index) => {
    const upper = char.toUpperCase();
    if (alpha.includes(upper)) {
      originalChars.push({
        char: upper,
        isUpper: char === upper,
        originalIndex: index,
      });
    }
  });

  // 2. Decode in blocks of size m
  // For decoding a valid ciphertext, it should ideally already be a multiple of m, but handle odd text gracefully
  const processedChars = [...originalChars];
  while (processedChars.length % m !== 0) {
    processedChars.push({
      char: "X",
      isUpper: true,
      originalIndex: undefined,
    });
  }

  const decodedChars: AlphabeticChar[] = [];
  for (let i = 0; i < processedChars.length; i += m) {
    const block = processedChars.slice(i, i + m);
    const vector = block.map((c) => alpha.indexOf(c.char));

    const resultVector = Array(m).fill(0);
    for (let r = 0; r < m; r++) {
      let sum = 0;
      for (let c = 0; c < m; c++) {
        sum += invMatrix[r][c] * vector[c];
      }
      resultVector[r] = ((sum % 26) + 26) % 26;
    }

    for (let r = 0; r < m; r++) {
      decodedChars.push({
        char: alpha[resultVector[r]],
        isUpper: block[r].isUpper,
        originalIndex: block[r].originalIndex,
      });
    }
  }

  // 3. Reconstruct output
  let output = "";
  let decodedIndex = 0;

  for (let idx = 0; idx < text.length; idx++) {
    const char = text[idx];
    const upper = char.toUpperCase();

    if (alpha.includes(upper)) {
      if (decodedIndex < decodedChars.length) {
        const dec = decodedChars[decodedIndex];
        output += dec.isUpper ? dec.char : dec.char.toLowerCase();
        decodedIndex++;
      }
    } else {
      output += char;
    }
  }

  return output;
}
