
/**
 * Plaintext heuristics scoring engine.
 */
import { assessPlaintext } from "./languages";

/** Any decode/chain failure marker used across tool implementations — always worth zero. */
function isErrorText(text: string): boolean {
  return text.startsWith("[CHAIN ERROR]") || text.startsWith("[ERROR]") || text.startsWith("ERROR:");
}

/**
 * Scores raw input on whether it still looks like an *encoded* format (base64/hex/base58/morse/etc).
 * Used only to identify what a piece of input currently is (see `identify/*`) — never appropriate
 * for scoring a candidate *decode output*, since real plaintext can incidentally satisfy these shapes.
 */
export function scoreEncodedLikelihood(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  if (isErrorText(text)) return 0;

  const trimmed = text.trim();

  // 1. Base64 pattern (length % 4 === 0, chars in [A-Za-z0-9+/=]) -> 95
  if (trimmed.length > 0 && trimmed.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return 95;
  }

  // 2. Pure hex (even-length [0-9A-Fa-f], optional spaces/0x) -> 90
  const hexClean = trimmed.replace(/\s+/g, '').replace(/^0x/i, '');
  if (hexClean.length > 0 && hexClean.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(hexClean)) {
    return 90;
  }

  // 3. Base58 pattern (Bitcoin alphabet only, no 0/O/I/l) -> 94
  if (trimmed.length > 0 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) {
    return 94;
  }

  // 4. Morse pattern (only ./- /space) -> 85
  if (trimmed.length > 0 && /^[.\-\s]+$/.test(trimmed)) {
    return 85;
  }

  // 5. Space-separated sequence of numbers all present in the Gematria Primus prime set (2,3,5,7,11,...,89) -> 88
  const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89]);
  const parts = trimmed.split(/\s+/);
  if (trimmed.length > 0 && parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && p === n.toString() && primes.has(n);
  })) {
    return 88;
  }

  return scoreDecodedPlaintext(text);
}

/**
 * Scores a candidate *decode output* on natural-language plaintext heuristics — no "still looks
 * encoded" shortcuts, since brute-force/pipeline candidates for letters-only ciphers (Rail Fence,
 * Atbash, Affine, substitution, columnar transposition, etc.) are themselves letters-only and would
 * otherwise all tie at the same inflated "still base64/hex/base58-shaped" score regardless of
 * whether the parameters used were actually correct.
 *
 * Now delegates to the multilingual assessor (English / Portuguese / Latin) and returns its best
 * score, so a correct decode in any of those three languages ranks above the noise instead of only
 * English doing so. See {@link assessPlaintext} for the language breakdown.
 */
export function scoreDecodedPlaintext(text: string): number {
  return assessPlaintext(text).score;
}
