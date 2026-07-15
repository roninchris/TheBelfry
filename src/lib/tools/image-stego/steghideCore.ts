/**
 * Shared low-level primitives ported from steghide 0.5.1 (GPLv2, Stefan Hetzl), reimplemented
 * in TypeScript from the public source (github.com/StefanoDeVuono/steghide, src/RandomSource.cc,
 * PseudoRandomSource.{h,cc}, Selector.cc, EmbData.{h,cc}). Extraction only — no embedding.
 *
 * Passphrase -> seed: MD5(passphrase), then the 128-bit digest is split into four 32-bit
 * big-endian words which are XORed together into a single 32-bit seed (Selector::Selector).
 *
 * Seed -> permutation: a linear congruential generator (PseudoRandomSource: Value = A*Value + C
 * mod 2^32, A=1367208549, C=1) drives a lazily-computed Fisher-Yates permutation over the cover
 * file's sample indices (Selector::calculate). Steghide's real implementation uses a sparse
 * X/Y/hash-map structure purely as a memory optimization so it never has to allocate an array the
 * size of the whole cover file; a plain lazy Fisher-Yates using a JS Map produces an identical
 * sequence of swaps from the same PRNG draws, so that's what's implemented here.
 */
// --- Byte-oriented MD5 (RFC 1321) ---
// A raw-bytes-in/raw-bytes-out MD5 is needed (rather than hashLab's string-in/hex-out `md5()`)
// because the key-derivation chaining below hashes raw binary intermediate digests concatenated
// with the passphrase — round-tripping that through a UTF-8 string encoder would corrupt any
// digest byte above 0x7F.
function md5SafeAdd(x: number, y: number): number {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}
function md5RotateLeft(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c));
}
function md5Cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  return md5SafeAdd(md5RotateLeft(md5SafeAdd(md5SafeAdd(a, q), md5SafeAdd(x, t)), s), b);
}
function md5FF(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return md5Cmn((b & c) | (~b & d), a, b, x, s, t);
}
function md5GG(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return md5Cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function md5HH(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return md5Cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5II(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return md5Cmn(c ^ (b | ~d), a, b, x, s, t);
}

/** MD5 over raw bytes, returning the 16-byte digest. */
export function md5Raw(input: Uint8Array): Uint8Array {
  const bitLen = input.length * 8;
  const wordCount = (((input.length + 8) >> 6) + 1) * 16;
  const words = new Int32Array(wordCount);
  for (let i = 0; i < input.length; i++) {
    words[i >> 2] |= input[i] << ((i % 4) * 8);
  }
  words[input.length >> 2] |= 0x80 << ((input.length % 4) * 8);
  words[wordCount - 2] = bitLen;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

  for (let i = 0; i < words.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;

    a = md5FF(a, b, c, d, words[i + 0], 7, -680876936);
    d = md5FF(d, a, b, c, words[i + 1], 12, -389564586);
    c = md5FF(c, d, a, b, words[i + 2], 17, 606105819);
    b = md5FF(b, c, d, a, words[i + 3], 22, -1044525330);
    a = md5FF(a, b, c, d, words[i + 4], 7, -176418897);
    d = md5FF(d, a, b, c, words[i + 5], 12, 1200080426);
    c = md5FF(c, d, a, b, words[i + 6], 17, -1473231341);
    b = md5FF(b, c, d, a, words[i + 7], 22, -45705983);
    a = md5FF(a, b, c, d, words[i + 8], 7, 1770035416);
    d = md5FF(d, a, b, c, words[i + 9], 12, -1958414417);
    c = md5FF(c, d, a, b, words[i + 10], 17, -42063);
    b = md5FF(b, c, d, a, words[i + 11], 22, -1990404162);
    a = md5FF(a, b, c, d, words[i + 12], 7, 1804603682);
    d = md5FF(d, a, b, c, words[i + 13], 12, -40341101);
    c = md5FF(c, d, a, b, words[i + 14], 17, -1502002290);
    b = md5FF(b, c, d, a, words[i + 15], 22, 1236535329);

    a = md5GG(a, b, c, d, words[i + 1], 5, -165796510);
    d = md5GG(d, a, b, c, words[i + 6], 9, -1069501632);
    c = md5GG(c, d, a, b, words[i + 11], 14, 643717713);
    b = md5GG(b, c, d, a, words[i + 0], 20, -373897302);
    a = md5GG(a, b, c, d, words[i + 5], 5, -701558691);
    d = md5GG(d, a, b, c, words[i + 10], 9, 38016083);
    c = md5GG(c, d, a, b, words[i + 15], 14, -660478335);
    b = md5GG(b, c, d, a, words[i + 4], 20, -405537848);
    a = md5GG(a, b, c, d, words[i + 9], 5, 568446438);
    d = md5GG(d, a, b, c, words[i + 14], 9, -1019803690);
    c = md5GG(c, d, a, b, words[i + 3], 14, -187363961);
    b = md5GG(b, c, d, a, words[i + 8], 20, 1163531501);
    a = md5GG(a, b, c, d, words[i + 13], 5, -1444681467);
    d = md5GG(d, a, b, c, words[i + 2], 9, -51403784);
    c = md5GG(c, d, a, b, words[i + 7], 14, 1735328473);
    b = md5GG(b, c, d, a, words[i + 12], 20, -1926607734);

    a = md5HH(a, b, c, d, words[i + 5], 4, -378558);
    d = md5HH(d, a, b, c, words[i + 8], 11, -2022574463);
    c = md5HH(c, d, a, b, words[i + 11], 16, 1839030562);
    b = md5HH(b, c, d, a, words[i + 14], 23, -35309556);
    a = md5HH(a, b, c, d, words[i + 1], 4, -1530992060);
    d = md5HH(d, a, b, c, words[i + 4], 11, 1272893353);
    c = md5HH(c, d, a, b, words[i + 7], 16, -155497632);
    b = md5HH(b, c, d, a, words[i + 10], 23, -1094730640);
    a = md5HH(a, b, c, d, words[i + 13], 4, 681279174);
    d = md5HH(d, a, b, c, words[i + 0], 11, -358537222);
    c = md5HH(c, d, a, b, words[i + 3], 16, -722521979);
    b = md5HH(b, c, d, a, words[i + 6], 23, 76029189);
    a = md5HH(a, b, c, d, words[i + 9], 4, -640364487);
    d = md5HH(d, a, b, c, words[i + 12], 11, -421815835);
    c = md5HH(c, d, a, b, words[i + 15], 16, 530742520);
    b = md5HH(b, c, d, a, words[i + 2], 23, -995338651);

    a = md5II(a, b, c, d, words[i + 0], 6, -198630844);
    d = md5II(d, a, b, c, words[i + 7], 10, 1126891415);
    c = md5II(c, d, a, b, words[i + 14], 15, -1416354905);
    b = md5II(b, c, d, a, words[i + 5], 21, -57434055);
    a = md5II(a, b, c, d, words[i + 12], 6, 1700485571);
    d = md5II(d, a, b, c, words[i + 3], 10, -1894986606);
    c = md5II(c, d, a, b, words[i + 10], 15, -1051523);
    b = md5II(b, c, d, a, words[i + 1], 21, -2054922799);
    a = md5II(a, b, c, d, words[i + 8], 6, 1873313359);
    d = md5II(d, a, b, c, words[i + 15], 10, -30611744);
    c = md5II(c, d, a, b, words[i + 6], 15, -1560198380);
    b = md5II(b, c, d, a, words[i + 13], 21, 1309151649);
    a = md5II(a, b, c, d, words[i + 4], 6, -145523070);
    d = md5II(d, a, b, c, words[i + 11], 10, -1120210379);
    c = md5II(c, d, a, b, words[i + 2], 15, 718787259);
    b = md5II(b, c, d, a, words[i + 9], 21, -343485551);

    a = md5SafeAdd(a, oa);
    b = md5SafeAdd(b, ob);
    c = md5SafeAdd(c, oc);
    d = md5SafeAdd(d, od);
  }

  const out = new Uint8Array(16);
  const words4 = [a, b, c, d];
  for (let w = 0; w < 4; w++) {
    for (let i = 0; i < 4; i++) {
      out[w * 4 + i] = (words4[w] >> (i * 8)) & 0xff;
    }
  }
  return out;
}

/** PseudoRandomSource: LCG with steghide's exact constants. */
export class SteghideLcg {
  private value: number;
  constructor(seed: number) {
    this.value = seed >>> 0;
  }
  /** Returns a value in [0, n). */
  getValue(n: number): number {
    // Value = A*Value + C (mod 2^32), done via BigInt to avoid float precision loss on the multiply.
    const A = 1367208549n;
    const C = 1n;
    const MOD = 4294967296n; // 2^32
    const next = (A * BigInt(this.value) + C) % MOD;
    this.value = Number(next);
    return Math.floor((n * this.value) / 4294967296);
  }
}

/**
 * Derives steghide's 32-bit permutation seed from a passphrase. Each 32-bit word is read
 * little-endian from the MD5 digest bytes — following from BitString::getValue's convention
 * (bit 0 of byte 0 is the LSB of the resulting value, so byte 0 lands in the low byte of the word,
 * not the high byte a big-endian reading would put it in).
 */
export function derivePassphraseSeed(passphrase: string): number {
  const bytes = md5Raw(new TextEncoder().encode(passphrase));
  let seed = 0;
  for (let i = 0; i < 4; i++) {
    const word = bytes[i * 4] | (bytes[i * 4 + 1] << 8) | (bytes[i * 4 + 2] << 16) | (bytes[i * 4 + 3] << 24);
    seed ^= word;
  }
  return (seed >>> 0);
}

/**
 * Derives `totalBytes` of key material from a passphrase using MD5 hash-stretching
 * (D1 = MD5(pw), D2 = MD5(D1 || pw), D3 = MD5(D2 || pw), ... — the classic mcrypt/libmhash-style
 * "keygen" construction, the same shape as OpenSSL's legacy EVP_BytesToKey with an MD5 digest and
 * no salt). This is a best-effort reconstruction of steghide's MHashKeyGen behavior — the exact
 * digest/iteration libmhash used internally isn't verifiable without the original binary, so this
 * is not guaranteed to reproduce the real tool's derived key bit-for-bit; see the CRC32 check in
 * the caller, which will catch a KDF mismatch rather than silently returning garbage.
 */
export function deriveKeyMaterial(passphrase: string, totalBytes: number): Uint8Array {
  const pwBytes = new TextEncoder().encode(passphrase);
  const out = new Uint8Array(totalBytes);
  let filled = 0;
  let prevDigest = new Uint8Array(0);
  while (filled < totalBytes) {
    const input = new Uint8Array(prevDigest.length + pwBytes.length);
    input.set(prevDigest, 0);
    input.set(pwBytes, prevDigest.length);
    prevDigest = md5Raw(input);
    const take = Math.min(prevDigest.length, totalBytes - filled);
    out.set(prevDigest.subarray(0, take), filled);
    filled += take;
  }
  return out;
}

/**
 * Simple sequential LSB-first bit reader over an in-memory byte buffer (for parsing decrypted
 * EmbData). Matches steghide's BitString convention (BITPOS(n) = n % 8, i.e. bit 0 of a byte is
 * read first) — an earlier version of this reader read MSB-first per byte, which was wrong.
 */
export class LsbBitReader {
  private bytes: Uint8Array;
  private bitPos = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  get bitsConsumed(): number {
    return this.bitPos;
  }

  readBit(): number {
    const byteIdx = this.bitPos >> 3;
    const bitIdx = this.bitPos % 8;
    this.bitPos++;
    if (byteIdx >= this.bytes.length) throw new Error("Ran out of data while parsing steghide payload");
    return (this.bytes[byteIdx] >> bitIdx) & 1;
  }

  // LSB-first, matching steghide's BitString::getValue (see SteghideBitReader.readUInt above).
  readUInt(nbits: number): number {
    let value = 0;
    for (let i = 0; i < nbits; i++) value |= this.readBit() << i;
    return value >>> 0;
  }

  readCString(maxLen = 4096): string {
    let str = "";
    for (let i = 0; i < maxLen; i++) {
      const byte = this.readUInt(8);
      if (byte === 0) return str;
      str += String.fromCharCode(byte);
    }
    return str;
  }

  readBytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = this.readUInt(8);
    return out;
  }
}

/** Lazy Fisher-Yates permutation over [0, maximum) driven by the given PRNG (Selector::calculate). */
export class SteghideSelector {
  private maximum: number;
  private prng: SteghideLcg;
  private touched = new Map<number, number>();
  private computedUpTo = 0;

  constructor(maximum: number, prng: SteghideLcg) {
    this.maximum = maximum;
    this.prng = prng;
  }

  private get(pos: number): number {
    return this.touched.has(pos) ? this.touched.get(pos)! : pos;
  }

  at(i: number): number {
    if (i >= this.maximum) throw new Error("Selector index out of range");
    while (this.computedUpTo <= i) {
      const j = this.computedUpTo;
      const k = j + this.prng.getValue(this.maximum - j);
      const kVal = this.get(k);
      const jVal = this.get(j);
      this.touched.set(j, kVal);
      this.touched.set(k, jVal);
      this.computedUpTo++;
    }
    return this.get(i);
  }
}

/**
 * Per-cover-format constants steghide's CvrStgFile subclasses set (JpegFile.h, WavFile.h, AuFile.h,
 * BmpFile.h): each *embedded value* (0..embValueModulus-1) is the modular sum of `samplesPerVertex`
 * consecutive permuted cover samples' individual values (`calcEValue`) — NOT one sample per bit, as
 * an earlier version of this reader assumed. Getting this wrong doesn't throw or degrade gracefully;
 * it just makes every bit after the first wrong, so the header never matches and extraction silently
 * "finds nothing" on real files.
 */
export interface CoverFormatSpec {
  samplesPerVertex: number;
  embValueModulus: number;
  calcEValue: (rawSampleValue: number) => number;
}

/** JpegFile.h: SamplesPerVertex=3, EmbValueModulus=2, calcEValue = abs(coefficient) % 2. */
export const JPEG_COVER_SPEC: CoverFormatSpec = {
  samplesPerVertex: 3,
  embValueModulus: 2,
  calcEValue: (v) => Math.abs(v) % 2
};

/** WavFile.h / AuFile.h: SamplesPerVertex=2, EmbValueModulus=2, calcEValue = sample byte's LSB. */
export const PCM_AUDIO_COVER_SPEC: CoverFormatSpec = {
  samplesPerVertex: 2,
  embValueModulus: 2,
  calcEValue: (v) => v & 1
};

/**
 * BmpFile.h's "RGB" mode actually uses EmbValueModulus=4 with its own BmpRGBSampleValue::calcEValue
 * (not verified here — no BMP test fixture was available to confirm against a real file). This uses
 * the simpler "small palette" constants (SamplesPerVertex=2, modulus=2, LSB) as the best-effort
 * default; a real RGB BMP embedded with steghide's default settings may not extract correctly.
 */
export const BMP_COVER_SPEC: CoverFormatSpec = {
  samplesPerVertex: 2,
  embValueModulus: 2,
  calcEValue: (v) => v & 1
};

/** Reads MSB-first bits from a passphrase-permuted sequence of cover samples. */
export class SteghideBitReader {
  private selector: SteghideSelector;
  private getSampleValue: (sampleIndex: number) => number;
  private position = 0;
  private readonly maxPosition: number;
  private readonly spec: CoverFormatSpec;
  private readonly bitsPerEmbValue: number;
  private bitBuffer: number[] = [];

  constructor(numSamples: number, selector: SteghideSelector, getSampleValue: (sampleIndex: number) => number, spec: CoverFormatSpec) {
    this.selector = selector;
    this.getSampleValue = getSampleValue;
    this.maxPosition = numSamples;
    this.spec = spec;
    this.bitsPerEmbValue = Math.max(1, Math.ceil(Math.log2(spec.embValueModulus)));
  }

  private nextEmbValue(): number {
    let ev = 0;
    for (let i = 0; i < this.spec.samplesPerVertex; i++) {
      if (this.position >= this.maxPosition) throw new Error("Ran out of cover samples while reading steghide header");
      const sampleIndex = this.selector.at(this.position);
      this.position++;
      ev = (ev + this.spec.calcEValue(this.getSampleValue(sampleIndex))) % this.spec.embValueModulus;
    }
    return ev;
  }

  readBit(): number {
    if (this.bitBuffer.length === 0) {
      const ev = this.nextEmbValue();
      for (let b = this.bitsPerEmbValue - 1; b >= 0; b--) {
        this.bitBuffer.push((ev >> b) & 1);
      }
    }
    return this.bitBuffer.shift()!;
  }

  // LSB-first, matching steghide's BitString::getValue: "retval |= (*this)[s+i] << i" — the first
  // bit read becomes bit 0 (least-significant) of the result, not the most-significant as an
  // earlier version of this reader assumed.
  readUInt(nbits: number): number {
    let value = 0;
    for (let i = 0; i < nbits; i++) {
      value |= this.readBit() << i;
    }
    return value >>> 0;
  }

  /** Reads a unary-coded value: a run of 1-bits terminated by a 0-bit; the run length is the value. */
  readUnary(): number {
    let count = 0;
    while (this.readBit() === 1) count++;
    return count;
  }

  readBytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = this.readUInt(8);
    return out;
  }

  readCString(maxLen = 4096): string {
    let str = "";
    for (let i = 0; i < maxLen; i++) {
      const byte = this.readUInt(8);
      if (byte === 0) return str;
      str += String.fromCharCode(byte);
    }
    return str;
  }
}

const CRC32_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Inflates zlib-wrapped deflate data (steghide's optional compression) using the browser's native Compression Streams API. */
export async function zlibInflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}
