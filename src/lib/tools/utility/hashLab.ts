/** Hash Lab - synchronous implementations of MD5, SHA-1, SHA-256, and SHA-512 */

import type { ToolOptions, TransformOutput } from "../types";

// --- Safe Addition for MD5 ---
function safeAdd(x: number, y: number): number {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

/**
 * Computes MD5 hash.
 */
export function md5(str: string): string {
  const k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ];

  const r = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];

  const words: number[] = [];
  const utf8 = unescape(encodeURIComponent(str));
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= utf8.charCodeAt(i) << ((i % 4) * 8);
  }
  const len = utf8.length * 8;
  words[len >> 5] |= 0x80 << (len % 32);
  words[(((len + 64) >>> 9) << 4) + 14] = len;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;

  for (let i = 0; i < words.length; i += 16) {
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;

    for (let j = 0; j < 64; j++) {
      let f = 0;
      let g = 0;

      if (j < 16) {
        f = (b & c) | (~b & d);
        g = j;
      } else if (j < 32) {
        f = (d & b) | (~d & c);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = b ^ c ^ d;
        g = (3 * j + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * j) % 16;
      }

      const temp = d;
      d = c;
      c = b;
      const val = safeAdd(safeAdd(safeAdd(a, f), k[j]), words[i + g] || 0);
      const rotated = (val << r[j]) | (val >>> (32 - r[j]));
      b = safeAdd(b, rotated);
      a = temp;
    }

    h0 = safeAdd(h0, a);
    h1 = safeAdd(h1, b);
    h2 = safeAdd(h2, c);
    h3 = safeAdd(h3, d);
  }

  const hex = (num: number) => {
    let out = "";
    for (let i = 0; i < 4; i++) {
      const byte = (num >> (i * 8)) & 0xff;
      out += byte.toString(16).padStart(2, "0");
    }
    return out;
  };

  return hex(h0) + hex(h1) + hex(h2) + hex(h3);
}

/**
 * Computes SHA-1 hash.
 */
export function sha1(str: string): string {
  const utf8 = unescape(encodeURIComponent(str));
  const block: number[] = [];
  const len = utf8.length * 8;
  for (let i = 0; i < utf8.length; i++) {
    block[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  block[utf8.length >> 2] |= 0x80 << (24 - (utf8.length % 4) * 8);
  block[(((utf8.length + 8) >> 6) + 1) * 16 - 1] = len;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let i = 0; i < block.length; i += 16) {
    const w = new Uint32Array(80);
    for (let j = 0; j < 16; j++) {
      w[j] = block[i + j] || 0;
    }
    for (let j = 16; j < 80; j++) {
      const val = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (val << 1) | (val >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let j = 0; j < 80; j++) {
      let f = 0;
      let k = 0;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const hex = (val: number) => val.toString(16).padStart(8, "0");
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

/**
 * Computes SHA-256 hash.
 */
export function sha256(str: string): string {
  const utf8 = unescape(encodeURIComponent(str));
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const wordsLength = ((utf8.length + 8) >> 6) + 1;
  const blocks = new Uint32Array(wordsLength * 16);

  for (let i = 0; i < utf8.length; i++) {
    blocks[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  blocks[utf8.length >> 2] |= 0x80 << (24 - (utf8.length % 4) * 8);
  blocks[blocks.length - 1] = utf8.length * 8;

  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  for (let i = 0; i < blocks.length; i += 16) {
    const w = new Uint32Array(64);
    for (let j = 0; j < 16; j++) {
      w[j] = blocks[i + j];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  const result: string[] = [];
  for (let i = 0; i < 8; i++) {
    result.push(hash[i].toString(16).padStart(8, "0"));
  }
  return result.join("");
}

/**
 * Computes SHA-512 hash using 64-bit BigInt.
 */
export function sha512(str: string): string {
  const utf8 = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) {
    bytes[i] = utf8.charCodeAt(i) & 0xff;
  }

  const len = BigInt(bytes.length) * 8n;
  const paddingLen = (128 - ((bytes.length + 17) % 128)) % 128;
  const padded = new Uint8Array(bytes.length + 1 + paddingLen + 16);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  for (let i = 0; i < 8; i++) {
    padded[padded.length - 1 - i] = Number((len >> BigInt(i * 8)) & 0xffn);
  }

  const words = new BigUint64Array(padded.length / 8);
  const view = new DataView(padded.buffer);
  for (let i = 0; i < words.length; i++) {
    words[i] = view.getBigUint64(i * 8, false);
  }

  const h = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
  ];

  const k = [
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
    0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
    0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
    0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf69263bn,
    0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc771b690an,
    0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
    0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
    0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
    0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
    0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
    0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
    0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
    0x19a4c11618574f47n, 0x1e376c08511a1d9en, 0x2748774c2c13dbf2n, 0x34b0bcb5e19f43e8n,
    0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
    0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
    0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
    0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
    0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
    0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
    0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
  ];

  const mask64 = 0xffffffffffffffffn;
  const rotr = (val: bigint, shift: bigint) => ((val >> shift) | (val << (64n - shift))) & mask64;

  for (let i = 0; i < words.length; i += 16) {
    const w = new BigUint64Array(80);
    for (let j = 0; j < 16; j++) {
      w[j] = words[i + j];
    }
    for (let j = 16; j < 80; j++) {
      const s0 = rotr(w[j - 15], 1n) ^ rotr(w[j - 15], 8n) ^ (w[j - 15] >> 7n);
      const s1 = rotr(w[j - 2], 19n) ^ rotr(w[j - 2], 61n) ^ (w[j - 2] >> 6n);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) & mask64;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let h_val = h[7];

    for (let j = 0; j < 80; j++) {
      const S1 = rotr(e, 14n) ^ rotr(e, 18n) ^ rotr(e, 41n);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h_val + S1 + ch + k[j] + w[j]) & mask64;
      const S0 = rotr(a, 28n) ^ rotr(a, 34n) ^ rotr(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & mask64;

      h_val = g;
      g = f;
      f = e;
      e = (d + temp1) & mask64;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & mask64;
    }

    h[0] = (h[0] + a) & mask64;
    h[1] = (h[1] + b) & mask64;
    h[2] = (h[2] + c) & mask64;
    h[3] = (h[3] + d) & mask64;
    h[4] = (h[4] + e) & mask64;
    h[5] = (h[5] + f) & mask64;
    h[6] = (h[6] + g) & mask64;
    h[7] = (h[7] + h_val) & mask64;
  }

  return h.map(val => val.toString(16).padStart(16, "0")).join("");
}

export function hashLabEncode(text: string, options?: ToolOptions): TransformOutput {
  const algo = (options?.algorithm as "MD5" | "SHA-1" | "SHA-256" | "SHA-512") || "SHA-256";

  switch (algo) {
    case "MD5":
      return md5(text);
    case "SHA-1":
      return sha1(text);
    case "SHA-256":
      return sha256(text);
    case "SHA-512":
      return sha512(text);
    default:
      throw new Error(`Unsupported hash algorithm: ${algo}`);
  }
}

export function hashLabDecode(text: string, options?: ToolOptions): TransformOutput {
  throw new Error("Hash functions are one-way cryptographic algorithms and cannot be decoded/reversed.");
}
