/** ASCII decimal encode/decode — relocated from EncodingLab.tsx */
export function textToAscii(str: string): string {
  return str
    .split("")
    .map((c) => c.charCodeAt(0).toString(10))
    .join(", ");
}

export function asciiToText(ascii: string): string {
  try {
    const parts = ascii.split(/[\s,]+/);
    return parts
      .map((p) => {
        const val = parseInt(p, 10);
        return isNaN(val) ? "" : String.fromCharCode(val);
      })
      .join("");
  } catch {
    return "ERROR: Invalid ASCII decimal stream";
  }
}

export const asciiEncode = textToAscii;
export const asciiDecode = asciiToText;
