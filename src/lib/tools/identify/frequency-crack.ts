/**
 * Frequency analysis and cipher cracking.
 * For Caesar: chi-squared scoring against English letter frequencies.
 * For Vigenère: detection + key length estimation (not full auto-crack).
 */

// Standard English letter frequency distribution (percentages)
const ENGLISH_FREQUENCIES: Record<string, number> = {
  A: 8.167, B: 1.492, C: 2.782, D: 4.253, E: 12.702, F: 2.228,
  G: 2.015, H: 6.094, I: 6.966, J: 0.153, K: 0.772, L: 4.025,
  M: 2.406, N: 6.749, O: 7.507, P: 1.929, Q: 0.095, R: 5.987,
  S: 6.327, T: 9.056, U: 2.758, V: 0.978, W: 2.360, X: 0.150,
  Y: 1.974, Z: 0.074
};

export interface CaesarCrackResult {
  shift: number;
  decoded: string;
  chiSquared: number;
  confidence: number; // 0-1, based on chi-squared score
}

export interface VigenereDetectionResult {
  isLikelyVigenere: boolean;
  estimatedKeyLength: number | null;
  confidence: number;
  details: string;
}

/**
 * Calculate chi-squared statistic for a text against English frequencies.
 * Lower chi-squared = closer to English distribution.
 */
function calculateChiSquared(text: string): number {
  const clean = text.toUpperCase().replace(/[^A-Z]/g, "");
  if (clean.length === 0) return Infinity;

  const len = clean.length;
  const counts: Record<string, number> = {};
  
  // Initialize all letters to 0
  for (let i = 65; i <= 90; i++) {
    counts[String.fromCharCode(i)] = 0;
  }
  
  // Count actual frequencies
  for (const char of clean) {
    counts[char]++;
  }

  // Calculate chi-squared
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

/**
 * Apply Caesar shift to text.
 */
function caesarShift(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + s) % 26) + 65);
      }
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + s) % 26) + 97);
      }
      return char;
    })
    .join("");
}

/**
 * Crack Caesar cipher by trying all 26 shifts and scoring with chi-squared.
 */
export function crackCaesar(text: string): CaesarCrackResult | null {
  const clean = text.toUpperCase().replace(/[^A-Z]/g, "");
  if (clean.length < 4) {
    return null; // Too little data for any frequency signal at all
  }

  let bestShift = 0;
  let bestChiSquared = Infinity;
  let bestDecoded = "";
  let shift0ChiSquared = Infinity;

  for (let shift = 0; shift < 26; shift++) {
    const decoded = caesarShift(text, shift);
    const chiSquared = calculateChiSquared(decoded);
    
    if (chiSquared < bestChiSquared) {
      bestChiSquared = chiSquared;
      bestShift = shift;
      bestDecoded = decoded;
    }
    
    // Track shift 0 specifically for comparison
    if (shift === 0) {
      shift0ChiSquared = chiSquared;
    }
  }

  // If best shift is 0, or the improvement over shift 0 is negligible (< 5%),
  // report as plaintext rather than Caesar cipher
  const improvementRatio = shift0ChiSquared / bestChiSquared;
  const isPlaintext = bestShift === 0 || improvementRatio < 1.05;

  if (isPlaintext) {
    // Return a special result indicating plaintext
    return {
      shift: 0,
      decoded: text,
      chiSquared: parseFloat(shift0ChiSquared.toFixed(2)),
      confidence: 0.05 // Very low confidence to indicate it's not a cipher
    };
  }

  // Calculate confidence based on chi-squared score and text length
  // A chi-squared of ~30-50 is typical for English text
  // Higher values indicate less English-like distribution
  // Shorter texts get lower confidence since frequency analysis is less reliable
  let confidence = Math.max(0, 1 - (bestChiSquared / 100));

  // Penalize confidence for short texts — chi-squared is unreliable on tiny samples,
  // but we still surface a (heavily discounted) signal instead of no signal at all.
  if (clean.length < 10) {
    confidence *= 0.35;
  } else if (clean.length < 20) {
    confidence *= 0.7;
  } else if (clean.length < 30) {
    confidence *= 0.85;
  }
  
  // Also check if the decoded text has common English words
  const commonWords = ["THE", "AND", "ING", "TION", "THAT", "THIS", "WITH", "FROM", "HAVE", "WERE"];
  const decodedUpper = bestDecoded.toUpperCase();
  const hasCommonWords = commonWords.some(word => decodedUpper.includes(word));
  
  if (hasCommonWords) {
    confidence = Math.min(1, confidence + 0.2);
  }

  return {
    shift: bestShift,
    decoded: bestDecoded,
    chiSquared: parseFloat(bestChiSquared.toFixed(2)),
    confidence: parseFloat(confidence.toFixed(3))
  };
}

/**
 * Estimate Vigenère key length using Index of Coincidence.
 * Uses the Kasiski examination principle: split text into columns
 * and calculate IC for each column length.
 */
export function detectVigenere(text: string): VigenereDetectionResult {
  const clean = text.toUpperCase().replace(/[^A-Z]/g, "");
  if (clean.length < 40) {
    return {
      isLikelyVigenere: false,
      estimatedKeyLength: null,
      confidence: 0,
      details: "Insufficient text for any Vigenère signal (need 40+ chars)"
    };
  }
  // Below the ~100-char threshold IC estimation is much noisier — still run it,
  // but the confidence scaling below discounts short-input results accordingly.
  const isShortSample = clean.length < 100;

  // Try key lengths from 2 to 15 (skip 1 since that's monoalphabetic)
  const maxKeyLength = Math.min(15, Math.floor(clean.length / 4));
  const icScores: number[] = [];

  for (let keyLength = 2; keyLength <= maxKeyLength; keyLength++) {
    // Split text into keyLength columns
    const columns: string[] = [];
    for (let i = 0; i < keyLength; i++) {
      let column = "";
      for (let j = i; j < clean.length; j += keyLength) {
        column += clean[j];
      }
      columns.push(column);
    }

    // Calculate average IC across all columns
    let totalIC = 0;
    let validColumns = 0;
    for (const column of columns) {
      if (column.length < 4) continue; // Need at least 4 chars per column
      
      const counts: Record<string, number> = {};
      for (const char of column) {
        counts[char] = (counts[char] || 0) + 1;
      }
      
      let sum = 0;
      for (const count of Object.values(counts)) {
        sum += count * (count - 1);
      }
      const ic = sum / (column.length * (column.length - 1));
      totalIC += ic;
      validColumns++;
    }
    
    if (validColumns > 0) {
      const avgIC = totalIC / validColumns;
      icScores.push(avgIC);
    } else {
      icScores.push(0);
    }
  }

  // Find key length with IC closest to English (0.0667)
  const englishIC = 0.0667;
  let bestKeyLength = 1;
  let bestScore = 0;
  
  for (let i = 0; i < icScores.length; i++) {
    const score = icScores[i];
    // Only consider if IC is reasonably close to English IC
    // and significantly higher than random IC (0.038)
    if (score > bestScore && score > 0.055 && score < 0.075) {
      bestScore = score;
      bestKeyLength = i + 2; // +2 because we started from keyLength=2
    }
  }

  // If best key length is still 1 or score is too low, not Vigenère
  if (bestKeyLength === 1 || bestScore < 0.058) {
    return {
      isLikelyVigenere: false,
      estimatedKeyLength: null,
      confidence: 0.1,
      details: "IC analysis does not support polyalphabetic cipher detection"
    };
  }

  // Additional check: the IC should be significantly better than key length 1
  // Calculate IC for key length 1 (monoalphabetic)
  const monoIC = calculateMonoalphabeticIC(clean);
  
  // If monoalphabetic IC is already close to English, it's probably not Vigenère
  if (Math.abs(monoIC - englishIC) < 0.01) {
    return {
      isLikelyVigenere: false,
      estimatedKeyLength: null,
      confidence: 0.15,
      details: "IC suggests monoalphabetic substitution, not polyalphabetic"
    };
  }

  // If we found a key length > 1 with good IC, it's likely Vigenère
  let confidence = bestScore > 0.062 ? 0.75 : 0.5;
  if (isShortSample) confidence *= 0.6;

  return {
    isLikelyVigenere: true,
    estimatedKeyLength: bestKeyLength,
    confidence: parseFloat(confidence.toFixed(3)),
    details: `IC analysis suggests polyalphabetic cipher with estimated key length of ${bestKeyLength}`
  };
}

/**
 * Calculate IC for monoalphabetic (key length 1) case.
 */
function calculateMonoalphabeticIC(text: string): number {
  const counts: Record<string, number> = {};
  for (const char of text) {
    counts[char] = (counts[char] || 0) + 1;
  }
  
  let sum = 0;
  for (const count of Object.values(counts)) {
    sum += count * (count - 1);
  }
  return sum / (text.length * (text.length - 1));
}
