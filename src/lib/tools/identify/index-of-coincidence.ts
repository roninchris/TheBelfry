/**
 * Index of Coincidence (IC) calculation.
 * IC near 0.067 suggests monoalphabetic substitution (Caesar/Atbash).
 * IC near 0.038 suggests polyalphabetic (Vigenère) or random.
 * English text has IC ~0.0667.
 */
export interface ICResult {
  ic: number; // Index of coincidence
  confidence: number; // 0-1, how likely it's monoalphabetic
  label: string;
}

export interface LetterFrequency {
  letter: string;
  count: number;
  frequency: number; // Fraction between 0 and 1
}

/**
 * Common helper to count letter occurrences in plaintext.
 */
export function getLetterCounts(text: string): { counts: Record<string, number>; total: number } {
  if (!text) {
    return { counts: {}, total: 0 };
  }
  const clean = text.toUpperCase().replace(/[^A-Z]/g, "");
  const counts: Record<string, number> = {};
  for (const char of clean) {
    counts[char] = (counts[char] || 0) + 1;
  }
  return { counts, total: clean.length };
}

/**
 * Returns the frequencies of all 26 English letters (A-Z) in the given text.
 */
export function getLetterFrequencies(text: string): LetterFrequency[] {
  const { counts, total } = getLetterCounts(text);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const result: LetterFrequency[] = [];
  for (const char of alphabet) {
    const count = counts[char] || 0;
    const frequency = total > 0 ? count / total : 0;
    result.push({
      letter: char,
      count,
      frequency: parseFloat(frequency.toFixed(6))
    });
  }
  return result;
}

export function calculateIC(text: string): ICResult {
  if (!text || text.length < 2) {
    return { ic: 0, confidence: 0, label: "Insufficient data" };
  }
  
  const { counts, total: len } = getLetterCounts(text);

  if (len < 2) {
    return { ic: 0, confidence: 0, label: "Insufficient alphabetic characters" };
  }

  // Calculate IC: sum of f_i * (f_i - 1) / (n * (n - 1))
  let sum = 0;
  for (const count of Object.values(counts)) {
    sum += count * (count - 1);
  }

  const ic = sum / (len * (len - 1));

  // English IC is approximately 0.0667
  // Monoalphabetic ciphers preserve letter frequencies, so IC ~0.0667
  // Polyalphabetic ciphers flatten frequencies, so IC ~0.038-0.045
  // Random text has IC ~0.038

  const englishIC = 0.0667;
  const randomIC = 0.038;

  // Calculate confidence based on proximity to English IC
  // If IC is close to 0.0667, it's likely monoalphabetic
  // If IC is close to 0.038, it's likely polyalphabetic or random

  const distanceFromEnglish = Math.abs(ic - englishIC);
  const distanceFromRandom = Math.abs(ic - randomIC);

  let confidence = 0;
  let label = "Uncertain";

  if (distanceFromEnglish < distanceFromRandom) {
    // Closer to English/monoalphabetic
    confidence = 1 - (distanceFromEnglish / englishIC);
    if (confidence > 0.8) {
      label = "Monoalphabetic substitution (Caesar/Atbash)";
    } else if (confidence > 0.5) {
      label = "Likely monoalphabetic substitution";
    } else {
      label = "Possibly monoalphabetic";
    }
  } else {
    // Closer to random/polyalphabetic
    confidence = 1 - (distanceFromRandom / randomIC);
    if (confidence > 0.7) {
      label = "Polyalphabetic (Vigenère) or random";
    } else {
      label = "Random or highly mixed";
    }
  }

  confidence = Math.max(0, Math.min(1, confidence));
  return {
    ic: parseFloat(ic.toFixed(5)),
    confidence: parseFloat(confidence.toFixed(3)),
    label
  };
}

