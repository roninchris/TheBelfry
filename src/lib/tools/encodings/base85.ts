/** Base85 (Ascii85 / Adobe variant) encode/decode — ported from CyberChef */

const ALPHABET = Array.from({ length: 85 }, (_, i) => String.fromCharCode(33 + i)).join("");
const ALL_ZERO_GROUP_CHAR = "z";

export function base85Encode(str: string): string {
  if (!str) return "";
  const input = new TextEncoder().encode(str);
  let result = "";

  for (let i = 0; i < input.length; i += 4) {
    const block = (
      ((input[i])          << 24) +
      ((input[i + 1] || 0) << 16) +
      ((input[i + 2] || 0) << 8)  +
      ((input[i + 3] || 0))
    ) >>> 0;

    // Standard Ascii85: block of 4 zeros is encoded as 'z' ONLY if it's a full block (no padding)
    if (block === 0 && input.length >= i + 4) {
      result += ALL_ZERO_GROUP_CHAR;
    } else {
      let digits: number[] = [];
      let temp = block;
      for (let j = 0; j < 5; j++) {
        digits.push(temp % 85);
        temp = Math.floor(temp / 85);
      }
      digits = digits.reverse();

      if (input.length < i + 4) {
        // Splice out trailing digits for padded block
        digits.splice(input.length - (i + 4), 4);
      }

      result += digits.map((digit) => ALPHABET[digit]).join("");
    }
  }

  return `<~${result}~>`;
}

export function base85Decode(str: string): string {
  if (!str) return "";

  let input = str.trim();
  // Strip delimiters if present
  if (input.startsWith("<~") && input.endsWith("~>")) {
    input = input.slice(2, -2);
  }

  // Clean input and validate characters
  let cleaned = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    // Ignore whitespaces/newlines/tabs
    if (/\s/.test(char)) {
      continue;
    }
    if (char === ALL_ZERO_GROUP_CHAR || ALPHABET.indexOf(char) !== -1) {
      cleaned += char;
    } else {
      throw new Error(`Invalid Base85 character '${char}' at position ${i}`);
    }
  }

  const result: number[] = [];
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] === ALL_ZERO_GROUP_CHAR) {
      result.push(0, 0, 0, 0);
      i++;
    } else {
      const digits: number[] = [];
      const chunkLen = Math.min(5, cleaned.length - i);

      for (let j = 0; j < 5; j++) {
        if (j < chunkLen) {
          const char = cleaned[i + j];
          const idx = ALPHABET.indexOf(char);
          if (idx === -1) {
            throw new Error(`Invalid character '${char}' in chunk at position ${i + j}`);
          }
          digits.push(idx);
        } else {
          // Pad with 'u' (value 84)
          digits.push(84);
        }
      }

      const block =
        digits[0] * 52200625 +
        digits[1] * 614125 +
        digits[2] * 7225 +
        digits[3] * 85 +
        digits[4];

      const blockBytes = [
        (block >> 24) & 0xff,
        (block >> 16) & 0xff,
        (block >> 8) & 0xff,
        block & 0xff,
      ];

      if (chunkLen < 5) {
        // Splice out padded bytes
        blockBytes.splice(chunkLen - 1, 5 - chunkLen);
      }

      result.push(...blockBytes);
      i += chunkLen;
    }
  }

  return new TextDecoder().decode(new Uint8Array(result));
}
