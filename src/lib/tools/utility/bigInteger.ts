/**
 * BigInt utility for arbitrary precision conversions of text bytes.
 */

/**
 * Converts a text string to its arbitrary-precision BigInt string representation.
 * Each character's UTF-8 byte is accumulated into a large integer.
 */
export function textToBigInteger(text: string): string {
  if (!text) return "";
  const bytes = new TextEncoder().encode(text);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  if (!hex) return "0";
  return BigInt("0x" + hex).toString(10);
}

/**
 * Converts an arbitrary-precision BigInt decimal string back to a text string.
 */
export function bigIntegerToText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    // Attempt parsing as native BigInt
    const num = BigInt(trimmed);
    let hex = num.toString(16);
    if (hex.length % 2 !== 0) {
      hex = "0" + hex;
    }
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch (err: any) {
    throw new Error(`Invalid big integer value: ${err.message}`);
  }
}
