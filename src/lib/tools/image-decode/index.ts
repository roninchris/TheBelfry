/**
 * Public entry point: given a cipher id and an image, produce the intermediate
 * notation to drop into The Codex input buffer. Tries the cipher's configured
 * strategies in order and keeps the highest-confidence result.
 */

import type { ImageDecodeResult } from "./types";
import { getStrategy } from "./strategyRegistry";
import { getAtlas } from "./glyphs";
import { matchCanvas } from "./templateMatch";
import { runOcr } from "./ocr";
import { fileToImage, imageToCanvas } from "./imageUtils";

export type { ImageDecodeResult, ImageDecodeMethod } from "./types";
export { getStrategy, supportsImageIntake } from "./strategyRegistry";

export async function runImageDecode(
  cipherId: string,
  canvas: HTMLCanvasElement
): Promise<ImageDecodeResult> {
  const cfg = getStrategy(cipherId);
  const results: ImageDecodeResult[] = [];

  for (const method of cfg.order) {
    try {
      if (method === "template" && cfg.atlas) {
        const atlas = getAtlas(cfg.atlas);
        if (atlas) results.push(matchCanvas(canvas, atlas));
      } else if (method === "ocr") {
        results.push(await runOcr(canvas, cfg.ocrCharset));
      }
    } catch (err) {
      results.push({
        notation: "",
        confidence: 0,
        method,
        note: `${method === "ocr" ? "OCR" : "Template match"} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  }

  const usable = results.filter((r) => r.notation.length > 0);
  if (usable.length === 0) {
    return (
      results[0] ?? {
        notation: "",
        confidence: 0,
        method: cfg.order[0] ?? "ocr",
        note: "No strategy produced a result.",
      }
    );
  }
  usable.sort((a, b) => b.confidence - a.confidence);
  return usable[0];
}

/** Convenience for the UI: File/Blob → decoded notation. */
export async function decodeImageFile(
  cipherId: string,
  file: Blob
): Promise<{ result: ImageDecodeResult; canvas: HTMLCanvasElement }> {
  const img = await fileToImage(file);
  const canvas = imageToCanvas(img);
  const result = await runImageDecode(cipherId, canvas);
  return { result, canvas };
}
