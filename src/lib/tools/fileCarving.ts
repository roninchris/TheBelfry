
/**
 * File carving utility (binwalk-style)
 * Scans byte streams for embedded files based on magic byte signatures.
 */

export interface CarvedFile {
  type: string;
  extension: string;
  offset: number;
  length: number | null;
  description: string;
}

const SIGNATURES = [
  { name: "PNG", ext: "png", sig: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { name: "JPEG", ext: "jpg", sig: [0xFF, 0xD8, 0xFF] },
  { name: "GIF", ext: "gif", sig: [0x47, 0x49, 0x46, 0x38] }, // GIF87a or GIF89a
  { name: "ZIP/Office", ext: "zip", sig: [0x50, 0x4B, 0x03, 0x04] },
  { name: "PDF", ext: "pdf", sig: [0x25, 0x50, 0x44, 0x46] },
  { name: "RAR", ext: "rar", sig: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] },
  { name: "7z", ext: "7z", sig: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] },
  { name: "BMP", ext: "bmp", sig: [0x42, 0x4D] },
  { name: "GZIP", ext: "gz", sig: [0x1F, 0x8B, 0x08] },
];

/**
 * Scans an ArrayBuffer for embedded files.
 */
export function carveEmbeddedFiles(buffer: ArrayBuffer): CarvedFile[] {
  const bytes = new Uint8Array(buffer);
  const results: CarvedFile[] = [];

  for (let i = 0; i < bytes.length - 8; i++) {
    for (const s of SIGNATURES) {
      let match = true;
      for (let j = 0; j < s.sig.length; j++) {
        if (bytes[i + j] !== s.sig[j]) {
          match = false;
          break;
        }
      }

      if (match) {
        // Skip match at offset 0 (unless we want to report the container itself, but usually carving implies "inside")
        // Actually, for binwalk-style, reporting offset 0 is also fine, but the requirement says "at an offset other than 0".
        if (i === 0) continue;

        let length: number | null = null;
        
        // Attempt to determine length for common formats
        if (s.name === "PNG") {
          length = findPngLength(bytes, i);
        } else if (s.name === "JPEG") {
          length = findJpegLength(bytes, i);
        } else if (s.name === "ZIP/Office") {
          length = findZipLength(bytes, i);
        } else if (s.name === "PDF") {
          length = findPdfLength(bytes, i);
        }

        results.push({
          type: s.name,
          extension: s.ext,
          offset: i,
          length,
          description: `Embedded ${s.name} file found at offset 0x${i.toString(16).toUpperCase()}`
        });
      }
    }
  }

  return results;
}

function findPngLength(bytes: Uint8Array, start: number): number | null {
  // Search for IEND chunk: 00 00 00 00 49 45 4E 44 AE 42 60 82
  const iendSig = [0x49, 0x45, 0x4E, 0x44];
  for (let i = start; i < bytes.length - 4; i++) {
    let match = true;
    for (let j = 0; j < 4; j++) {
      if (bytes[i + j] !== iendSig[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return (i + 4 + 4) - start; // IEND name (4) + CRC (4)
    }
  }
  return null;
}

function findJpegLength(bytes: Uint8Array, start: number): number | null {
  // Search for EOI (End of Image): FF D9
  for (let i = start + 2; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD9) {
      return (i + 2) - start;
    }
  }
  return null;
}

function findZipLength(bytes: Uint8Array, start: number): number | null {
  // Search for End of Central Directory Record (EOCD): 50 4B 05 06
  const eocdSig = [0x50, 0x4B, 0x05, 0x06];
  for (let i = bytes.length - 22; i >= start; i--) { // EOCD is at least 22 bytes
    let match = true;
    for (let j = 0; j < 4; j++) {
      if (bytes[i + j] !== eocdSig[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      // Length is i + 22 + comment length (read from bytes[i+20] and bytes[i+21])
      const commentLen = bytes[i + 20] | (bytes[i + 21] << 8);
      return (i + 22 + commentLen) - start;
    }
  }
  return null;
}

function findPdfLength(bytes: Uint8Array, start: number): number | null {
  // Search for %%EOF
  const eofSig = [0x25, 0x25, 0x45, 0x4F, 0x46];
  for (let i = bytes.length - 5; i >= start; i--) {
    let match = true;
    for (let j = 0; j < 5; j++) {
      if (bytes[i + j] !== eofSig[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      // Check for trailing whitespace/newlines which are often part of PDF
      let end = i + 5;
      while (end < bytes.length && (bytes[end] === 0x0A || bytes[end] === 0x0D || bytes[end] === 0x20)) {
        end++;
      }
      return end - start;
    }
  }
  return null;
}
