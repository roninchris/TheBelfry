/** RSA Factorizer - trial division BigInt factoring for puzzle-sized moduli */

import type { ToolOptions, TransformOutput } from "../types";

/**
 * Computes the integer square root of a BigInt using Newton's method.
 */
export function bigintSqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error("Square root of negative number is not supported.");
  }
  if (value < 2n) {
    return value;
  }
  let x0 = value / 2n;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

/**
 * Factors a BigInt n using trial division up to sqrt(n).
 * Clearly documented: only for puzzle-sized N, not real-world RSA keys.
 * A limit of 500,000 loop iterations is enforced to prevent browser freeze.
 */
export function factorize(n: bigint): { p: bigint; q: bigint } | null {
  if (n <= 1n) return null;
  if (n % 2n === 0n) {
    return { p: 2n, q: n / 2n };
  }

  const limit = bigintSqrt(n);
  let divisor = 3n;
  let iterations = 0;
  const maxIterations = 500000; // Safe threshold for browser execution

  while (divisor <= limit) {
    iterations++;
    if (iterations > maxIterations) {
      throw new Error(
        `Factorization exceeded iteration limit (${maxIterations}). This browser-based trial division is only intended for small puzzle-sized moduli (up to ~30-40 decimal digits).`
      );
    }

    if (n % divisor === 0n) {
      return { p: divisor, q: n / divisor };
    }
    divisor += 2n;
  }

  return null;
}

export function rsaFactorizeEncode(text: string, options?: ToolOptions): TransformOutput {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Enter a number N to factorize.";
  }

  try {
    let n: bigint;
    if (trimmed.toLowerCase().startsWith("0x")) {
      n = BigInt(trimmed);
    } else {
      // Remove any non-digit character (like commas or spaces)
      const sanitized = trimmed.replace(/,/g, "");
      n = BigInt(sanitized);
    }

    const result = factorize(n);
    if (result) {
      return `p = ${result.p.toString()}\nq = ${result.q.toString()}`;
    } else {
      return `No factors found up to sqrt(N). N may be prime or too large for trial division.`;
    }
  } catch (err: any) {
    return `ERROR: ${err.message || "Invalid BigInt format"}`;
  }
}

export function rsaFactorizeDecode(text: string, options?: ToolOptions): TransformOutput {
  // Decoding RSA can multiply p and q if provided in "p=... q=..." or comma separated formats.
  const trimmed = text.trim();
  if (!trimmed) return "Enter p and q (separated by space or comma) to compute N.";

  try {
    const parts = trimmed.split(/[\s,pq=]+/i).filter(Boolean);
    if (parts.length >= 2) {
      const p = BigInt(parts[0]);
      const q = BigInt(parts[1]);
      const n = p * q;
      return `N = ${n.toString()}\n(Hex: 0x${n.toString(16)})`;
    }
    throw new Error("Could not parse two prime factors p and q.");
  } catch (err: any) {
    return `ERROR: ${err.message || "Could not multiply factors"}`;
  }
}
