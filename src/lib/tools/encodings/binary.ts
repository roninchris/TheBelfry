/** Binary encode/decode — relocated from EncodingLab.tsx */
export function textToBinary(str: string): string {
  return str
    .split("")
    .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
    .join(" ");
}

export function binaryToText(bin: string): string {
  try {
    const cleaned = bin.replace(/[^01]/g, "");
    if (!cleaned) return "";
    const bytes = [];
    for (let i = 0; i < cleaned.length; i += 8) {
      bytes.push(parseInt(cleaned.slice(i, i + 8), 2));
    }
    return bytes.map((b) => (isNaN(b) ? "" : String.fromCharCode(b))).join("");
  } catch {
    return "ERROR: Invalid binary stream";
  }
}

export const binaryEncode = textToBinary;
export const binaryDecode = binaryToText;
