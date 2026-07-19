import { ToolOptions, TransformOutput } from "../types";

/**
 * RC4 (Arcfour) stream cipher.
 *
 * Previously this wrapped `forge.rc4.createInstance()`, but node-forge's ESM
 * build does not expose an `rc4` member, so that property was undefined and
 * every call — encode and decode, with or without a key — threw
 * "Cannot read properties of undefined (reading 'createInstance')". The cipher
 * was completely dead rather than partially broken.
 *
 * RC4 is small enough to own outright, which also drops a dependency from a
 * path that only needed twenty lines of it.
 */

/** Key-scheduling algorithm: build the 256-byte permutation from the key. */
function initState(keyBytes: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + keyBytes[i % keyBytes.length]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
  }
  return s;
}

/** PRGA: XOR the input against the keystream. RC4 is symmetric. */
function rc4Crypt(keyBytes: Uint8Array, data: Uint8Array): Uint8Array {
  const s = initState(keyBytes);
  const out = new Uint8Array(data.length);

  let i = 0;
  let j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
    out[n] = data[n] ^ s[(s[i] + s[j]) & 0xff];
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export function rc4Encode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  if (!keyStr) throw new Error("Key is required for RC4.");

  const keyBytes = new TextEncoder().encode(keyStr);
  const cipherBytes = rc4Crypt(keyBytes, new TextEncoder().encode(text));

  return {
    text: toBase64(cipherBytes),
    hex: toHex(cipherBytes)
  };
}

export function rc4Decode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  if (!keyStr) throw new Error("Key is required for RC4.");

  let cipherBytes: Uint8Array;
  try {
    cipherBytes = fromBase64(text);
  } catch {
    throw new Error("RC4 input must be Base64 — this is the format the encoder emits.");
  }

  const keyBytes = new TextEncoder().encode(keyStr);
  const plainBytes = rc4Crypt(keyBytes, cipherBytes);

  // fatal:false so a wrong key yields readable mojibake rather than throwing —
  // the brute forcer needs a scoreable string back from every candidate key.
  return new TextDecoder("utf-8", { fatal: false }).decode(plainBytes);
}
