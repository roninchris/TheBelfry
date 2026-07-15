/**
 * Estimating pattern width for Single Image Random Dot Stereograms (SIRDS)
 * and extracting depth maps through autocorrelation and shift-analysis.
 */

export function extractStereogramDepth(canvas: HTMLCanvasElement, patternWidth?: number): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Auto-estimate pattern width if not provided
  const W = patternWidth || estimatePatternWidth(data, width, height);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outCtx = outputCanvas.getContext("2d")!;
  const outData = outCtx.createImageData(width, height);
  const od = outData.data;

  // 2. Perform shift-difference analysis
  // We compare each pixel with its neighbor W pixels to the left.
  // In a stereogram, the displacement (parallax) reveals depth.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      if (x < W) {
        // First strip has no left-neighbor to compare against
        od[idx] = od[idx + 1] = od[idx + 2] = 0;
        od[idx + 3] = 255;
        continue;
      }

      const prevIdx = (y * width + (x - W)) * 4;
      
      // Calculate absolute difference across RGB
      const dr = Math.abs(data[idx] - data[prevIdx]);
      const dg = Math.abs(data[idx + 1] - data[prevIdx + 1]);
      const db = Math.abs(data[idx + 2] - data[prevIdx + 2]);
      
      const diff = (dr + dg + db) / 3;

      // Enhance the difference: 
      // High similarity (low diff) = Hidden Object Surface
      // Low similarity (high diff) = Background or transition
      // We apply an inverse thresholding to make the shape pop.
      let val = 255 - (diff * 4); 
      val = Math.max(0, Math.min(255, val));
      
      // Basic noise reduction: clamp low values to true black
      if (val < 40) val = 0;

      od[idx] = od[idx + 1] = od[idx + 2] = val;
      od[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outputCanvas;
}

/**
 * Estimates the repeating pattern width using autocorrelation of a sample row.
 */
function estimatePatternWidth(data: Uint8ClampedArray, width: number, height: number): number {
  const sampleRows = [
    Math.floor(height * 0.25),
    Math.floor(height * 0.5),
    Math.floor(height * 0.75)
  ];
  
  const candidates: { w: number; score: number }[] = [];

  // Common pattern widths are between 60 and 200 pixels for web-res images
  const minW = Math.max(40, Math.floor(width / 30));
  const maxW = Math.min(300, Math.floor(width / 3));

  for (let w = minW; w <= maxW; w++) {
    let totalScore = 0;
    
    for (const y of sampleRows) {
      const rowStart = y * width * 4;
      let rowScore = 0;
      let comparisons = 0;

      for (let x = w; x < width; x += 2) { // Step 2 for performance
        const idx1 = rowStart + x * 4;
        const idx2 = rowStart + (x - w) * 4;
        
        const diff = Math.abs(data[idx1] - data[idx2]) + 
                     Math.abs(data[idx1 + 1] - data[idx2 + 1]) + 
                     Math.abs(data[idx1 + 2] - data[idx2 + 2]);
        
        // Lower diff = higher correlation
        rowScore += (255 * 3 - diff);
        comparisons++;
      }
      totalScore += rowScore / (comparisons || 1);
    }
    candidates.push({ w, score: totalScore / sampleRows.length });
  }

  // Pick candidate with highest correlation
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.w || 100;
}
