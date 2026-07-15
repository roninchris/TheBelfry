import forge from "node-forge";
import { ToolOptions, TransformOutput } from "../types";

/**
 * AES Encryption Tool
 * Wraps node-forge AES implementation.
 * Supports 128, 192, and 256 bit keys (auto-derived from string via SHA-256).
 */

function getAesKey(key: string): string {
  const md = forge.md.sha256.create();
  md.update(key);
  return md.digest().getBytes();
}

export function aesEncode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  const mode = (options?.mode as string) || "CBC";
  
  if (!keyStr) throw new Error("Encryption key is required.");

  const key = getAesKey(keyStr);
  const iv = forge.util.createBuffer().fillWithByte(0, 16).getBytes(); // Simple fixed IV for ARG use

  const cipher = forge.cipher.createCipher(("AES-" + mode) as forge.cipher.Algorithm, key);
  cipher.start({ iv: iv });
  cipher.update(forge.util.createBuffer(text, "utf8"));
  if (!cipher.finish()) {
    throw new Error("AES encryption failed.");
  }

  return {
    text: forge.util.encode64(cipher.output.getBytes()),
    hex: cipher.output.toHex()
  };
}

export function aesDecode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  const mode = (options?.mode as string) || "CBC";

  if (!keyStr) throw new Error("Decryption key is required.");

  const key = getAesKey(keyStr);
  const iv = forge.util.createBuffer().fillWithByte(0, 16).getBytes();

  try {
    const data = forge.util.decode64(text);
    const decipher = forge.cipher.createDecipher(("AES-" + mode) as forge.cipher.Algorithm, key);
    decipher.start({ iv: iv });
    decipher.update(forge.util.createBuffer(data));
    if (!decipher.finish()) {
      throw new Error("AES decryption failed. Check your key and input.");
    }
    return decipher.output.toString();
  } catch (err) {
    throw new Error("Invalid AES input or key.");
  }
}
