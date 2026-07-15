/**
 * Forensic identification orchestrator.
 * Runs all detectors on input and returns ranked results.
 */
import { calculateEntropy } from "./entropy";
import { detectPatterns } from "./pattern-match";
import { calculateIC } from "./index-of-coincidence";
import { crackCaesar, detectVigenere } from "./frequency-crack";
import { estimateXorKeyLength } from "../crypto-utils";
import { detectFamilyCiphers } from "./family-detect";

export interface IdentificationResult {
  toolId: string;
  confidence: number; // 0-1
  preview: string;
  details: string;
  isMatch: boolean; // true for the top result
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
    }

    results.push({
      toolId,
      confidence: parseFloat(confidence.toFixed(3)),
      preview,
      details,
      isMatch: false
    });
  }

  // Add Caesar cipher detection if frequency analysis succeeds
  if (caesarResult && caesarResult.confidence > 0.5) {
    results.push({
      toolId: "caesar",
      confidence: caesarResult.confidence,
      preview: `Caesar shift ${caesarResult.shift}: "${caesarResult.decoded.substring(0, 30)}${caesarResult.decoded.length > 30 ? "..." : ""}"`,
      details: `Chi-squared score: ${caesarResult.chiSquared} (lower is better)`,
      isMatch: false
    });
  } else if (caesarResult && caesarResult.confidence <= 0.1) {
    // Very low confidence indicates plaintext, but only add if no pattern matches found
    const hasPatternMatches = patternMatches.length > 0;
    if (!hasPatternMatches) {
      results.push({
        toolId: "plaintext",
        confidence: 0.95,
        preview: "Plaintext / no substitution detected",
        details: "Text appears to be standard English without cipher transformation",
        isMatch: false
      });
    }
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

  // Rail Fence: weak confidence heuristic based on character frequency / IC
  // If it's not a substitution cipher but has English-like IC
  if (icResult.ic >= 0.055 && icResult.ic <= 0.075) {
    if (!caesarResult || caesarResult.confidence <= 0.2) {
      const hasRailFence = results.some(r => r.toolId === "railfence");
      if (!hasRailFence) {
        results.push({
          toolId: "railfence",
          confidence: 0.4,
          preview: "Possible Rail Fence / Transposition",
          details: "Character frequency resembles English plaintext, suggesting rearrangement rather than substitution",
          isMatch: false
        });
      }
    }
  }

  // Classical Substitution group (Affine / Hill / Playfair / Bifid / Trifid)
  if (icResult.confidence > 0.5 && (icResult.label.includes("monoalphabetic") || icResult.label.includes("polyalphabetic"))) {
    const hasSpecificDetection = results.some(r => ["caesar", "vigenere", "rot13", "railfence"].includes(r.toolId));
    if (!hasSpecificDetection) {
      results.push({
        toolId: "classical",
        confidence: 0.5,
        preview: "CLASSICAL SUBSTITUTION — TRY MANUALLY",
        details: "IC indicates structured fractionated or substitution cipher, but no specific signature fired. Consider Affine, Hill, Playfair, Bifid, or Trifid.",
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
  const patternBased = new Set(["base64", "base32", "base58", "base85", "braille", "hex", "binary", "morse", "url", "gematria", "a1z26", "polybius", "base62", "base100", "baudot", "tapcode", "phonekeypad", "geekcode"]);
  const statistical = new Set(["caesar", "vigenere", "encrypted", "rot13", "xor", "railfence", "classical", "plaintext", "piglatin"]);
  
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
