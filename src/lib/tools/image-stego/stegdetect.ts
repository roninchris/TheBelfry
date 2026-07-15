/**
 * StegDetect-style combined statistical detector — runs locally in the browser.
 * Detection only (never extraction/decoding): flags *likelihood* of hidden data, doesn't recover it.
 *
 * Combines two chi-square goodness-of-fit tests against the same "naive LSB embedding equalizes
 * adjacent-value-pair frequencies" principle real stegdetect uses:
 *  - Spatial domain (RGB byte pairs) — reuses the existing `detectLsbAnomaly` (chiSquareDetect.ts),
 *    which catches LSB tools operating directly on pixel bytes (steganography.js-style, custom LSB).
 *  - DCT domain (JPEG AC coefficient pairs) — new here, and specifically closes the gap the
 *    existing spatial test's own documentation calls out: it cannot see JSteg/OutGuess/Steghide,
 *    which embed in DCT coefficients, not pixel bytes.
 */
import { detectLsbAnomaly, ChiSquareResult } from "./chiSquareDetect";
import { getJpegDctCoefficients } from "./jsteg";

export interface DctChiSquareResult {
  suspicionLevel: "none" | "low" | "medium" | "high";
  chiSquareScore: number;
  details: string;
}

/** Chi-square test on JPEG AC coefficient value pairs (2k, 2k+1) — the DCT-domain analogue of detectLsbAnomaly. */
export async function detectDctAnomaly(file: File): Promise<DctChiSquareResult | null> {
  const coefficients = await getJpegDctCoefficients(file);
  if (!coefficients) return null;

  // Only AC coefficients carry meaningful LSB statistics for this test; shift negatives into a
  // non-negative histogram index space so paired bins (2k, 2k+1) line up the same way the
  // spatial-domain test pairs byte values.
  const OFFSET = 2048; // generous headroom for typical DCT coefficient magnitude ranges
  const counts = new Int32Array(OFFSET * 2);
  let usable = 0;
  for (const c of coefficients) {
    if (c === 0) continue; // DC/zeroed AC coefficients don't carry LSB-pair information
    const idx = c + OFFSET;
    if (idx >= 0 && idx < counts.length) {
      counts[idx]++;
      usable++;
    }
  }

  if (usable < 64) {
    return {
      suspicionLevel: "none",
      chiSquareScore: 999,
      details: "Not enough non-zero AC coefficients to run a DCT-domain chi-square test."
    };
  }

  let chi2Sum = 0;
  let pairsAnalyzed = 0;
  for (let k = 0; k < counts.length / 2; k++) {
    const ev = counts[2 * k];
    const od = counts[2 * k + 1];
    const total = ev + od;
    if (total > 0) {
      const expected = total / 2;
      chi2Sum += (Math.pow(ev - expected, 2) + Math.pow(od - expected, 2)) / expected;
      pairsAnalyzed++;
    }
  }
  const score = pairsAnalyzed > 0 ? chi2Sum / pairsAnalyzed : 999;

  let suspicionLevel: "none" | "low" | "medium" | "high" = "none";
  if (score < 1.5) suspicionLevel = "high";
  else if (score < 5.0) suspicionLevel = "medium";
  else if (score < 12.0) suspicionLevel = "low";

  const details = `DCT-DOMAIN CHI-SQUARE: ${score.toFixed(3)} [${suspicionLevel.toUpperCase()} SUSPICION]\n\nMETHODOLOGY:\nApplies the same adjacent-value-pair goodness-of-fit test used for spatial-domain LSB detection, but to JPEG AC DCT coefficient values instead of pixel bytes — this is the domain JSteg, OutGuess, and Steghide actually embed in, which the spatial-domain test cannot see.\n\nLIMITATIONS:\nStill a first-order statistical test — tools that actively preserve coefficient histograms (OutGuess's correction pass) can evade it, and sparse/low-density embeddings produce a weaker signal.`;

  return { suspicionLevel, chiSquareScore: score, details };
}

export interface StegdetectReport {
  spatial: ChiSquareResult | null;
  dct: DctChiSquareResult | null;
  overallSuspicion: "none" | "low" | "medium" | "high";
  summary: string;
}

const LEVEL_RANK = { none: 0, low: 1, medium: 2, high: 3 } as const;

/** Runs the full stegdetect-style suite (spatial + DCT chi-square) and combines into one report. */
export async function runStegdetect(canvas: HTMLCanvasElement, file: File): Promise<StegdetectReport> {
  let spatial: ChiSquareResult | null = null;
  try {
    spatial = detectLsbAnomaly(canvas);
  } catch {
    spatial = null;
  }

  const dct = await detectDctAnomaly(file);

  const spatialRank = spatial ? LEVEL_RANK[spatial.suspicionLevel] : 0;
  const dctRank = dct ? LEVEL_RANK[dct.suspicionLevel] : 0;
  const overallRank = Math.max(spatialRank, dctRank) as 0 | 1 | 2 | 3;
  const overallSuspicion = (Object.keys(LEVEL_RANK) as (keyof typeof LEVEL_RANK)[])
    .find(k => LEVEL_RANK[k] === overallRank) ?? "none";

  const summary = dct
    ? `Spatial-domain suspicion: ${spatial?.suspicionLevel.toUpperCase() ?? "N/A"} · DCT-domain suspicion: ${dct.suspicionLevel.toUpperCase()} · Overall: ${overallSuspicion.toUpperCase()}`
    : `Spatial-domain suspicion: ${spatial?.suspicionLevel.toUpperCase() ?? "N/A"} (not a JPEG — DCT-domain test skipped) · Overall: ${overallSuspicion.toUpperCase()}`;

  return { spatial, dct, overallSuspicion, summary };
}
