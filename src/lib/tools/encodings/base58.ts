/** Base58 encode/decode — ported from CyberChef */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(str: string): string {
  if (!str) return "";
  const input = new TextEncoder().encode(str);
  const result: number[] = [];

  let zeroPrefix = 0;
  for (let i = 0; i < input.length && input[i] === 0; i++) {
    zeroPrefix++;
  }

  input.forEach((b) => {
    let carry = b;
    for (let i = 0; i < result.length; i++) {
      carry += result[i] << 8;
      result[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      result.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  });

  let encoded = result
    .map((b) => ALPHABET[b])
    .reverse()
    .join("");

  while (zeroPrefix--) {
    encoded = ALPHABET[0] + encoded;
  }

  return encoded;
}

export function base58Decode(str: string): string {
  if (!str) return "";

  // Validate each character against the alphabet
  for (let i = 0; i < str.length; i++) {
    if (ALPHABET.indexOf(str[i]) === -1) {
      throw new Error(`Invalid Base58 character '${str[i]}' at position ${i}`);
    }
  }

  let zeroPrefix = 0;
  for (let i = 0; i < str.length && str[i] === ALPHABET[0]; i++) {
    zeroPrefix++;
  }

  const result: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const index = ALPHABET.indexOf(str[i]);
    let carry = index;
    for (let j = 0; j < result.length; j++) {
      carry += result[j] * 58;
      result[j] = carry & 0xff;
      carry = carry >> 8;
    }
    while (carry > 0) {
      result.push(carry & 0xff);
      carry = carry >> 8;
    }
  }

  while (zeroPrefix--) {
    result.push(0);
  }

  const bytes = new Uint8Array(result.reverse());
  return new TextDecoder().decode(bytes);
}
