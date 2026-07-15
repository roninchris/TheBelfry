/**
 * OutGuess payload extractor — a decode-only implementation of the OutGuess 0.2 algorithm
 * (resurrecting-open-source-projects/outguess: arc.c, iterator.c, outguess.c, jpg.c — BSD,
 * Niels Provos 1999-2001).
 *
 * Verified bit-for-bit against the canonical Cicada 3301 sample used by boxentriq's own extractor
 * (boxentriq.com/samples/outguess-sample.jpg, empty passphrase → "Here is a book code..."), and
 * cross-checked against a real Emscripten build of the reference C source (see
 * tools/outguess-wasm/), which is used as the primary extractor when available
 * (outguessWasm.ts) — this module is the fallback for environments where the wasm asset isn't
 * present. Two subtleties that cost real debugging time before this matched the reference tool:
 *
 *  - libjpeg's Huffman decoder de-zigzags coefficients *during* decode (each decoded zigzag-order
 *    value is stored at its natural raster position), so by the time OutGuess's steg hook reads a
 *    block's coefficients it's already reading natural order, not zigzag order — no re-zigzagging
 *    should be applied when walking `block[]` (see getOutguessCoefficients in jsteg.ts).
 *  - outguess.c's CLI declares `char *key = "Default key"` and only overwrites it if `-k` is given
 *    — an empty/omitted passphrase is NOT an empty key, it's this literal 11-byte string.
 *
 * The pipeline the reference uses on extract, reproduced here:
 *
 *  1. Usable bits: every JPEG DCT coefficient except those equal to 0 or 1 (the embedder avoids
 *     only 0/1; -1 and other negatives ARE used). The stego bit of each is its LSB (`coeff & 1`).
 *     Coefficients are taken in libjpeg's MCU-interleaved, zigzag-storage order (getOutguessCoefficients).
 *
 *  2. Two keyed keystreams, both from an OpenBSD-arc4 (RC4) generator seeded via
 *     `RC4( MD5(type || passphrase) )`, where `type` is the literal string "Seeding" (for the
 *     coefficient-walk iterator) or "Encryption" (for payload de-obfuscation). Note OpenBSD arc4
 *     does NOT reset j after keying, so this is not textbook RC4 keyed with the passphrase.
 *
 *  3. Iterator: skipmod starts at 32; the first coefficient index is `getWord() % 32`, and each
 *     step advances `+= (getWord() % skipmod) + 1`, spreading the payload across the image.
 *
 *  4. A 4-byte header is read (8 bits per byte, LSB-first) and XOR-decrypted with a fresh
 *     "Encryption" keystream: bytes [seedLo, seedHi, lenLo, lenHi]. The 16-bit seed re-randomizes
 *     the iterator; the 16-bit length is the payload size.
 *
 *  5. The iterator's skipmod is then re-derived per payload byte (iterator_adapt) so the payload
 *     spreads across the remaining coefficients, and each byte is read LSB-first.
 *
 *  6. The payload bytes are XOR-decrypted with a second fresh "Encryption" keystream (started from
 *     byte 0, independent of the header's stream — the reference keeps a pre-header copy for this).
 *
 * Golay error-correction (outguess `-e`) is not implemented; the default (no-ECC) embedding is.
 */
import { getOutguessCoefficients } from "./jsteg";
import { md5Raw } from "./steghideCore";

/**
 * OpenBSD arc4 stream generator (as used by outguess's arc.c). Differs from textbook RC4: it is
 * keyed by `addRandom` over an MD5 digest and never resets i/j afterward, so keystream generation
 * continues from wherever keying left the internal counters.
 */
class Arc4 {
  private s: number[] = new Array(256);
  private i = 0;
  private j = 0;

  constructor() {
    for (let n = 0; n < 256; n++) this.s[n] = n;
  }

  /** arc4_addrandom: fold `data` into the permutation (equivalent to the RC4 KSA over `data`). */
  addRandom(data: Uint8Array): void {
    this.i = (this.i - 1) & 0xff;
    for (let n = 0; n < 256; n++) {
      this.i = (this.i + 1) & 0xff;
      const si = this.s[this.i];
      this.j = (this.j + si + data[n % data.length]) & 0xff;
      this.s[this.i] = this.s[this.j];
      this.s[this.j] = si;
    }
  }

  getByte(): number {
    this.i = (this.i + 1) & 0xff;
    const si = this.s[this.i];
    this.j = (this.j + si) & 0xff;
    const sj = this.s[this.j];
    this.s[this.i] = sj;
    this.s[this.j] = si;
    return this.s[(si + sj) & 0xff];
  }

  /** Four keystream bytes as one big-endian 32-bit word (arc4_getword). */
  getWord(): number {
    return ((this.getByte() << 24) | (this.getByte() << 16) | (this.getByte() << 8) | this.getByte()) >>> 0;
  }
}

/** arc4_initkey: RC4 seeded with MD5(type || key). */
function initKey(type: string, key: Uint8Array): Arc4 {
  const typeBytes = new TextEncoder().encode(type);
  const buf = new Uint8Array(typeBytes.length + key.length);
  buf.set(typeBytes, 0);
  buf.set(key, typeBytes.length);
  const digest = md5Raw(buf);
  const arc4 = new Arc4();
  arc4.addRandom(digest);
  return arc4;
}

const INIT_SKIPMOD = 32;

/** SKIPADJ(x,y) from iterator.h — fades the skip distance out near the end of the image. */
function skipAdj(x: number, y: number): number {
  const x32 = Math.floor(x / 32);
  if (y > x32) return 2;
  if (x32 === 0) return 2;
  return 2 - (x32 - y) / x32;
}

/** The OutGuess coefficient-walk iterator (iterator.c), keyed with the "Seeding" stream. */
class OutguessIterator {
  private arc4: Arc4;
  private skipmod = INIT_SKIPMOD;
  off: number;

  constructor(key: Uint8Array) {
    this.arc4 = initKey("Seeding", key);
    this.off = this.arc4.getWord() % this.skipmod;
  }

  /** iterator_next: advance and return the new coefficient index. */
  private next(): number {
    this.off += (this.arc4.getWord() % Math.max(1, this.skipmod)) + 1;
    return this.off;
  }

  /** iterator_seed: fold the 16-bit header seed back into the keystream. */
  seed(seed: number): void {
    this.arc4.addRandom(new Uint8Array([seed & 0xff, (seed >> 8) & 0xff]));
  }

  /** iterator_adapt: re-derive skipmod so `dataBytes` more bytes spread over the remaining bits. */
  adapt(totalBits: number, dataBytes: number): void {
    const rem = totalBits - this.off;
    this.skipmod = Math.floor((skipAdj(totalBits, rem) * rem) / (8 * dataBytes));
    if (this.skipmod < 1) this.skipmod = 1;
  }

  /**
   * steg_retrbyte(8): read the bit at the current index first, then advance, LSB-first.
   * Returns null if the walk runs past the end of the usable coefficients.
   */
  readByte(bits: Uint8Array): number | null {
    let tmp = 0;
    for (let where = 0; where < 8; where++) {
      if (this.off < 0 || this.off >= bits.length) return null;
      tmp |= bits[this.off] << where;
      this.next();
    }
    return tmp & 0xff;
  }
}

export interface OutguessExtractResult {
  success: boolean;
  error?: string;
  bytes?: Uint8Array;
  text?: string;
  warning?: string;
}

const HEADER_BYTES = 4;

/** Attempts to extract an OutGuess payload from `file` using `passphrase` (may be empty). */
export async function extractOutguess(file: File, passphrase: string): Promise<OutguessExtractResult> {
  const coefficients = await getOutguessCoefficients(file);
  if (!coefficients) {
    return { success: false, error: "Unsupported cover format for OutGuess — needs a JPEG." };
  }

  // Usable bits = LSBs of every coefficient except 0 and 1 (negatives, including -1, are kept).
  const usableBits: number[] = [];
  for (const c of coefficients) {
    if (c !== 0 && c !== 1) usableBits.push(c & 1);
  }
  const bits = new Uint8Array(usableBits);
  const totalBits = bits.length;

  if (totalBits < HEADER_BYTES * 8 * 2) {
    return { success: false, error: "Not enough usable DCT coefficients in this JPEG to contain an OutGuess payload." };
  }

  // outguess.c's CLI declares `char *key = "Default key"` and only overwrites it if `-k` is given —
  // an empty/omitted passphrase is NOT the same as an empty key, it's this literal 11-byte string.
  const key = new TextEncoder().encode(passphrase.length > 0 ? passphrase : "Default key");
  const iter = new OutguessIterator(key);

  // Stage 1: read the 4-byte admin header (skipmod stays at 32) and decrypt it.
  const rawHeader = new Uint8Array(HEADER_BYTES);
  for (let i = 0; i < HEADER_BYTES; i++) {
    const b = iter.readByte(bits);
    if (b === null) {
      return { success: false, error: "Ran out of coefficients while reading the OutGuess header — wrong passphrase or no payload present." };
    }
    rawHeader[i] = b;
  }

  const headerStream = initKey("Encryption", key);
  const header = new Uint8Array(HEADER_BYTES);
  for (let i = 0; i < HEADER_BYTES; i++) {
    header[i] = rawHeader[i] ^ headerStream.getByte();
  }

  const seed = header[0] | (header[1] << 8);
  const payloadLength = header[2] | (header[3] << 8);

  const maxBytes = Math.floor((totalBits + 7) / 8);
  if (payloadLength <= 0 || payloadLength > maxBytes) {
    return { success: false, error: "Header length looks implausible — wrong passphrase or no OutGuess payload present." };
  }

  // Stage 2: re-seed the iterator and read the payload with an adaptive skip distance.
  iter.seed(seed);
  const rawPayload = new Uint8Array(payloadLength);
  for (let n = 0; n < payloadLength; n++) {
    iter.adapt(totalBits, payloadLength - n);
    const b = iter.readByte(bits);
    if (b === null) {
      return { success: false, error: "Ran out of coefficients while reading the OutGuess payload — wrong passphrase or no payload present." };
    }
    rawPayload[n] = b;
  }

  // Stage 3: decrypt the payload with a fresh "Encryption" keystream (independent of the header's).
  const payloadStream = initKey("Encryption", key);
  const bytes = new Uint8Array(payloadLength);
  for (let i = 0; i < payloadLength; i++) {
    bytes[i] = rawPayload[i] ^ payloadStream.getByte();
  }

  let text: string | undefined;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = undefined;
  }

  return {
    success: true,
    bytes,
    text,
    warning: text === undefined
      ? "Payload extracted but is not valid UTF-8 text — it may be binary data, or the passphrase may be wrong."
      : undefined
  };
}
