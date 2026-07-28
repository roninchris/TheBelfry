/**
 * Image steganography wrapper for steganography.js
 * Vendored from steganography.js by Peter Eigenschink (MIT license)
 * Original: https://github.com/peter eigenschink/steganography.js
 */

import { decodeCover } from "./vendor/decode";
import { extractJsteg } from "./jsteg";
import { scoreDecodedPlaintext } from "../scoring";

export interface StegoOptions {
  t?: number;
  threshold?: number;
  codeUnitSize?: number;
  width?: number;
  height?: number;
}

export interface StegoResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Decode a hidden message from an image
 * @param canvas - Canvas with potentially encoded image
 * @param options - Optional steganography parameters
 * @returns Decoded message or null if no message found
 */
export function decodeMessage(
  canvas: HTMLCanvasElement,
  options: StegoOptions = {}
): string | null {
  if (typeof window === "undefined") {
    throw new Error("Steganography requires browser environment");
  }

  try {
    const message = decodeCover(canvas, options);
    if (!message || message === "\0" || message.trim() === "") {
      return null;
    }
    return message;
  } catch (err) {
    // Warn about real decode errors so they are distinguishable from "no message"
    // eslint-disable-next-line no-console
    console.warn('stego.decodeMessage error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// steganography.js / stylesuxx-compatible alpha-channel extraction
// ---------------------------------------------------------------------------

function nextPrime(n: number): number {
  const isPrime = (x: number) => {
    if (x < 2) return false;
    if (x % 2 === 0) return x === 2;
    for (let i = 3; i * i <= x; i += 2) if (x % i === 0) return false;
    return true;
  };
  let c = n;
  while (!isPrime(c)) c += 1;
  return c;
}

/**
 * Pulls URLs out of a noisy decoded string. The reconstructed payload from an
 * alpha-channel stego carrier is typically a short readable core followed by a
 * long run of 0xFF padding (the "Ã¿" wall). A URL is made only of characters in
 * the RFC 3986 set, so this regex halts cleanly at the first padding byte and
 * lifts the link out of the surrounding garbage â€” the thing users actually want.
 */
export function extractUrls(raw: string): string[] {
  const matches = raw.match(/https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi);
  if (!matches) return [];
  // Trim trailing punctuation that regex greedily grabbed, and dedupe.
  const cleaned = matches.map((u) => u.replace(/[.,;:!)]+$/, ""));
  return Array.from(new Set(cleaned));
}

/**
 * Reduces a raw decoded stego payload to its readable core. Strips control
 * bytes, collapses any run of a single repeated character longer than 6 (the
 * padding wall), and trims. Returns "" when nothing legible survives.
 */
export function cleanStegPayload(raw: string): string {
  if (!raw) return "";
  // Keep only printable ASCII (plus tab/newline). An alpha reconstruction past
  // the real payload decodes to a wall of 0xFF ("\u00FF") padding and, where the
  // padding value overflows the code range, to high-codepoint junk (\u6DB4\uB6DB\u2026);
  // this strips both while preserving readable text and URLs.
  let s = raw.replace(/[^\x09\x0A\x20-\x7E]+/g, " ");
  // Collapse any run of a single repeated character (6+) \u2014 the padding wall.
  s = s.replace(/(.)\1{5,}/g, " ");
  // Squeeze whitespace.
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/**
 * True when a decoded string is repetitive filler rather than a real message.
 * A UNIFORM alpha channel (an image with no hidden payload) reconstructs to a
 * single symbol tiled over and over — "mmmm" or "m m m m m" — which must not be
 * surfaced as a finding. A genuine payload has varied characters and is not
 * dominated by one symbol. URLs are checked separately and bypass this.
 */
export function isLowVarietyNoise(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 4) return true;
  const freq = new Map<string, number>();
  for (const ch of compact) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  // Two or fewer distinct glyphs is never a real message.
  if (freq.size <= 2) return true;
  // A real message is never more than half one repeated symbol.
  const maxFreq = Math.max(...freq.values());
  return maxFreq / compact.length > 0.5;
}

/**
 * Exact decoder for the scheme used by stylesuxx.github.io/steganography
 * (per script.js in the stylesuxx/steganography repo). The message lives in the
 * LSBs of the RGB channels — ALPHA is never touched — read pixel by pixel in row
 * order as R, G, B, R, G, B…, with every 8 bits forming one byte MSB-first
 * (`c = (c << 1) | bit`, exactly matching the site's decode loop).
 *
 * The site's encoder first clears every RGB LSB to 0, so the payload is followed
 * by a run of NUL bytes; we stop the reconstruction once a sustained NUL run
 * appears and then lift out any URL / readable core. This is the primary decode
 * for "I hid it with that website" — it is what recovers the YouTube link.
 *
 * @returns the recovered payload, or null if nothing legible is found
 */
export function decodeStylesuxx(
  canvas: HTMLCanvasElement
): { text: string; urls: string[] } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const maxBytes = 20000; // ample for a hidden note or link
  let out = "";
  let bitBuf = 0;
  let bitCount = 0;
  let nulRun = 0;
  for (let i = 0; i < data.length && out.length < maxBytes; i += 4) {
    for (let off = 0; off < 3; off += 1) {
      // Read the LSB of R, then G, then B (alpha at i+3 is skipped), packing
      // MSB-first — the inverse of the site's encoder.
      bitBuf = (bitBuf << 1) | (data[i + off] & 1);
      bitCount += 1;
      if (bitCount === 8) {
        const c = bitBuf & 0xff;
        bitBuf = 0;
        bitCount = 0;
        if (c === 0) {
          // The nulled tail after the message: 8 NUL bytes ends the payload.
          nulRun += 1;
          if (nulRun >= 8) {
            i = data.length;
            break;
          }
        } else {
          nulRun = 0;
          out += String.fromCharCode(c);
        }
      }
    }
  }

  const urls = extractUrls(out);
  const cleaned = cleanStegPayload(out);
  if (!urls.length && (cleaned.length < 4 || isLowVarietyNoise(cleaned))) return null;
  const joined = urls.join(" ");
  const text = urls.length
    ? urls.join("\n") + (cleaned && cleaned !== joined ? `\n\n${cleaned}` : "")
    : cleaned;
  return { text, urls };
}

/**
 * Secondary decode for the OTHER common JS library — Peter Eigenschink's
 * steganography.js — which instead hides in the ALPHA channel with a `t`-bit /
 * `codeUnitSize` scheme. Kept as a fallback for carriers made with that library
 * rather than the stylesuxx site. Reads the whole alpha stream and reconstructs
 * across the common parameter set, returning the cleaned core plus any URL.
 *
 * @returns the best readable candidate, or null if nothing legible is found
 */
export function decodeStegJs(
  canvas: HTMLCanvasElement
): { text: string; urls: string[]; codeUnitSize: number; t: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Reading the entire alpha channel is enough to expose the payload; cap the
  // sample count so a large carrier stays responsive (a hidden note or link is
  // short and always sits at the front of the stream).
  const maxSamples = Math.min(data.length / 4, 60000);

  const reconstruct = (t: number, codeUnitSize: number): string => {
    const prime = nextPrime(1 << t);
    const offset = 255 - prime + 1;
    const mask = (1 << codeUnitSize) - 1;
    let message = "";
    let charCode = 0;
    let bitCount = 0;
    for (let s = 0; s < maxSamples; s += 1) {
      let v = data[s * 4 + 3] - offset; // alpha channel
      if (v < 0) v = 0; // untouched (original) alpha sits above the payload range
      charCode += v << bitCount;
      bitCount += t;
      if (bitCount >= codeUnitSize) {
        message += String.fromCharCode(charCode & mask);
        bitCount %= codeUnitSize;
        charCode = v >> (t - bitCount);
      }
    }
    return message;
  };

  let best: { text: string; urls: string[]; codeUnitSize: number; t: number; score: number } | null = null;

  // stylesuxx defaults are t=3, codeUnitSize=16, but sweep the practical set so
  // a carrier written with 8-bit code units or a different bit depth still reads.
  for (const codeUnitSize of [16, 8] as const) {
    for (const t of [3, 1, 2, 4]) {
      const raw = reconstruct(t, codeUnitSize);
      const urls = extractUrls(raw);
      const cleaned = cleanStegPayload(raw);
      // No URL and no legible, varied text — this parameter set found nothing.
      // A uniform (payload-free) alpha channel tiles one symbol ("m m m m…"),
      // which isLowVarietyNoise rejects so it never surfaces as a finding.
      if (!urls.length && (cleaned.length < 4 || isLowVarietyNoise(cleaned))) continue;
      // A recovered URL is decisive; otherwise score the readable core.
      const score = (urls.length ? 1000 : 0) + scoreDecodedPlaintext(cleaned) + cleaned.length * 0.01;
      if (!best || score > best.score) {
        const text = urls.length
          ? urls.join("\n") + (cleaned && cleaned !== urls.join(" ") ? `\n\n${cleaned}` : "")
          : cleaned;
        best = { text, urls, codeUnitSize, t, score };
      }
    }
  }

  if (!best) return null;
  return { text: best.text, urls: best.urls, codeUnitSize: best.codeUnitSize, t: best.t };
}

/**
 * Load an image from a file and return it as a canvas
 * @param file - Image file to load
 * @returns Promise resolving to canvas with the image
 */
export function loadImageAsCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas);
        } else {
          reject(new Error("Failed to get canvas context"));
        }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a file is a PNG (required for LSB steganography)
 * @param file - File to check
 * @returns true if file is PNG
 */
export function isPngFile(file: File): boolean {
  return file.type === "image/png";
}

import { DEFAULT_WORDLIST } from "../bruteForce";

export interface StegoSweepResult {
  bitPlane: number;
  channelOrder: string;
  direction: "row" | "col";
  bitOrder: "lsb-first" | "msb-first";
  decodedText: string;
  confidence: number;
  xorKey?: string;
}

/**
 * Decodes standard RGB LSB steganography with multi-depth, multi-order sweep.
 * Matches zsteg-style extraction depth.
 */
export function decodeRgbLsb(canvas: HTMLCanvasElement): StegoSweepResult[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const width = canvas.width;
  const height = canvas.height;

  const isPrintableChar = (code: number) => {
    return (code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9;
  };

  // Scores on real English-plaintext heuristics (space/vowel ratio, dictionary hits) rather than
  // raw "printable ratio" â€” bytesToText() below only ever returns strings it has already filtered
  // down to printable characters, so a printable-ratio-based score is structurally guaranteed to
  // sit near 1.0 for *any* short coincidental run of noise that happens to land in ASCII range,
  // which is exactly what was producing high-confidence false positives on real images.
  const calculateConfidence = (text: string) => scoreDecodedPlaintext(text) / 100;

  const bytesToText = (bytes: Uint8Array): string | null => {
    let result = "";
    for (let i = 0; i < bytes.length; i++) {
      const charCode = bytes[i];
      if (charCode === 0) break;
      if (isPrintableChar(charCode)) {
        result += String.fromCharCode(charCode);
      } else {
        if (result.length > 20) return result;
        break;
      }
    }

    // Require real variety: reject all-whitespace and repetitive filler like
    // "m m m m" that a flat channel yields (isLowVarietyNoise catches ≤2-glyph
    // and single-symbol-dominated runs the old size>1 check let through).
    if (result.length >= 6 && !/^[\s]+$/.test(result) && !isLowVarietyNoise(result)) {
      return result;
    }
    return null;
  };

  const xorBytes = (bytes: Uint8Array, key: string): Uint8Array => {
    const keyBytes = new TextEncoder().encode(key);
    const result = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return result;
  };

  // True when `text` is mostly `key` tiled over and over (e.g. "THERETHERETHERE"
  // or "P(FRETHERETHERE"), which is what XOR against a near-constant plane
  // yields. Removing the key leaves little behind. The check is case-sensitive
  // and the wordlist is uppercase, so a real lowercase message that merely
  // contains the word is not affected.
  const isRepeatedKey = (text: string, key: string): boolean => {
    const stripped = text.split(key).join("").replace(/\s+/g, "");
    return stripped.length < text.length * 0.5;
  };

  const results: StegoSweepResult[] = [];
  const maxPixels = Math.min(width * height, 100000);
  
  // 1. Bit depth: 0 to 3
  for (let plane = 0; plane <= 3; plane++) {
    // 2. Channel order: RGB permutations
    const channelPermutations = [
      { name: "rgb", indices: [0, 1, 2] },
      { name: "rbg", indices: [0, 2, 1] },
      { name: "gbr", indices: [1, 2, 0] },
      { name: "grb", indices: [1, 0, 2] },
      { name: "brg", indices: [2, 0, 1] },
      { name: "bgr", indices: [2, 1, 0] },
      { name: "r", indices: [0] },
      { name: "g", indices: [1] },
      { name: "b", indices: [2] },
      { name: "a", indices: [3] }
    ];

    for (const perm of channelPermutations) {
      // 3. Direction: Row-major and Column-major
      const directions: ("row" | "col")[] = ["row", "col"];

      for (const dir of directions) {
        const rawBits: number[] = [];
        for (let i = 0; i < maxPixels; i++) {
          let x, y;
          if (dir === "row") {
            x = i % width;
            y = Math.floor(i / width);
          } else {
            x = Math.floor(i / height);
            y = i % height;
          }

          if (x >= width || y >= height) continue;

          const offset = (y * width + x) * 4;
          for (const idx of perm.indices) {
            rawBits.push((data[offset + idx] >> plane) & 1);
            if (rawBits.length >= 40000) break;
          }
          if (rawBits.length >= 40000) break;
        }

        const byteCount = Math.floor(rawBits.length / 8);

        // Try both bit-packing conventions from the same collected bits (no extra pixel scan):
        // "lsb-first" treats the first sampled bit as bit 0 of the byte; "msb-first" treats it as
        // bit 7. Real-world LSB encoders split roughly evenly between these two conventions, and
        // testing only one (as this sweep previously did) silently misses every message written
        // with the other â€” it doesn't fail loudly, it just reconstructs plausible-looking noise.
        const packLsbFirst = (): Uint8Array => {
          const out = new Uint8Array(byteCount);
          for (let i = 0; i < byteCount; i++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) byte |= (rawBits[i * 8 + b] << b);
            out[i] = byte;
          }
          return out;
        };
        const packMsbFirst = (): Uint8Array => {
          const out = new Uint8Array(byteCount);
          for (let i = 0; i < byteCount; i++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) byte |= (rawBits[i * 8 + b] << (7 - b));
            out[i] = byte;
          }
          return out;
        };

        for (const bitOrder of ["lsb-first", "msb-first"] as const) {
          const rawBytes = bitOrder === "lsb-first" ? packLsbFirst() : packMsbFirst();

          // Try Plain Decode
          const plainText = bytesToText(rawBytes);
          if (plainText) {
            results.push({
              bitPlane: plane,
              channelOrder: perm.name.toUpperCase(),
              direction: dir,
              bitOrder,
              decodedText: plainText,
              confidence: calculateConfidence(plainText)
            });
          }

          // Try XOR Decode with Wordlist.
          // Skip near-constant planes: XOR of a constant byte with a key just
          // echoes the key, which produced phantom hits like "THERETHERETHERE"
          // (the word "THERE" is in the wordlist) on flat/saturated regions.
          const distinctBytes = new Set(rawBytes.slice(0, 512)).size;
          if (distinctBytes > 2) {
            for (const key of DEFAULT_WORDLIST.slice(0, 30)) {
              const xored = xorBytes(rawBytes, key);
              const xorText = bytesToText(xored);
              // Reject output that is just the key repeated (the constant-plane
              // failure mode above, in case a plane is only mostly-constant).
              if (xorText && !isRepeatedKey(xorText, key)) {
                const confidence = calculateConfidence(xorText);
                // High bar: XOR-against-wordlist is speculative and prone to
                // spelling short dictionary words out of noise, so only surface
                // genuinely strong plaintext.
                if (confidence > 0.75) {
                  results.push({
                    bitPlane: plane,
                    channelOrder: perm.name.toUpperCase(),
                    direction: dir,
                    bitOrder,
                    decodedText: xorText,
                    confidence,
                    xorKey: key
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Searches for plain printable ASCII strings at the end of the file
 * after typical image end markers (IEND for PNG, FF D9 for JPEG)
 */
export function detectTrailingBytes(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) {
        resolve(null);
        return;
      }
      const bytes = new Uint8Array(buffer);
      const len = bytes.length;

      let startIndex = -1;

      if (file.type === "image/png" || file.name.endsWith(".png")) {
        for (let i = len - 8; i >= 0; i--) {
          if (
            bytes[i] === 0x49 && 
            bytes[i + 1] === 0x45 && 
            bytes[i + 2] === 0x4E && 
            bytes[i + 3] === 0x44 
          ) {
            startIndex = i + 8; 
            break;
          }
        }
      } 
      else if (file.type === "image/jpeg" || file.name.endsWith(".jpg") || file.name.endsWith(".jpeg")) {
        for (let i = len - 2; i >= 0; i--) {
          if (bytes[i] === 0xFF && bytes[i + 1] === 0xD9) {
            startIndex = i + 2; 
            break;
          }
        }
      }
      else if (file.type === "image/gif" || file.name.endsWith(".gif")) {
        // GIF trailer is 0x3B (semicolon). Search from end for the last logical 0x3B.
        for (let i = len - 1; i >= 0; i--) {
          if (bytes[i] === 0x3B) {
            startIndex = i + 1;
            break;
          }
        }
      }
      else if (file.type === "image/bmp" || file.name.endsWith(".bmp")) {
        // BMP size is at offset 0x02, 4 bytes little-endian
        if (len > 14) {
          const bmpSize = bytes[2] | (bytes[3] << 8) | (bytes[4] << 16) | (bytes[5] << 24);
          if (len > bmpSize && bmpSize > 0) {
            startIndex = bmpSize;
          }
        }
      }
      else if (file.type === "image/webp" || file.name.endsWith(".webp")) {
        // WebP RIFF chunk size at offset 4 (little-endian). File size = chunk size + 8
        if (len > 12) {
          const riffSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
          const expectedSize = riffSize + 8;
          if (len > expectedSize && expectedSize > 0) {
            startIndex = expectedSize;
          }
        }
      }

      if (startIndex !== -1 && startIndex < len) {
        const trailingBytes = bytes.slice(startIndex);
        let trailingStr = "";
        let printableCount = 0;
        for (let i = 0; i < trailingBytes.length; i++) {
          const charCode = trailingBytes[i];
          if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13 || charCode === 9) {
            trailingStr += String.fromCharCode(charCode);
            printableCount++;
          }
        }
        if (trailingStr.trim().length >= 4 && printableCount / trailingBytes.length > 0.7) {
          resolve("RECOVERED FROM FILE TRAILING BYTES: " + trailingStr.trim());
          return;
        }
      }

      const lastBytesToScan = Math.min(len, 2048);
      let currentString = "";
      for (let i = len - lastBytesToScan; i < len; i++) {
        const charCode = bytes[i];
        if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13) {
          currentString += String.fromCharCode(charCode);
        } else {
          const cleanStr = currentString.trim();
          if (
            cleanStr.length >= 8 && 
            !cleanStr.includes("IEND") && 
            !cleanStr.includes("pHYs") && 
            !cleanStr.includes("tEXt") &&
            !cleanStr.includes("IDAT") &&
            !cleanStr.includes("iTXt")
          ) {
            resolve("RECOVERED EMBEDDED STRING: " + cleanStr);
            return;
          }
          currentString = "";
        }
      }
      const finalClean = currentString.trim();
      if (
        finalClean.length >= 8 && 
        !finalClean.includes("IEND") && 
        !finalClean.includes("pHYs") && 
        !finalClean.includes("tEXt") &&
        !finalClean.includes("IDAT") &&
        !finalClean.includes("iTXt")
      ) {
        resolve("RECOVERED EMBEDDED STRING: " + finalClean);
        return;
      }

      resolve(null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

export interface StegoForensicResult {
  type: "LSB" | "Trailing" | "Vendor" | "JSteg";
  bitPlane?: number;
  channelOrder?: string;
  direction?: "row" | "col";
  bitOrder?: "lsb-first" | "msb-first";
  decodedText: string;
  confidence: number;
  xorKey?: string;
}

/**
 * Master detection function that aggregates all steganography extraction methods
 */
export async function detectHiddenMessageInFile(
  file: File,
  canvas: HTMLCanvasElement
): Promise<StegoForensicResult[]> {
  const results: StegoForensicResult[] = [];

  // 1. Hidden-message detection, in order of specificity.
  //  (a) stylesuxx.github.io/steganography — RGB-LSB, MSB-first. This is the
  //      exact scheme behind "I hid it with that website"; tried FIRST so the
  //      real payload (e.g. a YouTube link) always ranks at the top.
  //  (b) steganography.js (Eigenschink) — the ALPHA-channel variant.
  //  (c) the vendored reference decoder's raw output, cleaned.
  const styleSuxx = decodeStylesuxx(canvas);
  const stegJs = decodeStegJs(canvas);
  const vendorRaw = decodeMessage(canvas);
  const vendorCleanUrls = vendorRaw ? extractUrls(vendorRaw) : [];
  const vendorClean = vendorRaw ? cleanStegPayload(vendorRaw) : "";

  if (styleSuxx) {
    results.push({
      type: "Vendor",
      decodedText: styleSuxx.text,
      confidence: styleSuxx.urls.length > 0 ? 1.0 : 0.92
    });
  }
  if (stegJs && (stegJs.urls.length > 0 || (stegJs.text.length >= 4 && !isLowVarietyNoise(stegJs.text)))) {
    results.push({
      type: "Vendor",
      decodedText: stegJs.text,
      confidence: stegJs.urls.length > 0 ? 0.98 : 0.9
    });
  } else if (vendorCleanUrls.length > 0 || (vendorClean.length >= 4 && !isLowVarietyNoise(vendorClean))) {
    const text = vendorCleanUrls.length > 0
      ? vendorCleanUrls.join("\n") + (vendorClean ? `\n\n${vendorClean}` : "")
      : vendorClean;
    results.push({
      type: "Vendor",
      decodedText: text,
      confidence: vendorCleanUrls.length > 0 ? 0.98 : 0.85
    });
  }

  // 2. Custom LSB sweep
  const lsbResults = decodeRgbLsb(canvas);
  lsbResults.forEach(r => {
    results.push({
      type: "LSB",
      bitPlane: r.bitPlane,
      channelOrder: r.channelOrder,
      direction: r.direction,
      bitOrder: r.bitOrder,
      decodedText: r.decodedText,
      confidence: r.confidence,
      xorKey: r.xorKey
    });
  });

  // 3. JSteg (JPEG DCT-coefficient LSB) detection
  const jstegResult = await extractJsteg(file);
  if (jstegResult) {
    let decodedText: string;
    try {
      decodedText = new TextDecoder("utf-8", { fatal: true }).decode(jstegResult.bytes);
    } catch {
      decodedText = Array.from(jstegResult.bytes).map(b => String.fromCharCode(b)).join("");
    }
    results.push({
      type: "JSteg",
      decodedText,
      confidence: 0.9
    });
  }

  // 4. Trailing bytes detection
  const trailingMsg = await detectTrailingBytes(file);
  if (trailingMsg) {
    // detectTrailingBytes returns a string prefixed with "RECOVERED FROM..."
    // We'll clean it up if it's there
    const cleanTrailing = trailingMsg.replace(/^RECOVERED FROM (FILE TRAILING BYTES|EMBEDDED STRING): /, "");
    results.push({
      type: "Trailing",
      decodedText: cleanTrailing,
      confidence: 0.8
    });
  }

  // Sort by confidence
  return results.sort((a, b) => b.confidence - a.confidence);
}

export interface ExifData {
  make?: string;
  model?: string;
  software?: string;
  dateTimeOriginal?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  imageWidth?: number;
  imageHeight?: number;
}

interface IFDEntry {
  type: number;
  count: number;
  valueOffset: number;
  tagOffset: number;
}

/**
 * Parsers JPEG EXIF data from an ArrayBuffer manually and safely.
 */
export function parseExif(arrayBuffer: ArrayBuffer): ExifData | null {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 8) return null;

  // Check if it is a JPEG (FF D8)
  if (view.getUint16(0, false) !== 0xFFD8) {
    return null;
  }

  let offset = 2;
  const length = view.byteLength;
  let app1Offset = -1;

  while (offset < length - 1) {
    const marker = view.getUint16(offset, false);
    if (marker === 0xFFE1) { // APP1 Marker
      app1Offset = offset;
      break;
    }
    if ((marker & 0xFF00) !== 0xFF00) {
      break;
    }
    const markerLength = view.getUint16(offset + 2, false);
    offset += 2 + markerLength;
  }

  if (app1Offset === -1) {
    return null;
  }

  // Inside APP1
  const exifHeaderOffset = app1Offset + 4;
  if (exifHeaderOffset + 6 > length) return null;

  // Check "Exif\0\0" (0x45 0x78 0x69 0x66 0x00 0x00)
  const isExif = 
    view.getUint8(exifHeaderOffset) === 0x45 &&
    view.getUint8(exifHeaderOffset + 1) === 0x78 &&
    view.getUint8(exifHeaderOffset + 2) === 0x69 &&
    view.getUint8(exifHeaderOffset + 3) === 0x66 &&
    view.getUint8(exifHeaderOffset + 4) === 0x00 &&
    view.getUint8(exifHeaderOffset + 5) === 0x00;

  if (!isExif) return null;

  const tiffHeaderOffset = exifHeaderOffset + 6;
  if (tiffHeaderOffset + 8 > length) return null;

  // Byte order: "II" (0x4949) or "MM" (0x4D4D)
  const byteOrderWord = view.getUint16(tiffHeaderOffset, false);
  let isLittleEndian = true;
  if (byteOrderWord === 0x4949) {
    isLittleEndian = true;
  } else if (byteOrderWord === 0x4D4D) {
    isLittleEndian = false;
  } else {
    return null;
  }

  // Check TIFF magic 0x002A
  const magic = view.getUint16(tiffHeaderOffset + 2, !isLittleEndian);
  if (magic !== 0x002A) return null;

  // Offset to first IFD (usually 8)
  const ifd0OffsetValue = view.getUint32(tiffHeaderOffset + 4, !isLittleEndian);
  const ifd0Offset = tiffHeaderOffset + ifd0OffsetValue;

  if (ifd0Offset + 2 > length) return null;

  const result: ExifData = {};

  function readIFD(ifdOffset: number): { [key: number]: IFDEntry } {
    const tags: { [key: number]: IFDEntry } = {};
    if (ifdOffset + 2 > length) return tags;
    const numEntries = view.getUint16(ifdOffset, !isLittleEndian);
    let entryOffset = ifdOffset + 2;

    for (let i = 0; i < numEntries; i++) {
      if (entryOffset + 12 > length) break;
      const tag = view.getUint16(entryOffset, !isLittleEndian);
      const type = view.getUint16(entryOffset + 2, !isLittleEndian);
      const count = view.getUint32(entryOffset + 4, !isLittleEndian);
      const valueOffset = view.getUint32(entryOffset + 8, !isLittleEndian);

      tags[tag] = { type, count, valueOffset, tagOffset: entryOffset };
      entryOffset += 12;
    }
    return tags;
  }

  function getTagValue(entry: IFDEntry, tagOffset: number): any {
    const type = entry.type;
    const count = entry.count;
    const valOffset = entry.valueOffset;

    // determine sizes: 1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL, 7=UNDEFINED, 9=SLONG, 10=SRATIONAL
    let bytesPerComp = 1;
    if (type === 3) bytesPerComp = 2;
    else if (type === 4 || type === 9) bytesPerComp = 4;
    else if (type === 5 || type === 10) bytesPerComp = 8;

    const totalBytes = bytesPerComp * count;
    let dataOffset = tiffHeaderOffset + valOffset;
    if (totalBytes <= 4) {
      dataOffset = tagOffset + 8;
    }

    if (dataOffset + totalBytes > length) return null;

    if (type === 2) { // ASCII
      let str = "";
      for (let i = 0; i < count; i++) {
        const charCode = view.getUint8(dataOffset + i);
        if (charCode === 0) break;
        str += String.fromCharCode(charCode);
      }
      return str.trim();
    }

    if (type === 3) { // SHORT
      if (count === 1) {
        return view.getUint16(dataOffset, !isLittleEndian);
      }
      const vals: number[] = [];
      for (let i = 0; i < count; i++) {
        vals.push(view.getUint16(dataOffset + i * 2, !isLittleEndian));
      }
      return vals;
    }

    if (type === 4 || type === 9) { // LONG or SLONG
      if (count === 1) {
        return type === 4 ? view.getUint32(dataOffset, !isLittleEndian) : view.getInt32(dataOffset, !isLittleEndian);
      }
      const vals: number[] = [];
      for (let i = 0; i < count; i++) {
        vals.push(type === 4 ? view.getUint32(dataOffset + i * 4, !isLittleEndian) : view.getInt32(dataOffset + i * 4, !isLittleEndian));
      }
      return vals;
    }

    if (type === 5 || type === 10) { // RATIONAL or SRATIONAL
      const parseRational = (offset: number) => {
        let num, den;
        if (type === 5) {
          num = view.getUint32(offset, !isLittleEndian);
          den = view.getUint32(offset + 4, !isLittleEndian);
        } else {
          num = view.getInt32(offset, !isLittleEndian);
          den = view.getInt32(offset + 4, !isLittleEndian);
        }
        return den === 0 ? 0 : num / den;
      };

      if (count === 1) {
        return parseRational(dataOffset);
      }
      const vals: number[] = [];
      for (let i = 0; i < count; i++) {
        vals.push(parseRational(dataOffset + i * 8));
      }
      return vals;
    }

    return null;
  }

  // Read IFD0 tags
  const ifd0Tags = readIFD(ifd0Offset);

  const makeEntry = ifd0Tags[0x010F];
  if (makeEntry) {
    result.make = getTagValue(makeEntry, makeEntry.tagOffset);
  }
  const modelEntry = ifd0Tags[0x0110];
  if (modelEntry) {
    result.model = getTagValue(modelEntry, modelEntry.tagOffset);
  }
  const softwareEntry = ifd0Tags[0x0131];
  if (softwareEntry) {
    result.software = getTagValue(softwareEntry, softwareEntry.tagOffset);
  }
  const widthEntry = ifd0Tags[0x0100];
  if (widthEntry) {
    result.imageWidth = getTagValue(widthEntry, widthEntry.tagOffset);
  }
  const heightEntry = ifd0Tags[0x0101];
  if (heightEntry) {
    result.imageHeight = getTagValue(heightEntry, heightEntry.tagOffset);
  }

  // Parse EXIF SubIFD if present
  const exifOffsetEntry = ifd0Tags[0x8769];
  if (exifOffsetEntry) {
    const exifOffsetVal = getTagValue(exifOffsetEntry, exifOffsetEntry.tagOffset);
    if (typeof exifOffsetVal === "number") {
      const exifIFDTags = readIFD(tiffHeaderOffset + exifOffsetVal);
      const dtoEntry = exifIFDTags[0x9003];
      if (dtoEntry) {
        result.dateTimeOriginal = getTagValue(dtoEntry, dtoEntry.tagOffset);
      }
      const xDimEntry = exifIFDTags[0xA002];
      if (xDimEntry) {
        result.imageWidth = getTagValue(xDimEntry, xDimEntry.tagOffset);
      }
      const yDimEntry = exifIFDTags[0xA003];
      if (yDimEntry) {
        result.imageHeight = getTagValue(yDimEntry, yDimEntry.tagOffset);
      }
    }
  }

  // Parse GPS SubIFD if present
  const gpsOffsetEntry = ifd0Tags[0x8825];
  if (gpsOffsetEntry) {
    const gpsOffsetVal = getTagValue(gpsOffsetEntry, gpsOffsetEntry.tagOffset);
    if (typeof gpsOffsetVal === "number") {
      const gpsIFDTags = readIFD(tiffHeaderOffset + gpsOffsetVal);
      
      const latRefEntry = gpsIFDTags[0x0001];
      const latEntry = gpsIFDTags[0x0002];
      const lonRefEntry = gpsIFDTags[0x0003];
      const lonEntry = gpsIFDTags[0x0004];

      if (latEntry && latRefEntry) {
        const latRef = getTagValue(latRefEntry, latRefEntry.tagOffset);
        const latVals = getTagValue(latEntry, latEntry.tagOffset);
        if (typeof latRef === "string" && Array.isArray(latVals) && latVals.length >= 3) {
          let lat = latVals[0] + latVals[1] / 60 + latVals[2] / 3600;
          if (latRef.toUpperCase() === "S") lat = -lat;
          result.gpsLatitude = lat;
        }
      }

      if (lonEntry && lonRefEntry) {
        const lonRef = getTagValue(lonRefEntry, lonRefEntry.tagOffset);
        const lonVals = getTagValue(lonEntry, lonEntry.tagOffset);
        if (typeof lonRef === "string" && Array.isArray(lonVals) && lonVals.length >= 3) {
          let lon = lonVals[0] + lonVals[1] / 60 + lonVals[2] / 3600;
          if (lonRef.toUpperCase() === "W") lon = -lon;
          result.gpsLongitude = lon;
        }
      }
    }
  }

  return result;
}

/**
 * Detects low-contrast marks (invisible ink) by applying contrast stretching
 * and channel difference analysis.
 * @param canvas - Source canvas
 * @returns Object containing enhanced canvas and confidence score
 */
export function detectInvisibleInk(canvas: HTMLCanvasElement): { enhancedCanvas: HTMLCanvasElement; confidence: number } {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Find min/max for each channel to perform global contrast stretching
  let minR = 255, maxR = 0;
  let minG = 255, maxG = 0;
  let minB = 255, maxB = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }

  // 2. Apply contrast stretching
  const rangeR = maxR - minR || 1;
  const rangeG = maxG - minG || 1;
  const rangeB = maxB - minB || 1;

  const enhancedCanvas = document.createElement("canvas");
  enhancedCanvas.width = width;
  enhancedCanvas.height = height;
  const enhancedCtx = enhancedCanvas.getContext("2d")!;
  const enhancedData = enhancedCtx.createImageData(width, height);
  const d = enhancedData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Basic contrast stretching
    d[i] = ((data[i] - minR) * 255) / rangeR;
    d[i + 1] = ((data[i + 1] - minG) * 255) / rangeG;
    d[i + 2] = ((data[i + 2] - minB) * 255) / rangeB;
    
    // Enhancement: highlight subtle differences between channels
    // This often reveals "ink" that was intended to match the paper color but has slightly different spectral properties
    const diff = Math.abs(data[i] - data[i+1]) + Math.abs(data[i+1] - data[i+2]) + Math.abs(data[i] - data[i+2]);
    if (diff > 0 && diff < 5) {
      // Slightly different but close values - possibly hidden content
      d[i] = Math.min(255, d[i] + 50);
      d[i + 1] = Math.max(0, d[i + 1] - 50);
    }

    d[i + 3] = data[i + 3];
  }

  enhancedCtx.putImageData(enhancedData, 0, 0);

  // 3. Confidence score heuristic
  // If the original average range was very small, it's highly likely something was hidden
  // and then compressed/clamped to a narrow range.
  const avgRange = (rangeR + rangeG + rangeB) / 3;
  let confidence = 0.1; // Baseline
  
  if (avgRange < 30) {
    confidence = 0.85 + (1 - avgRange / 30) * 0.15;
  } else if (avgRange < 80) {
    confidence = 0.4 + (1 - (avgRange - 30) / 50) * 0.45;
  }

  return { enhancedCanvas, confidence };
}

