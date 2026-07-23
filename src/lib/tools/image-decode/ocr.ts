/**
 * OCR strategy — tesseract.js, dynamically imported so the ~ several-MB WASM
 * bundle only downloads the first time an image is actually read (not on app
 * load). A single worker is cached and reconfigured per call.
 *
 * Real-world cipher images are often light-on-dark and/or low-resolution, both
 * of which hurt tesseract. `preprocess` normalises to dark-text-on-white and
 * upscales small images before recognition.
 */

import type { ImageDecodeResult } from "./types";
import { canvasToGray } from "./imageUtils";

// tesseract.js has no bundled types here; keep the worker loosely typed.
let workerPromise: Promise<any> | null = null;

async function getWorker(): Promise<any> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) => createWorker("eng"));
  }
  return workerPromise;
}

/** Normalise polarity (→ dark text on white) and upscale small images. */
function preprocess(source: HTMLCanvasElement): HTMLCanvasElement {
  const gray = canvasToGray(source);

  // Decide polarity from the border: if the frame is mostly dark, invert so the
  // ink ends up dark-on-light (what tesseract expects).
  let borderSum = 0;
  let n = 0;
  const step = Math.max(1, Math.floor((gray.w + gray.h) / 200));
  for (let x = 0; x < gray.w; x += step) {
    borderSum += gray.data[x] + gray.data[(gray.h - 1) * gray.w + x];
    n += 2;
  }
  const invert = borderSum / Math.max(1, n) < 0.5;

  // Upscale so lowercase x-height is comfortably above tesseract's ~20px floor.
  const scale = Math.max(1, Math.min(4, 900 / Math.max(gray.w, gray.h)));
  const w = Math.round(gray.w * scale);
  const h = Math.round(gray.h * scale);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (invert) {
    ctx.filter = "invert(1)";
  }
  ctx.drawImage(source, 0, 0, w, h);
  return out;
}

/**
 * Read printed characters from a canvas. `charset` becomes tesseract's
 * whitelist, constraining output to the alphabet the target cipher expects.
 */
export async function runOcr(
  canvas: HTMLCanvasElement,
  charset?: string
): Promise<ImageDecodeResult> {
  const worker = await getWorker();
  await worker.setParameters({
    // Empty string clears any whitelist from a previous call.
    tessedit_char_whitelist: charset ?? "",
    // Treat the image as a single block of text (rows of a cipher).
    tessedit_pageseg_mode: "6",
  });
  const prepared = preprocess(canvas);
  const { data } = await worker.recognize(prepared);
  const notation = (data.text ?? "").trim();
  return {
    notation,
    confidence: notation ? Math.max(0, Math.min(1, (data.confidence ?? 0) / 100)) : 0,
    method: "ocr",
    note: notation ? undefined : "OCR read no characters from the image.",
  };
}

/** Release the cached worker (e.g. on unmount) — optional. */
export async function disposeOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}
