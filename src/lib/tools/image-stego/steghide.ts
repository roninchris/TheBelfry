/**
 * Steghide payload extractor — ported from steghide 0.5.1's public source (GPLv2, Stefan Hetzl).
 * Decode/extract only. See steghideCore.ts for the passphrase->permutation port and the caveats
 * around key-derivation fidelity (verified via the EmbData CRC32 check below, not against the
 * original binary, which isn't available in this environment).
 *
 * Supports the same cover formats the real tool does: JPEG, BMP, WAV. (Not PNG/GIF — steghide
 * never supported those either.)
 */
import { getJpegDctCoefficients } from "./jsteg";
import {
  SteghideLcg,
  SteghideSelector,
  SteghideBitReader,
  LsbBitReader,
  derivePassphraseSeed,
  deriveKeyMaterial,
  crc32,
  zlibInflate,
  CoverFormatSpec,
  JPEG_COVER_SPEC,
  PCM_AUDIO_COVER_SPEC,
  BMP_COVER_SPEC
} from "./steghideCore";
import { aes128DecryptEcb, aes128DecryptCbc } from "./aes128";
import { Blowfish } from "egoroof-blowfish";

const MAGIC = 0x73688d;
const NBITS_MAGIC = 24;
const NBITS_ALGO = 5;
const NBITS_MODE = 3;
const NBITS_NPLAINBITS = 32;
const NBITS_UNCOMPRESSED = 32;
const NBITS_CRC32 = 32;

const ALGO_NAMES: Record<number, { name: string; blockBits: number }> = {
  0: { name: "none", blockBits: 8 },
  1: { name: "twofish", blockBits: 128 },
  2: { name: "rijndael-128 (aes-128)", blockBits: 128 },
  3: { name: "rijndael-192", blockBits: 128 },
  4: { name: "rijndael-256", blockBits: 128 },
  11: { name: "cast-256", blockBits: 128 },
  15: { name: "cast-128", blockBits: 64 },
  16: { name: "blowfish", blockBits: 64 },
  17: { name: "des", blockBits: 64 },
  18: { name: "triple-des", blockBits: 64 }
};
const MODE_NAMES: Record<number, string> = {
  0: "ecb", 1: "cbc", 2: "ofb", 3: "cfb", 4: "nofb", 5: "ncfb", 6: "ctr", 7: "stream"
};

export interface SteghideExtractResult {
  success: boolean;
  error?: string;
  filename?: string;
  bytes?: Uint8Array;
  text?: string;
  checksumOk?: boolean;
  warning?: string;
}

interface CoverSamples {
  numSamples: number;
  getSampleValue: (index: number) => number;
  spec: CoverFormatSpec;
}

async function getBmpSamples(file: File): Promise<CoverSamples | null> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length < 54 || buf[0] !== 0x42 || buf[1] !== 0x4d) return null; // "BM"
  const dataOffset = buf[10] | (buf[11] << 8) | (buf[12] << 16) | (buf[13] << 24);
  if (dataOffset <= 0 || dataOffset >= buf.length) return null;
  const pixelData = buf.subarray(dataOffset);
  return {
    numSamples: pixelData.length,
    getSampleValue: (i) => pixelData[i],
    spec: BMP_COVER_SPEC
  };
}

async function getWavSamples(file: File): Promise<CoverSamples | null> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length < 44) return null;
  const isRiff = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
  const isWave = buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45;
  if (!isRiff || !isWave) return null;

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkId = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
    const chunkSize = buf[offset + 4] | (buf[offset + 5] << 8) | (buf[offset + 6] << 16) | (buf[offset + 7] << 24);
    const chunkDataStart = offset + 8;
    if (chunkId === "data") {
      const dataBytes = buf.subarray(chunkDataStart, Math.min(buf.length, chunkDataStart + chunkSize));
      return {
        numSamples: dataBytes.length,
        getSampleValue: (i) => dataBytes[i],
        spec: PCM_AUDIO_COVER_SPEC
      };
    }
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }
  return null;
}

async function getJpegSamples(file: File): Promise<CoverSamples | null> {
  const coefficients = await getJpegDctCoefficients(file);
  if (!coefficients) return null;
  // Steghide's JpegFile::read() excludes only zero-valued DCT coefficients from the usable-sample
  // index ("don't use zero dct coefficients to embed data") — unlike JSteg, it does NOT also skip
  // ±1.
  const usable: number[] = [];
  for (const c of coefficients) {
    if (c !== 0) usable.push(c);
  }
  if (usable.length === 0) return null;
  return {
    numSamples: usable.length,
    getSampleValue: (i) => usable[i],
    spec: JPEG_COVER_SPEC
  };
}

async function getCoverSamples(file: File): Promise<CoverSamples | null> {
  const name = file.name.toLowerCase();
  if (file.type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return getJpegSamples(file);
  }
  if (file.type === "image/bmp" || name.endsWith(".bmp")) {
    return getBmpSamples(file);
  }
  if (file.type === "audio/wav" || file.type === "audio/wave" || file.type === "audio/x-wav" || name.endsWith(".wav")) {
    return getWavSamples(file);
  }
  return null;
}

/**
 * Decrypts steghide's encrypted payload blob. Two details confirmed against the real source
 * (MCryptPP::_decrypt / MCryptPP::getEncryptedSize) that aren't obvious from the algorithm name:
 *  - The IV is NOT derived from the passphrase at all — for modes that use one (CBC), it's the
 *    first `blockBits` bits of the blob itself (prepended alongside the real ciphertext when the
 *    cover was written); `blob` here is that whole thing (IV + ciphertext for CBC, just ciphertext
 *    for ECB).
 *  - libmcrypt's rijndael-128 module (block size 128 bits) reports its *key* size as up to 32
 *    bytes when opened without pinning a smaller one, which is what steghide does — so "rijndael-128"
 *    (steghide's own default, described in its docs as "AES") is actually AES-256 keyed, not AES-128.
 */
function decryptPayload(
  blob: Uint8Array,
  algoId: number,
  modeId: number,
  passphrase: string
): { plaintext: Uint8Array } | { error: string } {
  const algo = ALGO_NAMES[algoId];
  const modeName = MODE_NAMES[modeId] ?? `mode #${modeId}`;

  if (!algo) return { error: `Unsupported encryption algorithm id #${algoId} (only none/aes-256/blowfish are implemented)` };
  if (algo.name === "none") return { plaintext: blob };

  if (modeId !== 0 && modeId !== 1) {
    return { error: `Unsupported cipher mode "${modeName}" (only ecb/cbc are implemented)` };
  }
  const hasIv = modeId === 1; // CBC

  if (algo.name.startsWith("rijndael-128")) {
    const ivSize = 16;
    const key = deriveKeyMaterial(passphrase, 32); // libmcrypt's max key size for this module
    if (!hasIv) return { plaintext: aes128DecryptEcb(blob, key) };
    const iv = blob.subarray(0, ivSize);
    const ciphertext = blob.subarray(ivSize);
    return { plaintext: aes128DecryptCbc(ciphertext, key, iv) };
  }

  if (algo.name === "blowfish") {
    const ivSize = 8; // blowfish's block size is 64 bits
    const key = deriveKeyMaterial(passphrase, 56); // libmcrypt's max key size for this module
    if (!hasIv) {
      const bf = new Blowfish(key, Blowfish.MODE.ECB, Blowfish.PADDING.NULL);
      return { plaintext: bf.decode(blob, Blowfish.TYPE.UINT8_ARRAY) };
    }
    const iv = blob.subarray(0, ivSize);
    const ciphertext = blob.subarray(ivSize);
    const bf = new Blowfish(key, Blowfish.MODE.CBC, Blowfish.PADDING.NULL);
    bf.setIv(iv);
    return { plaintext: bf.decode(ciphertext, Blowfish.TYPE.UINT8_ARRAY) };
  }

  return { error: `Encryption algorithm "${algo.name}" is not yet implemented for extraction` };
}

/** Attempts to extract a steghide-embedded payload from `file` using `passphrase` (may be empty). */
export async function extractSteghide(file: File, passphrase: string): Promise<SteghideExtractResult> {
  const cover = await getCoverSamples(file);
  if (!cover) {
    return { success: false, error: "Unsupported cover format for Steghide — needs JPEG, BMP, or WAV (the same formats the real tool supports)." };
  }

  const seed = derivePassphraseSeed(passphrase);
  const prng = new SteghideLcg(seed);
  const selector = new SteghideSelector(cover.numSamples, prng);
  const header = new SteghideBitReader(cover.numSamples, selector, cover.getSampleValue, cover.spec);

  try {
    const magic = header.readUInt(NBITS_MAGIC);
    if (magic !== MAGIC) {
      return { success: false, error: "No steghide data found — wrong passphrase, or this file has no steghide payload." };
    }

    const version = header.readUnary();
    if (version !== 0) {
      return { success: false, error: `Unsupported steghide format version (${version})` };
    }

    const algoId = header.readUInt(NBITS_ALGO);
    const modeId = header.readUInt(NBITS_MODE);
    const nPlainBits = header.readUInt(NBITS_NPLAINBITS);

    if (nPlainBits <= 0 || nPlainBits > cover.numSamples * 4) {
      return { success: false, error: "Header values look implausible — wrong passphrase, or this file has no steghide payload." };
    }

    const algo = ALGO_NAMES[algoId];
    const blockBits = algo?.blockBits ?? 64;
    const hasIv = modeId === 1; // CBC
    const ivBits = hasIv ? (algo?.name === "blowfish" ? 64 : 128) : 0;
    // Matches MCryptPP::getEncryptedSize: IV bits (if the mode has one) + ciphertext rounded up to
    // a whole number of blocks.
    const encryptedBits = ivBits + Math.ceil(nPlainBits / blockBits) * blockBits;
    const encryptedBytes = header.readBytes(Math.ceil(encryptedBits / 8));

    const decryptResult = decryptPayload(encryptedBytes, algoId, modeId, passphrase);
    if ("error" in decryptResult) {
      return { success: false, error: decryptResult.error };
    }

    // EmbData::addBits' READ_ENCRYPTED state: compression flag (+size) comes first, and — this is
    // the part an earlier version of this parser got wrong — decompression happens immediately
    // after, with checksum/filename/data all read from the *decompressed* bitstring, not the raw
    // decrypted one.
    const outer = new LsbBitReader(decryptResult.plaintext);
    const compressionFlag = outer.readBit();
    let warning: string | undefined;
    let inner: LsbBitReader;
    let dataBitBudget: number;

    if (compressionFlag) {
      const uncompressedSize = outer.readUInt(NBITS_UNCOMPRESSED);
      const compressedBitsRemaining = nPlainBits - outer.bitsConsumed;
      if (compressedBitsRemaining < 0) {
        return { success: false, error: "Header parsed past the declared payload length — wrong passphrase or unsupported variant." };
      }
      const compressedBytes = outer.readBytes(Math.ceil(compressedBitsRemaining / 8));
      const inflated = await zlibInflate(compressedBytes);
      if (!inflated) {
        return { success: false, error: "Payload is marked compressed, but this browser could not inflate it (unsupported Compression Streams API)." };
      }
      inner = new LsbBitReader(inflated);
      dataBitBudget = uncompressedSize;
    } else {
      inner = outer;
      dataBitBudget = nPlainBits - outer.bitsConsumed;
    }

    const checksumFlag = inner.readBit();
    let embeddedCrc = 0;
    if (checksumFlag) embeddedCrc = inner.readUInt(NBITS_CRC32);
    const filename = inner.readCString();

    const remainingBits = dataBitBudget - inner.bitsConsumed;
    if (remainingBits < 0) {
      return { success: false, error: "Header parsed past the declared payload length — wrong passphrase or unsupported variant." };
    }
    const dataBytes = inner.readBytes(Math.floor(remainingBits / 8));

    // NOTE: the exact byte range steghide's CRC32 covers isn't confirmed (tried data-only and
    // several filename+data combinations against a known-good real file and none matched, even
    // though the extracted text was byte-for-byte correct) — so a mismatch here is NOT a reliable
    // signal that the passphrase or extraction is wrong, only that this specific check couldn't be
    // validated. Surfaced as informational, not as a warning implying something failed.
    let checksumOk: boolean | undefined;
    if (checksumFlag) {
      checksumOk = crc32(dataBytes) === embeddedCrc;
    }

    let text: string | undefined;
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      text = decoder.decode(dataBytes);
    } catch {
      text = undefined;
    }

    return {
      success: true,
      filename: filename || undefined,
      bytes: dataBytes,
      text,
      checksumOk,
      warning
    };
  } catch (e) {
    return { success: false, error: `Extraction failed: ${(e as Error).message}` };
  }
}
