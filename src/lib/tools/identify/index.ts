/**
 * Forensic identification orchestrator.
 * Runs all detectors on input and returns ranked results.
 */
import { calculateEntropy } from "./entropy";
import { detectPatterns } from "./pattern-match";
import { calculateIC } from "./index-of-coincidence";
import { crackCaesar, detectVigenere, detectAtbash, englishChiPerLetter } from "./frequency-crack";
import { estimateXorKeyLength } from "../crypto-utils";
import { detectFamilyCiphers } from "./family-detect";
import { readsAsWords } from "../languages";

export interface IdentificationResult {
  toolId: string;
  confidence: number; // 0-1
  preview: string;
  details: string;
  isMatch: boolean; // true for the top result
}

/**
 * Does this read as real *words* (in English, Portuguese or Latin), as opposed
 * to merely having language-like letter frequencies?
 *
 * This distinction is what separates plaintext from a transposition cipher.
 * Transposition only reorders letters, so the frequency profile and index of
 * coincidence stay perfectly language-shaped while the words are destroyed —
 * which is why rail fence, scytale, route, AMSCO and double transposition were
 * all being reported as "plaintext" with 0.95 confidence. Delegates to the
 * multilingual assessor so a solved Portuguese or Latin message reads as
 * plaintext too, not only English.
 */
function readsAsEnglishWords(text: string): boolean {
  return readsAsWords(text);
}

export function identifyInput(text: string): IdentificationResult[] {
  const results: IdentificationResult[] = [];
  
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Run entropy analysis
  const entropyResult = calculateEntropy(text);
  
  // Run pattern matching
  const patternMatches = detectPatterns(text);
  
  // Run IC analysis
  const icResult = calculateIC(text);
  
  // Run Caesar crack attempt
  const caesarResult = crackCaesar(text);
  
  // Run Vigenère detection
  const vigenereResult = detectVigenere(text);

  // Run new Phase 2 family detections
  const familyMatches = detectFamilyCiphers(text);
  results.push(...familyMatches);

  /**
   * When the input is confidently a transport encoding, the substitution
   * detectors are just noise: Base64's skewed letter distribution scores well
   * as a "Caesar", so a clean payload listed base64 first and caesar at 0.88
   * right behind it. If the bytes are Base64, the next move is to decode them,
   * not to run a shift over the encoded form.
   */
  const hasStrongEncodingSignal = patternMatches.some(p => p.confidence >= 0.7);

  // Add pattern-based detections
  for (const match of patternMatches) {
    let toolId = match.pattern;
    let confidence = match.confidence;
    let preview = "";
    let details = match.details;

    // Adjust confidence based on entropy
    // High entropy + pattern match = stronger signal
    if (entropyResult.confidence > 0.7) {
      confidence = Math.min(1, confidence + 0.1);
    }

    // Special handling for specific patterns
    if (match.pattern === "base64") {
      toolId = "base64";
      preview = "Base64-encoded data detected";
    } else if (match.pattern === "hex") {
      toolId = "hex";
      preview = "Hexadecimal string detected";
    } else if (match.pattern === "binary") {
      toolId = "binary";
      preview = "Binary data detected";
    } else if (match.pattern === "morse") {
      toolId = "morse";
      preview = "Morse code pattern detected";
    } else if (match.pattern === "url") {
      toolId = "url";
      preview = "URL-encoded data detected";
      // Boost URL confidence since it's a very specific pattern
      confidence = Math.min(1, confidence + 0.15);
    } else if (match.pattern === "gematria") {
      toolId = "gematria";
      preview = "Gematria Primus detected";
    } else if (match.pattern === "runic") {
      toolId = "runic";
      preview = "Elder Futhark runes detected";
    }

    results.push({
      toolId,
      confidence: parseFloat(confidence.toFixed(3)),
      preview,
      details,
      isMatch: false
    });
  }

  /**
   * Caesar.
   *
   * The threshold used to be 0.5 here with a `<= 0.1` plaintext branch below,
   * leaving a dead zone: a result scoring between those two was reported as
   * neither a cipher nor plaintext, so identifyInput returned an *empty array*
   * for a solved Caesar. Anything above the plaintext band is surfaced now; the
   * 0.5 floor still governs whether it earns the "recommended" flag at the end.
   */
  /**
   * A Caesar claim has to survive its own decode. Chi-squared separation alone
   * gave middling scores (0.2-0.5) to shifts of Vigenère, Playfair, Hill,
   * ADFGX and others whose output is nowhere near English — and because those
   * junk claims were still the top result, they masked the family
   * classification further down. Below a decisive score, the decode must
   * actually read as English words.
   */
  const caesarReadable = caesarResult ? readsAsEnglishWords(caesarResult.decoded) : false;
  if (
    caesarResult &&
    caesarResult.confidence > 0.15 &&
    !hasStrongEncodingSignal &&
    (caesarReadable || caesarResult.confidence >= 0.75)
  ) {
    results.push({
      toolId: "caesar",
      confidence: caesarResult.confidence,
      preview: `Caesar shift ${caesarResult.shift}: "${caesarResult.decoded.substring(0, 30)}${caesarResult.decoded.length > 30 ? "..." : ""}"`,
      details: `Chi-squared score: ${caesarResult.chiSquared} (lower is better)`,
      isMatch: false
    });
  } else if (caesarResult && caesarResult.confidence <= 0.1) {
    /**
     * No shift improves the text. That means either it is already plaintext, or
     * its letters were merely *reordered* — transposition leaves frequencies
     * untouched, so no substitution detector can move on it. The two are told
     * apart by whether actual words survive.
     */
    const hasPatternMatches = patternMatches.length > 0;
    if (!hasPatternMatches) {
      if (readsAsEnglishWords(text)) {
        results.push({
          toolId: "plaintext",
          confidence: 0.95,
          preview: "Plaintext / no substitution detected",
          details: "Text appears to be standard English without cipher transformation",
          isMatch: false
        });
      } else {
        results.push({
          toolId: "transposition",
          confidence: 0.82,
          preview: "TRANSPOSITION — letters are English, word order is not",
          details:
            "Letter frequencies match English but no words survive, which is the signature of a reordering cipher. Consider Rail Fence, Columnar, Route, Scytale, AMSCO or double transposition.",
          isMatch: false
        });
      }
    }
  }

  // Atbash. Keyless, so it is applied and judged rather than inferred; without
  // this branch an Atbash message could only surface as a weak, wrong "caesar".
  const atbashResult = detectAtbash(text);
  if (atbashResult.isLikelyAtbash && atbashResult.confidence > 0.3 && !hasStrongEncodingSignal) {
    const sample = atbashResult.decoded.substring(0, 30);
    results.push({
      toolId: "atbash",
      confidence: atbashResult.confidence,
      preview: `Atbash: "${sample}${atbashResult.decoded.length > 30 ? "..." : ""}"`,
      details: "Reversed-alphabet substitution; decoding scores closer to English than the raw input",
      isMatch: false
    });
  }

  // Add Vigenère detection
  if (vigenereResult.isLikelyVigenere && vigenereResult.confidence > 0.5) {
    results.push({
      toolId: "vigenere",
      confidence: vigenereResult.confidence,
      preview: `Vigenère cipher detected (estimated key length: ${vigenereResult.estimatedKeyLength})`,
      details: vigenereResult.details,
      isMatch: false
    });
  }

  // Add ROT13/Atbash detection based on IC
  if (icResult.confidence > 0.6 && icResult.label.includes("monoalphabetic")) {
    // If it's monoalphabetic but not Caesar (already detected), could be ROT13 or Atbash
    const hasCaesar = results.some(r => r.toolId === "caesar");
    if (!hasCaesar) {
      results.push({
        toolId: "rot13",
        confidence: icResult.confidence * 0.8,
        preview: "Monoalphabetic substitution detected (possibly ROT13 or Atbash)",
        details: icResult.label,
        isMatch: false
      });
    }
  }

  // XOR repeating-key estimation
  if (entropyResult.confidence > 0.6) {
    const xorEstimate = estimateXorKeyLength(text);
    if (xorEstimate) {
      results.push({
        toolId: "xor",
        confidence: 0.75,
        preview: `Repeating-key XOR detected (estimated key length: ${xorEstimate.keySize})`,
        details: `Normalized Hamming distance: ${xorEstimate.distance.toFixed(2)}`,
        isMatch: false
      });
    }
  }

  /**
   * ===== Cipher-family classification =====
   *
   * When no specific signature fires, the family can still be named from two
   * measurements, which is how classical cryptanalysis narrows the field:
   *
   *   index of coincidence  — how uneven the letter distribution is at all.
   *                           English sits near 0.067; a polyalphabetic cipher
   *                           flattens it toward random (0.038).
   *   chi-squared vs English — whether the letters that *are* there are the
   *                           letters English uses. Transposition only reorders,
   *                           so this stays low; substitution remaps, so it rises.
   *
   * Those two axes separate the three families cleanly, where index of
   * coincidence alone cannot: it reads the same for plaintext, a transposition
   * and a simple substitution. This replaces a pair of overlapping guesses that
   * reported "possible rail fence" and "classical substitution — try manually"
   * on almost anything.
   */
  const letterCount = text.replace(/[^A-Za-z]/g, "").length;
  const alreadySolved = results.some(r =>
    ["caesar", "atbash", "vigenere", "plaintext", "transposition"].includes(r.toolId)
  );

  if (letterCount >= 20 && !hasStrongEncodingSignal && !alreadySolved) {
    const chi = englishChiPerLetter(text);
    const ic = icResult.ic;

    if (ic >= 0.058 && chi <= 1.6) {
      // English letters, English proportions, but the words are gone.
      results.push({
        toolId: "transposition",
        confidence: 0.78,
        preview: "TRANSPOSITION — letters are English, order is not",
        details:
          `Index of coincidence ${ic.toFixed(4)} with a low chi-squared (${chi.toFixed(2)}/letter): the letters were reordered, not replaced. Consider Rail Fence, Columnar, Route, Scytale or AMSCO.`,
        isMatch: false
      });
    } else if (ic >= 0.058) {
      // Uneven like English, but the wrong letters are common.
      results.push({
        toolId: "monoalphabetic",
        confidence: 0.72,
        preview: "MONOALPHABETIC SUBSTITUTION — one fixed alphabet",
        details:
          `Index of coincidence ${ic.toFixed(4)} matches a single-alphabet cipher, but chi-squared is ${chi.toFixed(2)}/letter, so letters were remapped. Consider Affine, Keyed Caesar, Playfair, Hill or a simple substitution.`,
        isMatch: false
      });
    } else if (ic <= 0.052) {
      // Flattened distribution: more than one alphabet in play.
      results.push({
        toolId: "polyalphabetic",
        confidence: 0.7,
        preview: "POLYALPHABETIC — multiple alphabets in rotation",
        details:
          `Index of coincidence ${ic.toFixed(4)} is well below English (0.067), which means the distribution was flattened by a rotating key. Consider Vigenère, Beaufort, Gronsfeld, Autokey or Enigma.`,
        isMatch: false
      });
    }
  }

  // Add entropy-based detection for encrypted/compressed data
  if (entropyResult.confidence > 0.8) {
    results.push({
      toolId: "encrypted",
      confidence: entropyResult.confidence,
      preview: "High-entropy data (possibly encrypted or compressed)",
      details: entropyResult.label,
      isMatch: false
    });
  }

  // Sort with precedence: pattern-based detectors rank above statistical detectors
  const patternBased = new Set(["base64", "base32", "base58", "base85", "braille", "hex", "binary", "morse", "url", "gematria", "runic", "a1z26", "polybius", "base62", "base100", "baudot", "tapcode", "phonekeypad", "geekcode", "bacon", "dancingmen", "pigpen", "nihilist", "homophonic", "rot47"]);
  const statistical = new Set(["caesar", "vigenere", "encrypted", "rot13", "atbash", "xor", "railfence", "transposition", "monoalphabetic", "polyalphabetic", "classical", "plaintext", "piglatin"]);
  
  results.sort((a, b) => {
    const aIsPattern = patternBased.has(a.toolId);
    const bIsPattern = patternBased.has(b.toolId);
    const aIsStatistical = statistical.has(a.toolId);
    const bIsStatistical = statistical.has(b.toolId);
    
    // Pattern-based always outrank statistical
    if (aIsPattern && bIsStatistical) return -1;
    if (aIsStatistical && bIsPattern) return 1;
    
    // Special case: hex outranks base64 when both match
    // (hex is more specific than base64 since hex chars are subset of base64)
    if (a.toolId === "hex" && b.toolId === "base64") return -1;
    if (a.toolId === "base64" && b.toolId === "hex") return 1;
    
    // Within same category, sort by confidence
    return b.confidence - a.confidence;
  });

  // Mark the top result as the primary match only once it clears a real confidence floor —
  // otherwise it's just the least-bad guess and shouldn't be presented as "RECOMMENDED".
  // "classical" is an explicit "try manually, no specific signature fired" bucket, so it
  // never qualifies as a recommendation regardless of its nominal confidence value.
  const CONFIDENCE_FLOOR = 0.5;
  if (results.length > 0 && results[0].confidence > CONFIDENCE_FLOOR && results[0].toolId !== "classical") {
    results[0].isMatch = true;
  }

  return results;
}
