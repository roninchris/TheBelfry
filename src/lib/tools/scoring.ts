
/**
 * Plaintext heuristics scoring engine.
 */

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
 * Scores a candidate *decode output* purely on English-plaintext heuristics — no "still looks
 * encoded" shortcuts, since brute-force/pipeline candidates for letters-only ciphers (Rail Fence,
 * Atbash, Affine, substitution, columnar transposition, etc.) are themselves letters-only and would
 * otherwise all tie at the same inflated "still base64/hex/base58-shaped" score regardless of
 * whether the parameters used were actually correct.
 */
export function scoreDecodedPlaintext(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  if (isErrorText(text)) return 0;

  const clean = text.toUpperCase();
  const total = clean.length;
  
  // Count printable characters (alphanumeric, spaces, common punctuation)
  const printableMatches = clean.match(/[A-Z0-9\s.,!?'"\-()]/g);
  const printableCount = printableMatches ? printableMatches.length : 0;
  const printableRatio = printableCount / total;
  
  // Heavily penalize non-printable characters or gibberish symbols
  if (printableRatio < 0.8) {
    return Math.max(0, Math.round(printableRatio * 20));
  }
  
  let score = 0;
  
  // 1. Space frequency (English is typically 12% - 18% spaces)
  const spaceCount = (clean.match(/ /g) || []).length;
  const spaceRatio = spaceCount / total;
  if (spaceRatio >= 0.10 && spaceRatio <= 0.22) {
    score += 25;
  } else if (spaceRatio > 0.05 && spaceRatio < 0.30) {
    score += 12;
  }
  
  // 2. Letter frequency check (vowels density should be ~35-45% of alphabetic characters)
  const vowelMatches = clean.match(/[AEIOU]/g);
  const letterMatches = clean.match(/[A-Z]/g);
  const vowelCount = vowelMatches ? vowelMatches.length : 0;
  const letterCount = letterMatches ? letterMatches.length : 0;
  
  if (letterCount > 0) {
    const vowelRatio = vowelCount / letterCount;
    if (vowelRatio >= 0.30 && vowelRatio <= 0.48) {
      score += 25;
    } else if (vowelRatio >= 0.20 && vowelRatio <= 0.60) {
      score += 10;
    }
  }
  
  // 3. Common English words check (case-insensitive)
  const commonWords = [
    "THE", "AND", "THAT", "HAVE", "FOR", "NOT", "WITH", "YOU", "THIS", "BUT",
    "FROM", "TARGET", "ACCESS", "SAFE", "COORDINATES", "SECRET", "SECURED",
    "EAST", "WEST", "NORTH", "SOUTH", "MEET", "NINE", "SEVEN", "ZERO", "FOUR",
    "SIGNAL", "SECTOR", "PACKET", "CLOCK", "CODE", "CIPHER", "DECODE"
  ];
  
  let wordPoints = 0;
  for (const word of commonWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = clean.match(regex);
    if (matches) {
      wordPoints += matches.length * 15;
    } else if (clean.includes(word)) {
      wordPoints += 5; // Substring match
    }
  }
  
  score += Math.min(wordPoints, 50);
  
  return Math.min(Math.round(score), 100);
}
