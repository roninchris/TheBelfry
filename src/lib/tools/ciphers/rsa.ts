import type { ToolOptions } from "../types";

/**
 * RSA Encryption — textbook RSA (one modular exponentiation per byte, not a
 * real padded block cipher) for puzzle/teaching-sized keys. Defaults to the
 * classic p=61, q=53, e=17 example (n=3233), which is exactly large enough
 * to represent any single byte (0-255).
 */

function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === 0n) return [a, 1n, 0n];
  const [g, x1, y1] = egcd(b, a % b);
  return [g, y1, x1 - (a / b) * y1];
}

function modInverse(a: bigint, m: bigint): bigint {
  const [g, x] = egcd(((a % m) + m) % m, m);
  if (g !== 1n) {
    throw new Error("e has no modular inverse mod φ(n) — choose primes/exponent with gcd(e, φ(n)) = 1.");
  }
  return ((x % m) + m) % m;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
}

function parseBigInt(value: unknown, fallback: bigint): bigint {
  try {
    if (value === undefined || value === null || value === "") return fallback;
    return BigInt(String(value).trim());
  } catch {
    return fallback;
  }
}

export function rsaEncode(text: string, options?: ToolOptions): string {
  const p = parseBigInt(options?.p, 61n);
  const q = parseBigInt(options?.q, 53n);
  const e = parseBigInt(options?.e, 17n);
  const n = p * q;
  if (n < 256n) {
    throw new Error("Modulus n = p × q is too small to encode byte values (need n > 255). Choose larger primes.");
  }

  const bytes = new TextEncoder().encode(text);
  const blocks: string[] = [];
  for (const byte of bytes) {
    blocks.push(modPow(BigInt(byte), e, n).toString());
  }
  return blocks.join(" ");
}

export function rsaDecode(text: string, options?: ToolOptions): string {
  const p = parseBigInt(options?.p, 61n);
  const q = parseBigInt(options?.q, 53n);
  const e = parseBigInt(options?.e, 17n);
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  const providedD = parseBigInt(options?.d, 0n);
  const d = providedD > 0n ? providedD : modInverse(e, phi);

  const trimmed = text.trim();
  if (!trimmed) return "";
  const blocks = trimmed.split(/\s+/);
  const bytes: number[] = [];
  for (const block of blocks) {
    try {
      const c = BigInt(block);
      const m = modPow(c, d, n);
      bytes.push(Number(m));
    } catch {
      // skip malformed block rather than aborting the whole decode
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
