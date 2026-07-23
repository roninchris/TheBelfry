/**
 * Pixel plumbing shared by the template matcher and (lightly) the OCR path:
 * load → grayscale → polarity-aware binarize → row/column segmentation →
 * per-cell normalized ink vectors ready for cross-correlation.
 */

export interface GrayImage {
  data: Float32Array; // luminance 0..1, row-major
  w: number;
  h: number;
}

/** 1 = ink, 0 = background. Polarity is auto-detected from the border. */
export interface BinaryImage {
  data: Uint8Array;
  w: number;
  h: number;
}

export type Box = [number, number, number, number]; // x, y, w, h

/** Read a File/Blob into an HTMLImageElement. */
export function fileToImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Draw an image onto a canvas, scaled so the longest side is at most `maxDim`. */
export function imageToCanvas(img: HTMLImageElement, maxDim = 1600): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

export function canvasToGray(canvas: HTMLCanvasElement): GrayImage {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    // Rec. 601 luma, alpha-composited onto black.
    const a = src[i + 3] / 255;
    data[p] = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) * a / 255;
  }
  return { data, w, h };
}

/** Otsu's method — the luminance threshold that best splits fore/background. */
function otsuThreshold(gray: GrayImage): number {
  const bins = 256;
  const hist = new Array(bins).fill(0);
  for (let i = 0; i < gray.data.length; i++) {
    hist[Math.min(bins - 1, Math.floor(gray.data[i] * (bins - 1)))]++;
  }
  const total = gray.data.length;
  let sum = 0;
  for (let t = 0; t < bins; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 0;
  for (let t = 0; t < bins; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold / (bins - 1);
}

/**
 * Binarize with automatic polarity. Ink is whichever class the *border* is not,
 * so both white-on-black (the examples) and black-on-white printed text work.
 */
export function binarize(gray: GrayImage): BinaryImage {
  const { w, h, data } = gray;

  // Guard against no-contrast (blank) images: Otsu is degenerate there and
  // would flag the whole frame as ink. Bail to an empty result instead.
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  if (max - min < 0.12) return { data: new Uint8Array(w * h), w, h };

  const t = otsuThreshold(gray);

  // Sample the border to decide which side is background.
  let borderSum = 0;
  let borderN = 0;
  const step = Math.max(1, Math.floor((w + h) / 200));
  for (let x = 0; x < w; x += step) {
    borderSum += data[x] + data[(h - 1) * w + x];
    borderN += 2;
  }
  for (let y = 0; y < h; y += step) {
    borderSum += data[y * w] + data[y * w + (w - 1)];
    borderN += 2;
  }
  const borderMean = borderSum / Math.max(1, borderN);
  const inkIsBright = borderMean < t; // dark border → bright ink

  const out = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) {
    const above = data[i] > t;
    out[i] = (inkIsBright ? above : !above) ? 1 : 0;
  }
  return { data: out, w, h };
}

/** Consecutive runs of `y` that carry ink, separated by clear gaps → text lines. */
export function segmentRows(bin: BinaryImage, minGapRatio = 0.4): Box[] {
  const { w, h, data } = bin;
  const rowInk = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    let c = 0;
    for (let x = 0; x < w; x++) c += data[y * w + x];
    rowInk[y] = c;
  }
  const bands = runs(rowInk, 1);
  if (bands.length === 0) return [];
  const medianH = median(bands.map((b) => b[1] - b[0]));
  const minGap = Math.max(2, medianH * minGapRatio);
  const merged = mergeBands(bands, minGap);
  return merged.map(([y0, y1]) => [0, y0, w, y1 - y0] as Box);
}

/** Within a row band, consecutive runs of `x` that carry ink → glyph cells. */
export function segmentCols(bin: BinaryImage, row: Box, minGapRatio = 0.18): Box[] {
  const { w, data } = bin;
  const [, ry, , rh] = row;
  const colInk = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let c = 0;
    for (let y = ry; y < ry + rh; y++) c += data[y * w + x];
    colInk[x] = c;
  }
  const bands = runs(colInk, 1);
  if (bands.length === 0) return [];
  const minGap = Math.max(2, rh * minGapRatio);
  const merged = mergeBands(bands, minGap);
  return merged.map(([x0, x1]) => tightCrop(bin, [x0, ry, x1 - x0, rh]));
}

/** Full segmentation in reading order: rows top-to-bottom, cells left-to-right. */
export function segmentGlyphs(bin: BinaryImage): { line: number; box: Box }[] {
  const cells: { line: number; box: Box }[] = [];
  const rows = segmentRows(bin);
  rows.forEach((row, lineIdx) => {
    for (const box of segmentCols(bin, row)) cells.push({ line: lineIdx, box });
  });
  return cells;
}

/**
 * Crop a cell's box tight to its ink and stretch it to fill a `size`×`size`
 * square (independent x/y scale, small margin), returning an ink-intensity
 * vector (0..1). Stretch-to-fill — rather than aspect-preserving — is deliberate:
 * it gives thin glyphs (a binary "1" bar) full support so their correlation is
 * stable, and discriminates by internal structure (filled vs hollow, stroke
 * layout) instead of the fragile absolute aspect ratio. Both atlas glyphs and
 * input cells run through this identical pipeline, so NCC compares like with like.
 */
export function normalizeCell(bin: BinaryImage, box: Box, size = 40): Float32Array {
  const [bx, by, bw, bh] = tightCrop(bin, box);
  const out = new Float32Array(size * size);
  if (bw <= 0 || bh <= 0) return out;
  const margin = 0.1;
  const off = size * margin;
  const inner = size * (1 - 2 * margin);
  const scaleX = inner / bw;
  const scaleY = inner / bh;
  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      const sx = Math.floor(bx + (tx - off) / scaleX);
      const sy = Math.floor(by + (ty - off) / scaleY);
      if (sx < bx || sx >= bx + bw || sy < by || sy >= by + bh) continue;
      out[ty * size + tx] = bin.data[sy * bin.w + sx];
    }
  }
  // Light blur so thin strokes still correlate under small misalignment.
  return boxBlur(out, size, 1);
}

/** Separable box blur over a square `size`×`size` intensity buffer. */
function boxBlur(src: Float32Array, size: number, radius: number): Float32Array {
  const tmp = new Float32Array(size * size);
  const out = new Float32Array(size * size);
  const win = radius * 2 + 1;
  // Horizontal
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(size - 1, Math.max(0, x + k));
        sum += src[y * size + xx];
      }
      tmp[y * size + x] = sum / win;
    }
  }
  // Vertical
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(size - 1, Math.max(0, y + k));
        sum += tmp[yy * size + x];
      }
      out[y * size + x] = sum / win;
    }
  }
  return out;
}

/** Render a glyph (ink white on black) to its own binary image for the atlas. */
export function renderGlyphToBinary(
  render: (ctx: CanvasRenderingContext2D, s: number) => void,
  size = 200
): BinaryImage {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  render(ctx, size);
  return binarize(canvasToGray(canvas));
}

// ---- internal helpers -------------------------------------------------------

/** Runs of consecutive indices whose value ≥ `threshold`. Returns [start, end). */
function runs(profile: number[], threshold: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] >= threshold) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  }
  if (start >= 0) out.push([start, profile.length]);
  return out;
}

/** Merge adjacent bands separated by less than `minGap`. */
function mergeBands(bands: [number, number][], minGap: number): [number, number][] {
  if (bands.length === 0) return [];
  const out: [number, number][] = [bands[0].slice() as [number, number]];
  for (let i = 1; i < bands.length; i++) {
    const prev = out[out.length - 1];
    if (bands[i][0] - prev[1] < minGap) {
      prev[1] = bands[i][1];
    } else {
      out.push(bands[i].slice() as [number, number]);
    }
  }
  return out;
}

/** Shrink a box to the bounding rectangle of the ink inside it. */
function tightCrop(bin: BinaryImage, box: Box): Box {
  const [bx, by, bw, bh] = box;
  let minX = bx + bw;
  let minY = by + bh;
  let maxX = bx;
  let maxY = by;
  let found = false;
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) {
      if (bin.data[y * bin.w + x]) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return box;
  return [minX, minY, maxX - minX + 1, maxY - minY + 1];
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
