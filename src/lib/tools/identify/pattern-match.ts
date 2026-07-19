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
  if (base32Regex.test(trimmed.toUpperCase()) && !(englishLike && !/[2-7=]/.test(trimmed))) {
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
        confidence: 0.6,
        details: "Matches Base32 character set but invalid length"
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
    } else if (!englishLike) {
      results.push({
        pattern: "base85",
        confidence: 0.5,
        details: "Matches Ascii85 printable range (without delimiters)"
      });
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
