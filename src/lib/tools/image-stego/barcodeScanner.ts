import jsQR from "jsqr";

/**
 * Scans a canvas for a QR code using jsQR.
 * @param canvas - Source canvas
 * @returns Decoded data and location, or null if no QR code found
 */
export function scanQrCode(canvas: HTMLCanvasElement): { data: string; location: any } | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  
  const code = jsQR(imgData.data, imgData.width, imgData.height);
  
  if (code) {
    return {
      data: code.data,
      location: code.location
    };
  }
  
  return null;
}
