import type { ToolOptions } from "../types";

/**
 * Cicada 3301 Totient Cipher — an additive stream cipher in the spirit of
 * the puzzles' totient-based constructions: the keystream is φ(p) mod 26
 * for the running sequence of primes p starting at `seed`, added to each
 * plaintext letter's position (mod 26). Fully deterministic and reversible
 * given the same seed.
 */

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function totient(n: number): number {
  let result = n;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      while (m % p === 0) m /= p;
      result -= result / p;
    }
  }
  if (m > 1) result -= result / m;
  return result;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false;
  }
  return true;
}

function totientKeystream(length: number, seed: number): number[] {
  const stream: number[] = [];
  let candidate = Math.max(2, Math.floor(seed) || 2);
  while (stream.length < length) {
    if (isPrime(candidate)) {
      stream.push(totient(candidate) % 26);
    }
    candidate++;
  }
  return stream;
}

export function cicadaEncode(text: string, options?: ToolOptions): string {
  const seed = (options?.seed as number) ?? 2;
  const letterCount = text.replace(/[^A-Za-z]/g, "").length;
  if (letterCount === 0) return text;
  const stream = totientKeystream(letterCount, seed);
  let idx = 0;
  return text
    .split("")
    .map((ch) => {
      const upper = ch.toUpperCase();
      const p = ALPHA.indexOf(upper);
      if (p < 0) return ch;
      const k = stream[idx++];
      const c = ALPHA[(p + k) % 26];
      return ch === upper ? c : c.toLowerCase();
    })
    .join("");
}

export function cicadaDecode(text: string, options?: ToolOptions): string {
  const seed = (options?.seed as number) ?? 2;
  const letterCount = text.replace(/[^A-Za-z]/g, "").length;
  if (letterCount === 0) return text;
  const stream = totientKeystream(letterCount, seed);
  let idx = 0;
  return text
    .split("")
    .map((ch) => {
      const upper = ch.toUpperCase();
      const c = ALPHA.indexOf(upper);
      if (c < 0) return ch;
      const k = stream[idx++];
      const p = ALPHA[(c - k + 26) % 26];
      return ch === upper ? p : p.toLowerCase();
    })
    .join("");
}
