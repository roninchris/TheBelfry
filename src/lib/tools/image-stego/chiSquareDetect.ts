/**
 * Chi-Square Goodness-of-Fit LSB anomaly detector.
 * Analyzes the frequency of adjacent pixel-value pairs (2k, 2k+1) to detect statistical equalizations.
 */

export interface ChiSquareResult {
  suspicionLevel: "none" | "low" | "medium" | "high";
  chiSquareScore: number;
  details: string;
}

/**
 * Runs a Chi-Square test on a canvas's color channels to detect LSB anomalies.
 * Naive LSB embedding equalizes the frequencies of adjacent pixel value pairs, resulting in extremely low scores.
 */
export function detectLsbAnomaly(canvas: HTMLCanvasElement): ChiSquareResult {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error("Invalid canvas dimension for analysis.");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D rendering context from carrier canvas.");
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const numPixels = canvas.width * canvas.height;

  if (numPixels === 0) {
    return {
      suspicionLevel: "none",
      chiSquareScore: 0,
      details: "No pixel data available for statistical analysis."
    };
  }

  // Frequency tables for R, G, B channels
  const rCounts = new Int32Array(256);
  const gCounts = new Int32Array(256);
  const bCounts = new Int32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    rCounts[data[i]]++;
    gCounts[data[i + 1]]++;
    bCounts[data[i + 2]]++;
  }

  // Calculate chi-square score for a single channel
  const calculateChannelChi = (counts: Int32Array): { score: number; pairsAnalyzed: number } => {
    let chi2Sum = 0;
    let pairsAnalyzed = 0;

    for (let k = 0; k < 128; k++) {
      const ev = counts[2 * k];
      const od = counts[2 * k + 1];
      const total = ev + od;

      if (total > 0) {
        const expected = total / 2.0;
        // Chi-Square formula: Sum of (Observed - Expected)^2 / Expected
        const contrib = (Math.pow(ev - expected, 2) + Math.pow(od - expected, 2)) / expected;
        chi2Sum += contrib;
        pairsAnalyzed++;
      }
    }

    return {
      score: pairsAnalyzed > 0 ? chi2Sum / pairsAnalyzed : 999.0,
      pairsAnalyzed
    };
  };

  const rResult = calculateChannelChi(rCounts);
  const gResult = calculateChannelChi(gCounts);
  const bResult = calculateChannelChi(bCounts);

  const rChi = rResult.score;
  const gChi = gResult.score;
  const bChi = bResult.score;

  // Since a clean channel shouldn't mask a dirty one, we evaluate suspicion based on the minimum score.
  // Lower chi-square means closer to a perfect 50/50 split of even/odd pairs, indicating high LSB embedding probability.
  const minChi = Math.min(rChi, gChi, bChi);

  let suspicionLevel: "none" | "low" | "medium" | "high" = "none";
  if (minChi < 1.5) {
    suspicionLevel = "high";
  } else if (minChi < 5.0) {
    suspicionLevel = "medium";
  } else if (minChi < 12.0) {
    suspicionLevel = "low";
  } else {
    suspicionLevel = "none";
  }

  const formatChannelDetail = (name: string, chi: number) => {
    let status = "CLEAN";
    if (chi < 1.5) status = "HIGH ANOMALY DETECTED";
    else if (chi < 5.0) status = "MODERATE ANOMALY";
    else if (chi < 12.0) status = "LOW ANOMALY";
    return `${name} CHANNEL CHI-SQUARE: ${chi.toFixed(3)} [${status}]`;
  };

  const details = `STATISTICAL ANALYSIS SUMMARY:
----------------------------------------
${formatChannelDetail("RED  ", rChi)}
${formatChannelDetail("GREEN", gChi)}
${formatChannelDetail("BLUE ", bChi)}

MINIMUM CHI-SQUARE SCORE: ${minChi.toFixed(3)}
COMBINED VERDICT: ${suspicionLevel.toUpperCase()} SUSPICION OF LSB EMBEDDING

METHODOLOGY:
This goodness-of-fit test measures the statistical deviation of adjacent pixel intensity pairs (e.g. 2k and 2k+1). Naive least-significant-bit (LSB) embedding inherently equalizes these frequencies, causing the chi-square metric to collapse towards zero.

CORE LIMITATIONS:
1. Target Scope: This test specifically flags sequential or high-density LSB steganography applied widely across the image container.
2. Low-Density Failure: It is significantly less effective against sparse, low-density embeddings (e.g., hidden messages that only modify a tiny fraction of total pixels).
3. Adaptive Mitigation: It cannot detect sophisticated steganography tools (such as OutGuess, Steghide, or JSteg) that actively preserve first-order statistics or utilize randomized, non-sequential pixel selections to bypass simple goodness-of-fit calculations.
4. Natural False Positives: Synthetic graphics, highly compressed graphics, flat color fills, or images with low color depth can naturally produce very low chi-square scores without actually containing any hidden payload.`;

  return {
    suspicionLevel,
    chiSquareScore: minChi,
    details
  };
}
