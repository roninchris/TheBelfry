/**
 * Family detection helper for forensic cipher identification.
 * Specifically handles transposition-family fingerprints, Base-N encodings,
 * and other Phase 2 / Prompt 3.1 encoding patterns.
 */
import { calculateIC } from "./index-of-coincidence";
import { IdentificationResult } from "./index";

// Standard English letter frequencies for preserved frequency comparison
const ENGLISH_FREQUENCIES: Record<string, number> = {
  A: 8.167, B: 1.492, C: 2.782, D: 4.253, E: 12.702, F: 2.228,
  G: 2.015, H: 6.094, I: 6.966, J: 0.153, K: 0.772, L: 4.025,
  M: 2.406, N: 6.749, O: 7.507, P: 1.929, Q: 0.095, R: 5.987,
  S: 6.327, T: 9.056, U: 2.758, V: 0.978, W: 2.360, X: 0.150,
  Y: 1.974, Z: 0.074
};

function calculateUnshiftedChiSquared(text: string): number {
  const clean = text.toUpperCase().replace(/[^A-Z]/g, "");
  if (clean.length === 0) return Infinity;

  const len = clean.length;
  const counts: Record<string, number> = {};
  for (let i = 65; i <= 90; i++) {
    counts[String.fromCharCode(i)] = 0;
  }
  for (const char of clean) {
    counts[char]++;
  }

  let chiSquared = 0;
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const observed = counts[letter];
    const expected = (ENGLISH_FREQUENCIES[letter] / 100) * len;
    if (expected > 0) {
      chiSquared += Math.pow(observed - expected, 2) / expected;
    }
  }
  return chiSquared;
}

export function detectFamilyCiphers(text: string): IdentificationResult[] {
  const results: IdentificationResult[] = [];
  const trimmed = text.trim();
  if (!trimmed) return results;

  // 1. Transposition-family Fingerprint (Unusual IC + preserved letter frequency)
  // Preserved letter frequency means unshifted Chi-squared is low (looks like English unigrams)
  // But the text is scrambled (not plaintext, lacks readable English words)
  const icRes = calculateIC(text);
  const unshiftedChi2 = calculateUnshiftedChiSquared(text);
  const cleanAlpha = trimmed.toUpperCase().replace(/[^A-Z]/g, "");

  if (cleanAlpha.length >= 20 && icRes.ic >= 0.055 && icRes.ic <= 0.080 && unshiftedChi2 < 45) {
    // Check if it's plaintext or standard Caesar (which would shift letters away from raw English frequency)
    // If it's raw English frequency, but scrambled, it's a Transposition cipher!
    const commonWords = ["THE", "AND", "ING", "TION", "THAT", "THIS", "WITH", "FROM", "HAVE", "WERE"];
    const textUpper = trimmed.toUpperCase();
    const hasCommonWords = commonWords.some(word => textUpper.includes(word));

    if (!hasCommonWords) {
      results.push({
        toolId: "railfence",
        confidence: 0.85,
        preview: "Transposition cipher fingerprint (Rail Fence / Columnar)",
        details: `Letter frequencies perfectly match English (chi2: ${unshiftedChi2.toFixed(2)}), but layout is scrambled with standard English IC (${icRes.ic.toFixed(4)}).`,
        isMatch: false
      });
    }
  }

  // 2. Base62 (Alphabet [0-9A-Za-z], no +, /, = symbols)
  const base62Regex = /^[0-9A-Za-z]+$/;
  if (base62Regex.test(trimmed) && trimmed.length > 5) {
    const hasDigits = /[0-9]/.test(trimmed);
    const hasUpper = /[A-Z]/.test(trimmed);
    const hasLower = /[a-z]/.test(trimmed);
    
    // Hex is also [0-9A-Fa-f], so make sure Base62 has chars beyond F/f
    const hasHexOnly = /^[0-9A-Fa-f]+$/.test(trimmed);

    if (hasDigits && hasUpper && hasLower && !hasHexOnly) {
      results.push({
        toolId: "base62",
        confidence: 0.85,
        preview: "Base62 encoded data string",
        details: "Matches Base62 alphabet (alphanumeric mixed-case, no special character symbols).",
        isMatch: false
      });
    }
  }

  // 3. Base100 (Emoji codepoints in U+1F400 - U+1F4FF)
  const chars = Array.from(trimmed);
  let base100Count = 0;
  for (const char of chars) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= 0x1F400 && code <= 0x1F4FF) {
      base100Count++;
    }
  }
  if (base100Count > 0 && chars.length > 0) {
    const ratio = base100Count / chars.length;
    if (ratio > 0.7) {
      results.push({
        toolId: "base100",
        confidence: 0.98,
        preview: "Base100 (Emoji) encoded string",
        details: `Detected ${base100Count} Base100 emoji characters (${Math.round(ratio * 100)}% of input).`,
        isMatch: false
      });
    }
  }

  // 4. Baudot ITA2 (5-bit binary tokens, space-separated)
  const baudotTokens = trimmed.split(/\s+/);
  const isBaudotPattern = baudotTokens.length > 0 && baudotTokens.every(t => /^[01]{5}$/.test(t));
  if (isBaudotPattern && baudotTokens.length >= 2) {
    results.push({
      toolId: "baudot",
      confidence: 0.95,
      details: `Detected ${baudotTokens.length} space-separated 5-bit Baudot (ITA2) binary tokens.`,
      preview: "Baudot (ITA2) 5-bit telegraph signal",
      isMatch: false
    });
  }

  // 5. Tap Code (dot groups separated by spaces/slashes)
  const tapCodeTokens = trimmed.split(/\s+/);
  const isTapCodePattern = tapCodeTokens.length > 0 && tapCodeTokens.every(t => /^[.\/]+$/.test(t)) && trimmed.includes(".");
  if (isTapCodePattern) {
    results.push({
      toolId: "tapcode",
      confidence: 0.9,
      preview: "Tap Code (Prisoner's dot cipher)",
      details: "Message consists entirely of tapped dot sequences separated by word markers.",
      isMatch: false
    });
  }

  // 6. Phone Keypad (Multi-tap digits separated by spaces)
  const phoneTokens = trimmed.split(/\s+/);
  const isPhonePattern = phoneTokens.length > 0 && phoneTokens.every(t => /^[0-9]+$/.test(t));
  if (isPhonePattern && phoneTokens.length >= 3) {
    // Standard phone keypad only repeats same digits (e.g. 222, 55, 0)
    const isRepeatedDigits = phoneTokens.every(t => {
      if (t.length === 0) return true;
      const first = t[0];
      return t.split("").every(c => c === first);
    });
    
    if (isRepeatedDigits) {
      results.push({
        toolId: "phonekeypad",
        confidence: 0.95,
        preview: "Phone Keypad multi-tap numeric code",
        details: `Matches Phone Keypad (multi-tap) spacing structure with ${phoneTokens.length} digits.`,
        isMatch: false
      });
    }
  }

  // 7. Pig Latin (Linguistic words ending with 'ay' or 'way')
  const words = trimmed.split(/[^a-zA-Z]+/);
  const validWords = words.filter(w => w.length > 0);
  if (validWords.length >= 3) {
    let ayWords = 0;
    for (const w of validWords) {
      if (w.toLowerCase().endsWith("ay")) {
        ayWords++;
      }
    }
    const ayRatio = ayWords / validWords.length;
    if (ayRatio > 0.5) {
      results.push({
        toolId: "piglatin",
        confidence: 0.9,
        preview: "Pig Latin conversational obfuscation",
        details: `${Math.round(ayRatio * 100)}% of words terminate with piglatin 'ay'/'way' accents.`,
        isMatch: false
      });
    }
  }

  // 8. Geek Code Block wrapping
  if (trimmed.includes("-----BEGIN GEEK CODE BLOCK-----") && trimmed.includes("-----END GEEK CODE BLOCK-----")) {
    results.push({
      toolId: "geekcode",
      confidence: 1.0,
      preview: "Geek Code Block structure wrapper",
      details: "Fully formed GEEK CODE boundary delimiters identified.",
      isMatch: false
    });
  }

  return results;
}
