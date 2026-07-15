/** Hexadecimal encode/decode — relocated from EncodingLab.tsx */
export function textToHex(str: string): string {
  return str
    .split("")
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

export function hexToText(hex: string): string {
  try {
    const cleaned = hex.replace(/[^0-9A-Fa-f]/g, "");
    if (!cleaned) return "";
    const bytes = [];
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
    }
    return bytes.map((b) => (isNaN(b) ? "" : String.fromCharCode(b))).join("");
  } catch {
    return "ERROR: Invalid hex stream";
  }
}

export const hexEncode = textToHex;
export const hexDecode = hexToText;
