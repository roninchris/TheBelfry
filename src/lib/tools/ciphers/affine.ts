/** Affine cipher (E(x) = ax+b mod 26) — ported from cryptii's AffineCipher encoder */
function egcd(a: number, b: number): [number, number, number] {
  if (b === 0) return [a, 1, 0];
  const [g, x, y] = egcd(b, a % b);
  return [g, y, x - Math.floor(a / b) * y];
}

function modInverse(a: number, m: number): number | null {
  const [g, x] = egcd(((a % m) + m) % m, m);
  if (g !== 1) return null; // a and m must be coprime
  return ((x % m) + m) % m;
}

function transformChar(ch: string, fn: (x: number) => number): string {
  const code = ch.charCodeAt(0);
  let base: number | null = null;
  if (code >= 65 && code <= 90) base = 65;
  else if (code >= 97 && code <= 122) base = 97;
  if (base === null) return ch;
  return String.fromCharCode(base + fn(code - base));
}

export function affineEncode(text: string, options?: { a?: number; b?: number }): string {
  const a = options?.a ?? 5;
  const b = options?.b ?? 8;
  const m = 26;
  return text
    .split("")
    .map((ch) => transformChar(ch, (x) => (((a * x + b) % m) + m) % m))
    .join("");
}

export function affineDecode(text: string, options?: { a?: number; b?: number }): string {
  const a = options?.a ?? 5;
  const b = options?.b ?? 8;
  const m = 26;
  const aInv = modInverse(a, m);
  if (aInv === null) {
    // a and 26 aren't coprime — no valid decode exists for this key
    return text;
  }
  return text
    .split("")
    .map((ch) => transformChar(ch, (y) => (((aInv * (y - b)) % m) + m) % m))
    .join("");
}