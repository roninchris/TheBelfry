/**
 * Client-side compression for images dropped onto the DETECTIVE BOARD.
 *
 * This is deliberately scoped to the board workspace, NOT the forensics lab:
 * the lab treats image bytes as evidence and never alters them, but a board
 * clue is a reference thumbnail, so shrinking a 6 MB phone photo to a few
 * hundred KB keeps the shared cloud board (and its Storage bucket) light
 * without any loss the eye can see at card size.
 *
 * The original file is returned untouched when compression would not help —
 * a small image, an animated GIF (re-encoding would flatten it), or an SVG
 * (already tiny and lossless). Anything that fails to decode also passes
 * through, so a bad re-encode can never block an upload.
 */

/** Longest edge, in px, a board image is downscaled to. */
const MAX_EDGE = 1600;

/** Files at or below this size skip compression entirely. */
const SKIP_UNDER_BYTES = 200 * 1024;

/** WebP quality for the re-encode. High enough to be visually lossless at card scale. */
const QUALITY = 0.82;

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Returns a compressed copy of `file`, or the original when compression is not
 * worthwhile or not possible. Never throws — callers can use the result directly.
 */
export async function compressBoardImage(file: File): Promise<File> {
  // Types that must not be re-encoded (animation lost / already minimal).
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= SKIP_UNDER_BYTES) return file;

  let img: HTMLImageElement;
  try {
    img = await loadBitmap(file);
  } catch {
    return file; // undecodable here — let the upload path handle the raw bytes
  }

  const { width, height } = img;
  if (!width || !height) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, outW, outH);

  // WebP re-encode: beats JPEG at this quality and preserves an alpha channel,
  // so it handles both photos and transparent PNGs in one path.
  const blob = await canvasToBlob(canvas, "image/webp", QUALITY);

  // Keep whichever is smaller — re-encoding an already-optimised image can grow it.
  if (!blob || blob.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.webp`, { type: "image/webp", lastModified: Date.now() });
}
