/**
 * Offline symbol recognition by normalized cross-correlation (NCC).
 *
 * Both the atlas glyphs and the segmented input cells are reduced to the same
 * fixed-size ink-intensity vector by `normalizeCell`, so a cell is classified as
 * whichever atlas glyph it correlates with most strongly.
 */

import type { Atlas, ImageDecodeResult, ImageDecodeCell } from "./types";
import {
  binarize,
  canvasToGray,
  normalizeCell,
  renderGlyphToBinary,
  segmentGlyphs,
  type BinaryImage,
} from "./imageUtils";

const CELL_SIZE = 40;

interface PreparedGlyph {
  emit: string;
  vec: Float32Array;
  mean: number;
  norm: number;
}

/** Zero-mean L2 norm, cached alongside the vector so scoring stays cheap. */
function stats(vec: Float32Array): { mean: number; norm: number } {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i];
  const mean = sum / vec.length;
  let sq = 0;
  for (let i = 0; i < vec.length; i++) {
    const d = vec[i] - mean;
    sq += d * d;
  }
  return { mean, norm: Math.sqrt(sq) };
}

function ncc(a: Float32Array, aMean: number, aNorm: number, g: PreparedGlyph): number {
  if (aNorm === 0 || g.norm === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] - aMean) * (g.vec[i] - g.mean);
  return dot / (aNorm * g.norm);
}

/** Render every atlas glyph once into a comparable vector. */
function prepareAtlas(atlas: Atlas): PreparedGlyph[] {
  return atlas.entries.map((entry) => {
    const bin = renderGlyphToBinary(entry.render);
    const vec = normalizeCell(bin, [0, 0, bin.w, bin.h], CELL_SIZE);
    const { mean, norm } = stats(vec);
    return { emit: entry.emit, vec, mean, norm };
  });
}

/** Classify a pre-binarized image against an atlas. */
export function matchBinary(bin: BinaryImage, atlas: Atlas): ImageDecodeResult {
  const glyphs = prepareAtlas(atlas);
  const cells = segmentGlyphs(bin);
  if (cells.length === 0) {
    return {
      notation: "",
      confidence: 0,
      method: "template",
      note: "No glyphs found — the image may be blank, inverted, or too noisy.",
    };
  }

  const join = atlas.join ?? "";
  const lineJoin = atlas.lineJoin ?? " ";
  const debug: ImageDecodeCell[] = [];
  const lines: string[][] = [];
  let scoreSum = 0;

  for (const { line, box } of cells) {
    const vec = normalizeCell(bin, box, CELL_SIZE);
    const { mean, norm } = stats(vec);
    let best = glyphs[0];
    let bestScore = -Infinity;
    for (const g of glyphs) {
      const s = ncc(vec, mean, norm, g);
      if (s > bestScore) {
        bestScore = s;
        best = g;
      }
    }
    const score = Math.max(0, bestScore);
    scoreSum += score;
    if (!lines[line]) lines[line] = [];
    lines[line].push(best.emit);
    debug.push({ char: best.emit, score, box });
  }

  const notation = lines.map((tokens) => tokens.join(join)).join(lineJoin);
  const confidence = debug.length ? scoreSum / debug.length : 0;
  return { notation, confidence, method: "template", cells: debug };
}

/** Convenience: run the matcher straight off a canvas. */
export function matchCanvas(canvas: HTMLCanvasElement, atlas: Atlas): ImageDecodeResult {
  const bin = binarize(canvasToGray(canvas));
  return matchBinary(bin, atlas);
}
