/**
 * Forensic identification orchestrator.
 * Runs all detectors on input and returns ranked results.
 */
import { GEMATRIA_TABLE } from "../ciphers/gematria";
import { calculateIC } from "./index-of-coincidence";

/**
 * Regex classifiers for common encoding patterns.
 * Returns which pattern(s) match with confidence scores.
 */
export interface PatternMatch {
  pattern: string;
  confidence: number; // 0-1
  details: string;
}

// A handful of very common English fragments used to catch plain words/sentences
// that happen to satisfy a base64/hex character set (e.g. "HelloWorld", "cafebabe").
const COMMON_ENGLISH_FRAGMENTS = [
  "THE", "AND", "ING", "TION", "THAT", "THIS", "WITH", "FROM", "HAVE", "WERE",
  "YOU", "ARE", "FOR", "NOT", "BUT", "ALL", "CAN", "HER", "WAS", "ONE"
];

/**
 * Heuristic check for "this is actually English text", used to suppress
 * false-positive encoding matches (e.g. a plain word that happens to only
 * contain base64 or hex-safe characters).
 */
function looksLikeEnglishPlaintext(trimmed: string): boolean {
  const alpha = trimmed.toUpperCase().replace(/[^A-Z]/g, "");
  if (alpha.length < 6) return false;

  const upper = trimmed.toUpperCase();
  const hasCommonFragment = COMMON_ENGLISH_FRAGMENTS.some(f => upper.includes(f));

  // English text (even without spaces) tends to sit near the English IC (~0.0667),
  // while real base64/hex output is close to random (~0.038-0.045).
  const ic = calculateIC(trimmed);
  const icLooksEnglish = ic.ic >= 0.055;

  return hasCommonFragment || icLooksEnglish;
}

/**
 * Attempt to decode a candidate base64 string and report whether the result
 * looks like meaningful data (mostly printable bytes) vs. garbage. Used to
 * separate real base64 payloads from strings that merely satisfy the charset.
 */
function tryBase64Decode(trimmed: string): { valid: boolean; printableRatio: number } {
  try {
    const mod = trimmed.length % 4;
    if (mod === 1) return { valid: false, printableRatio: 0 };
    const padded = mod === 0 ? trimmed : trimmed + "=".repeat(4 - mod);
    const decoded = atob(padded);
    if (decoded.length === 0) return { valid: false, printableRatio: 0 };
    let printable = 0;
    for (let i = 0; i < decoded.length; i++) {
      const code = decoded.charCodeAt(i);
      if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) printable++;
    }
    return { valid: true, printableRatio: printable / decoded.length };
  } catch {
    return { valid: false, printableRatio: 0 };
  }
}

export function detectPatterns(text: string): PatternMatch[] {
  const results: PatternMatch[] = [];
  const trimmed = text.trim();

  if (!trimmed) {
    return results;
  }

  const englishLike = looksLikeEnglishPlaintext(trimmed);

  // Base64: A-Z, a-z, 0-9, +, /, and optional padding with =
  // Should have length multiple of 4 (with padding)
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  const base64WithPadding = /^[A-Za-z0-9+/]+={1,2}$/;
  const base64LengthValid = trimmed.length % 4 === 0;

  if (trimmed.length >= 4 && base64Regex.test(trimmed)) {
    // Strings that only use letters (no digits, no +, /, or = padding) are the
    // most likely to actually be plain English words, so they need the
    // strongest evidence before we call them base64.
    const hasNonAlphaBase64Signal = /[0-9+/=]/.test(trimmed);
    const decodeCheck = tryBase64Decode(trimmed);

    if (englishLike && !hasNonAlphaBase64Signal) {
      // Very likely just an English word/phrase with no spaces - don't report it.
    } else {
      let confidence = 0.35;
      let details = "Matches Base64 character set";

      if (base64WithPadding.test(trimmed) && base64LengthValid) {
        confidence = 0.75;
        details = "Valid Base64 with correct padding";
      } else if (base64LengthValid) {
        confidence = 0.55;
        details = "Valid Base64 (no padding)";
      }

      if (decodeCheck.valid && decodeCheck.printableRatio > 0.85) {
        confidence = Math.max(confidence, 0.9);
        details = "Decodes cleanly to readable text - high-confidence Base64";
      } else if (decodeCheck.valid && trimmed.length >= 8) {
        confidence = Math.max(confidence, 0.6);
      }

      /**
       * The English-plaintext guard exists to stop a bare word like
       * "HelloWorld" being called Base64. But it keyed off index of
       * coincidence, and IC is noisy on short strings — a genuine payload like
       * "SGVsbG8gd29ybGQgdGhpcyBpcyBhIHRlc3Q=" scores 0.073, above the English
       * threshold, so it was demoted to 0.25 even though it decodes cleanly to
       * "Hello world this is a test".
       *
       * Actually decoding is far stronger evidence than a letter-distribution
       * guess, so a clean decode to mostly-printable text now wins outright.
       */
      const decodesConvincingly = decodeCheck.valid && decodeCheck.printableRatio > 0.85;

      if (englishLike && !decodesConvincingly) {
        confidence = Math.min(confidence, 0.25);
        details = "Matches Base64 charset, but input resembles English text - low confidence";
      }

      if (confidence >= 0.2) {
        results.push({ pattern: "base64", confidence, details });
      }
    }
  }

  // Base32: RFC4648 alphabet [A-Z2-7], padded with '=', length % 8 === 0
  const base32Regex = /^[A-Z2-7]+={0,6}$/;
  /**
   * The length floor matters as much as the alphabet. Base32's alphabet is
   * A-Z plus 2-7, so *any* short uppercase word satisfies it — "HELLO" was
   * being reported as Base32 at 0.6 and, being the highest scorer, was promoted
   * to the recommended match while its own details read "invalid length". The
   * English guard did not save it either, since that helper ignores anything
   * under six letters. Below a real Base32 block length there is no signal
   * here, and a charset-only match is now scored below the recommendation floor
   * rather than above it.
   */
  if (
    base32Regex.test(trimmed.toUpperCase()) &&
    trimmed.length >= 8 &&
    !(englishLike && !/[2-7=]/.test(trimmed))
  ) {
    const isMultipleOf8 = trimmed.length % 8 === 0;
    if (isMultipleOf8) {
      results.push({
        pattern: "base32",
        confidence: 0.9,
        details: "Valid Base32 (multiple of 8 length with valid alphabet)"
      });
    } else {
      results.push({
        pattern: "base32",
        confidence: 0.25,
        details: "Matches Base32 character set but length is not a multiple of 8"
      });
    }
  }

  // Base58: Bitcoin alphabet, no 0/O/I/l characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (base58Regex.test(trimmed) && trimmed.length >= 6 && !(englishLike && !/[0-9]/.test(trimmed))) {
    results.push({
      pattern: "base58",
      confidence: englishLike ? 0.4 : 0.8,
      details: "Matches Base58 (Bitcoin) alphabet"
    });
  }

  // Base85: presence of <~ ~> delimiters or the Ascii85 printable range pattern
  const base85Regex = /(?:^<~[\s\S]*~>$|^[!-uz]+$)/;
  if (base85Regex.test(trimmed.replace(/\s/g, ''))) {
    const hasDelimiters = trimmed.startsWith('<~') && trimmed.endsWith('~>');
    if (hasDelimiters) {
      results.push({
        pattern: "base85",
        confidence: 0.95,
        details: "Valid Ascii85 with delimiters"
      });
    } else {
      /**
       * Without delimiters the Ascii85 "range" is almost the whole printable
       * set, so this branch fired on essentially every input — plain sentences
       * and other ciphers alike — and added a permanent 0.5 row to every
       * result list. Real Ascii85 output is dense in punctuation, so require
       * that density (and enough length to measure it) instead of just the
       * character range.
       */
      const compact = trimmed.replace(/\s/g, "");
      // '=' is Base32/Base64 padding, not Ascii85 punctuation — counting it made
      // every padded Base32 block look symbol-dense enough to also be Ascii85.
      const symbolCount = (compact.match(/[^A-Za-z0-9=]/g) || []).length;
      const symbolRatio = compact.length > 0 ? symbolCount / compact.length : 0;

      if (!englishLike && compact.length >= 16 && symbolRatio >= 0.15) {
        results.push({
          pattern: "base85",
          confidence: 0.5,
          details: "Matches Ascii85 printable range with punctuation density typical of Ascii85"
        });
      }
    }
  }

  // Braille: any Unicode Braille block characters (U+2800–U+28FF) present
  const brailleRegex = /[\u2800-\u28FF]/;
  if (brailleRegex.test(trimmed)) {
    results.push({
      pattern: "braille",
      confidence: 0.99,
      details: "Braille unicode characters detected"
    });
  }

  /**
   * Runic script (U+16A0-U+16FF). Neither Gematria Primus nor the Elder Futhark
   * cipher was detected at all before this — runes are unmistakable as a script,
   * so the only real question is which alphabet is in play. The two tables
   * overlap, but each has exclusive runes, so membership decides it. When a
   * sample uses only shared runes both are reported, since picking one would be
   * arbitrary.
   */
  const runeChars = trimmed.match(/[ᚠ-᛿]/g) || [];
  if (runeChars.length >= 2) {
    const ELDER_ONLY = new Set(["ᚨ", "ᚲ", "ᚺ", "ᛃ", "ᛊ"]); // a, k, h, j, s
    const FUTHORC_ONLY = new Set(["ᚩ", "ᚳ", "ᚻ", "ᛡ", "ᛟ"]); // os, cen, haegl, ior, oethel

    const hasElder = runeChars.some(c => ELDER_ONLY.has(c));
    const hasFuthorc = runeChars.some(c => FUTHORC_ONLY.has(c));

    // Density guards against a stray rune glyph sitting inside ordinary text.
    const density = runeChars.length / Math.max(1, trimmed.replace(/\s/g, "").length);
    const base = density > 0.5 ? 0.95 : 0.7;

    if (hasFuthorc && !hasElder) {
      results.push({
        pattern: "gematria",
        confidence: base,
        details: "Anglo-Saxon futhorc runes (Gematria Primus alphabet)"
      });
    } else if (hasElder && !hasFuthorc) {
      results.push({
        pattern: "runic",
        confidence: base,
        details: "Elder Futhark runes"
      });
    } else {
      results.push({
        pattern: "runic",
        confidence: base - 0.1,
        details: "Runic script; alphabet ambiguous between Elder Futhark and futhorc"
      });
      results.push({
        pattern: "gematria",
        confidence: base - 0.12,
        details: "Runic script; alphabet ambiguous between futhorc and Elder Futhark"
      });
    }
  }

  /**
   * Gematria Primus prime sequence: space-separated values drawn only from the
   * 24 primes in the table, with '-' as the word gap. Requiring *every* numeric
   * token to be a member is what separates this from an arbitrary number list,
   * which will almost immediately contain a non-member.
   */
  const GEMATRIA_PRIMES = new Set([
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37,
    41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89
  ]);
  const allTokens = trimmed.split(/\s+/).filter(Boolean);
  const numericTokens = allTokens.filter(t => /^\d+$/.test(t));
  if (numericTokens.length >= 4 && numericTokens.length / allTokens.length >= 0.5) {
    if (numericTokens.every(t => GEMATRIA_PRIMES.has(parseInt(t, 10)))) {
      results.push({
        pattern: "gematria",
        confidence: 0.9,
        details: `All ${numericTokens.length} numeric tokens are Gematria Primus primes`
      });
    }
  }

  /**
   * Gematria Primus Latin transliteration: space-separated table tokens with
   * '-' for word gaps. Single letters alone are indistinguishable from ordinary
   * spaced-out text, so a multi-letter token (TH, EO, OE, ING) is required as
   * the actual signature — those are the runes that have no single-letter
   * spelling, and nothing else in the app emits them this way.
   */
  const LATIN_TOKENS = new Set([
    "F", "U", "TH", "O", "R", "C", "G", "W", "H", "N", "I", "J",
    "EO", "P", "X", "S", "T", "B", "E", "M", "L", "ING", "OE", "D"
  ]);
  const gemTokens = trimmed.toUpperCase().split(/\s+/).filter(Boolean);
  if (gemTokens.length >= 6) {
    const meaningful = gemTokens.filter(t => t !== "-");
    // A majority, not all: the table has no rune for A (and a few others), so
    // the encoder passes those letters through untouched. Demanding every token
    // be a table member meant real output never matched.
    const knownCount = meaningful.filter(t => LATIN_TOKENS.has(t)).length;
    const knownRatio = meaningful.length > 0 ? knownCount / meaningful.length : 0;
    const allShort = meaningful.every(t => /^[A-Z]{1,3}$/.test(t));
    const hasMultiChar = meaningful.some(t => t.length > 1 && LATIN_TOKENS.has(t));

    if (allShort && hasMultiChar && knownRatio >= 0.7) {
      results.push({
        pattern: "gematria",
        confidence: 0.8,
        details: "Space-separated Gematria Primus Latin tokens, including multi-letter rune names"
      });
    }
  }

  /**
   * ===== Structural cipher signatures =====
   * These ciphers emit shapes nothing else in the app produces, so they can be
   * recognised outright rather than inferred from letter statistics. A survey of
   * all 52 cipher tools found only five were being identified at all; most of
   * the misses were shapes as distinctive as these.
   */

  // Bacon: only two distinct letters, in groups of five.
  const baconGroups = trimmed.toUpperCase().split(/\s+/).filter(Boolean);
  if (baconGroups.length >= 3 && baconGroups.every(g => /^[AB]{5}$/.test(g))) {
    results.push({
      pattern: "bacon",
      confidence: 0.96,
      details: "Groups of five drawn from a two-letter alphabet (A/B)"
    });
  }

  // Dancing Men: bracketed figure codes. The flag letter is M or F (the figure
  // holds a flag to mark a word break), not M alone.
  const dancingCodes = trimmed.match(/\[[MF]\d{2}\]/g) || [];
  if (dancingCodes.length >= 3 && /^(\[[MF]\d{2}\]|\s)+$/.test(trimmed)) {
    results.push({
      pattern: "dancingmen",
      confidence: 0.97,
      details: "Bracketed dancing-men figure codes"
    });
  }

  // Pigpen: grid-position tokens such as 1-UL, 3-L, 2-UC, 1-ML. The position
  // part spans upper/middle/lower and left/centre/right, so it is not limited
  // to the four compass letters.
  const pigpenTokens = trimmed.toUpperCase().split(/\s+/).filter(Boolean);
  if (
    pigpenTokens.length >= 3 &&
    pigpenTokens.filter(t => /^[1-4]-[UMLDCR]{1,2}$/.test(t)).length / pigpenTokens.length >= 0.8
  ) {
    results.push({
      pattern: "pigpen",
      confidence: 0.95,
      details: "Pigpen grid-position tokens (quadrant plus cell position)"
    });
  }

  /**
   * Numeric ciphers, separated by the digit range they can produce:
   *  - Polybius coordinates use only digits 1-5 in pairs.
   *  - Nihilist adds a key to those coordinates, so values run past 55 but stay
   *    two-digit.
   *  - Homophonic substitution uses the full 00-99 space.
   * The ranges overlap, so more than one may be reported; the ordering below
   * reflects how specific each claim is.
   */
  const numTokens = trimmed.split(/[\s/,-]+/).filter(Boolean);
  const twoDigit = numTokens.filter(t => /^\d{2}$/.test(t));
  if (numTokens.length >= 4 && twoDigit.length / numTokens.length >= 0.85) {
    const values = twoDigit.map(t => parseInt(t, 10));
    const allPolybius = twoDigit.every(t => /^[1-5][1-5]$/.test(t));
    const maxVal = Math.max(...values);

    if (allPolybius) {
      results.push({
        pattern: "polybius",
        confidence: 0.9,
        details: "Two-digit pairs using only digits 1-5 (Polybius square coordinates)"
      });
    } else if (maxVal <= 99) {
      results.push({
        pattern: "nihilist",
        confidence: 0.6,
        details: "Two-digit number series consistent with Nihilist additive coordinates"
      });
      results.push({
        pattern: "homophonic",
        confidence: 0.5,
        details: "Two-digit number series consistent with homophonic substitution"
      });
    }
  }

  // ROT47 operates over printable ASCII, so its output is unusually rich in
  // punctuation compared with any letter-based cipher.
  const rot47Body = trimmed.replace(/\s/g, "");
  // Bracketed or dash-delimited token grammars (dancing men, pigpen) are also
  // punctuation-rich; they have their own detectors and should not be offered a
  // competing ROT47 reading.
  const looksTokenised = /\[[A-Z]\d{2}\]/.test(trimmed) || /\b[1-4]-[A-Z]{1,2}\b/i.test(trimmed);
  if (!looksTokenised && rot47Body.length >= 12 && /^[!-~]+$/.test(rot47Body)) {
    const symbols = (rot47Body.match(/[!-\/:-@\[-`{-~]/g) || []).length;
    const ratio = symbols / rot47Body.length;
    if (ratio >= 0.25 && ratio < 0.9) {
      results.push({
        pattern: "rot47",
        confidence: 0.55,
        details: "Dense printable-ASCII punctuation mix typical of ROT47"
      });
    }
  }

  // Hex: Even-length string of 0-9, A-F, a-f
  const hexRegex = /^[0-9A-Fa-f]+$/;
  const hexEvenLength = trimmed.length % 2 === 0;

  if (trimmed.length >= 4 && hexRegex.test(trimmed)) {
    // A pure a-f word (e.g. "cafe", "dead", "face") is indistinguishable from
    // hex by charset alone, so require either digits present or a longer run.
    const hasDigit = /[0-9]/.test(trimmed);
    if (englishLike && !hasDigit) {
      // Skip - almost certainly a plain word.
    } else {
      let confidence = hexEvenLength ? 0.7 : 0.4;
      const details = hexEvenLength
        ? "Valid hexadecimal (even-length)"
        : "Hexadecimal characters but odd length";

      if (englishLike) confidence = Math.min(confidence, 0.25);
      if (hasDigit && hexEvenLength && trimmed.length >= 8) confidence = Math.max(confidence, 0.85);

      results.push({ pattern: "hex", confidence, details });
    }
  }

  // Binary: Only 0s and 1s, possibly with whitespace
  const binaryOnlyRegex = /^[01]+$/;
  const binaryWithSpacesRegex = /^[01\s]+$/;
  
  if (binaryOnlyRegex.test(trimmed)) {
    results.push({ 
      pattern: "binary", 
      confidence: 0.95, 
      details: "Pure binary (0s and 1s only)" 
    });
  } else if (binaryWithSpacesRegex.test(trimmed)) {
    results.push({ 
      pattern: "binary", 
      confidence: 0.8, 
      details: "Binary with whitespace separators" 
    });
  }

  // Morse: dots, dashes, slashes, spaces
  const morseRegex = /^[\.\-\/\s]+$/;
  
  if (morseRegex.test(trimmed)) {
    // Check if it looks like actual Morse (has dots/dashes, not just spaces)
    const hasSignals = /[.\-]/.test(trimmed);
    if (hasSignals) {
      results.push({ 
        pattern: "morse", 
        confidence: 0.9, 
        details: "Morse code pattern detected" 
      });
    }
  }

  // URL-encoded: % followed by exactly 2 hex digits
  const urlEncodedRegex = /%[0-9A-Fa-f]{2}/;
  const urlEncodedCount = (trimmed.match(/%[0-9A-Fa-f]{2}/g) || []).length;
  
  if (urlEncodedCount > 0) {
    // Calculate confidence based on percentage of encoded characters
    const totalChars = trimmed.length;
    const encodedRatio = urlEncodedCount * 3 / totalChars; // Each %XX is 3 chars
    
    let confidence = 0.6;
    if (encodedRatio > 0.3) {
      confidence = 0.95;
    } else if (encodedRatio > 0.1) {
      confidence = 0.8;
    }
    
    results.push({ 
      pattern: "url", 
      confidence, 
      details: `URL-encoded (${urlEncodedCount} encoded sequences)` 
    });
  }

  // Gematria Primus: space-separated sequence where every token is in the prime set 
  const gematriaPrimes = new Set(GEMATRIA_TABLE.map(entry => entry.prime.toString()));
  const spaceTokens = trimmed.trim().split(/\s+/);
  const isGematria = spaceTokens.length > 0 && spaceTokens.every(t => gematriaPrimes.has(t) || t === '-');
  if (isGematria && spaceTokens.some(t => gematriaPrimes.has(t))) {
    results.push({
      pattern: "gematria",
      confidence: 0.95,
      details: "Gematria Primus prime sequence detected"
    });
  }

  // A1Z26: space/dash-separated sequence of numbers 1-26 only
  const a1z26Tokens = trimmed.trim().split(/[\s\-]+/);
  const isA1Z26 = a1z26Tokens.length > 0 && a1z26Tokens.every(t => {
    const num = parseInt(t, 10);
    return !isNaN(num) && num >= 1 && num <= 26 && num.toString() === t;
  });
  if (isA1Z26) {
    results.push({
      pattern: "a1z26",
      confidence: 0.9,
      details: "A1Z26 numeric sequence detected (1-26)"
    });
  }

  // Polybius: space-separated sequence of two-digit number pairs where each digit is 1-5
  const polybiusRegex = /^[1-5]{2}$/;
  const isPolybius = spaceTokens.length > 0 && spaceTokens.every(t => polybiusRegex.test(t));
  if (isPolybius) {
    results.push({
      pattern: "polybius",
      confidence: 0.9,
      details: "Polybius square sequence detected (pairs of 1-5)"
    });
  }

  return results;
}
