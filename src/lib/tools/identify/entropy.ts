/**
 * Shannon entropy detector.
 * High entropy (~7-8 bits/char) suggests encrypted/compressed/random data.
 * Low entropy suggests plaintext or simple substitution.
 */
export interface EntropyResult {
  entropy: number; // bits per character
  confidence: number; // 0-1, how "random" the data appears
  label: string;
}

export function calculateEntropy(text: string): EntropyResult {
  if (!text || text.length === 0) {
    return { entropy: 0, confidence: 0, label: "Empty input" };
  }

  const len = text.length;
  const freqs: Record<string, number> = {};
  
  // Count character frequencies
  for (const char of text) {
    freqs[char] = (freqs[char] || 0) + 1;
  }

  // Calculate Shannon entropy
  let entropy = 0;
  for (const count of Object.values(freqs)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  // Normalize confidence based on entropy range
  // For 8-bit ASCII, max entropy is 8 bits/char
  // English text is typically ~3.5-4.5 bits/char
  // Random data is ~7.5-8 bits/char
  const maxEntropy = 8;
  const normalizedEntropy = entropy / maxEntropy;
  
  // Confidence: 0 = very structured (low entropy), 1 = very random (high entropy)
  const confidence = Math.min(Math.max(normalizedEntropy, 0), 1);

  let label = "Low entropy (structured)";
  if (confidence > 0.8) {
    label = "High entropy (encrypted/random)";
  } else if (confidence > 0.6) {
    label = "Medium-high entropy (compressed)";
  } else if (confidence > 0.4) {
    label = "Medium entropy (mixed)";
  }

  return {
    entropy: parseFloat(entropy.toFixed(3)),
    confidence: parseFloat(confidence.toFixed(3)),
    label
  };
}
