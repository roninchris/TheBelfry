import { ToolOptions, TransformOutput } from "../types";

/**
 * Route Transposition Cipher
 * Text is written into a grid and read out in a specific pattern (route).
 * Supported routes: "spiral", "snake", "columnar".
 */

export function routeEncode(text: string, options?: ToolOptions): string {
  const columns = (options?.columns as number) || 5;
  const route = (options?.route as string) || "spiral";
  const cleanText = text.replace(/\s+/g, "");
  const height = Math.ceil(cleanText.length / columns);
  
  const grid: string[][] = Array.from({ length: height }, () => new Array(columns).fill("X"));
  for (let i = 0; i < cleanText.length; i++) {
    const r = Math.floor(i / columns);
    const c = i % columns;
    grid[r][c] = cleanText[i];
  }

  let result = "";
  if (route === "boustrophedon") {
    for (let r = 0; r < height; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < columns; c++) result += grid[r][c];
      } else {
        for (let c = columns - 1; c >= 0; c--) result += grid[r][c];
      }
    }
  } else if (route === "spiral") {
    let top = 0, bottom = height - 1, left = 0, right = columns - 1;
    while (top <= bottom && left <= right) {
      for (let i = left; i <= right; i++) result += grid[top][i];
      top++;
      for (let i = top; i <= bottom; i++) result += grid[i][right];
      right--;
      if (top <= bottom) {
        for (let i = right; i >= left; i--) result += grid[bottom][i];
        bottom--;
      }
      if (left <= right) {
        for (let i = bottom; i >= top; i--) result += grid[i][left];
        left++;
      }
    }
  } else if (route === "diagonal") {
    // Zig-zag diagonal reading
    for (let sum = 0; sum <= (height + columns - 2); sum++) {
      for (let r = 0; r <= sum; r++) {
        const c = sum - r;
        if (r < height && c < columns) {
          result += grid[r][c];
        }
      }
    }
  } else {
    // Default: columnar
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < height; r++) {
        result += grid[r][c];
      }
    }
  }

  return result;
}

export function routeDecode(text: string, options?: ToolOptions): string {
  const columns = (options?.columns as number) || 5;
  const route = (options?.route as string) || "spiral";
  const height = Math.ceil(text.length / columns);
  const grid: string[][] = Array.from({ length: height }, () => new Array(columns).fill(""));

  let textIdx = 0;
  if (route === "boustrophedon") {
    for (let r = 0; r < height; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < columns; c++) grid[r][c] = text[textIdx++];
      } else {
        for (let c = columns - 1; c >= 0; c--) grid[r][c] = text[textIdx++];
      }
    }
  } else if (route === "spiral") {
    let top = 0, bottom = height - 1, left = 0, right = columns - 1;
    while (top <= bottom && left <= right) {
      for (let i = left; i <= right; i++) grid[top][i] = text[textIdx++];
      top++;
      for (let i = top; i <= bottom; i++) grid[i][right] = text[textIdx++];
      right--;
      if (top <= bottom) {
        for (let i = right; i >= left; i--) grid[bottom][i] = text[textIdx++];
        bottom--;
      }
      if (left <= right) {
        for (let i = bottom; i >= top; i--) grid[i][left] = text[textIdx++];
        left++;
      }
    }
  } else if (route === "diagonal") {
    for (let sum = 0; sum <= (height + columns - 2); sum++) {
      for (let r = 0; r <= sum; r++) {
        const c = sum - r;
        if (r < height && c < columns && textIdx < text.length) {
          grid[r][c] = text[textIdx++];
        }
      }
    }
  } else {
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < height; r++) {
        grid[r][c] = text[textIdx++];
      }
    }
  }

  let result = "";
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < columns; c++) {
      result += grid[r][c];
    }
  }
  return result.replace(/X+$/, ""); // Remove padding
}
