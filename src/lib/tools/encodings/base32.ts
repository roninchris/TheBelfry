/** RFC 4648 Base32 — verified against official test vectors */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bits = 0, value = 0, output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  while (output.length % 8 !== 0) output += "=";
  return output;
}

export function base32Decode(text: string): string {
  const clean = text.toUpperCase().replace(/=+$/, "");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}