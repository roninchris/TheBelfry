import forge from "node-forge";
import { ToolOptions, TransformOutput } from "../types";

/**
 * DES Encryption Tool
 * Wraps node-forge DES implementation.
 * Uses 64-bit keys (derived from string via MD5).
 */

function getDesKey(key: string): string {
  const md = forge.md.md5.create();
  md.update(key);
  return md.digest().getBytes().substring(0, 8);
}

export function desEncode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  const mode = (options?.mode as string) || "CBC";

  if (!keyStr) throw new Error("Encryption key is required.");

  const key = getDesKey(keyStr);
  const iv = forge.util.createBuffer().fillWithByte(0, 8).getBytes();

  const cipher = forge.cipher.createCipher(("DES-" + mode) as forge.cipher.Algorithm, key);
  cipher.start({ iv: iv });
  cipher.update(forge.util.createBuffer(text, "utf8"));
  if (!cipher.finish()) {
    throw new Error("DES encryption failed.");
  }

  return {
    text: forge.util.encode64(cipher.output.getBytes()),
    hex: cipher.output.toHex()
  };
}

export function desDecode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  const mode = (options?.mode as string) || "CBC";

  if (!keyStr) throw new Error("Decryption key is required.");

  const key = getDesKey(keyStr);
  const iv = forge.util.createBuffer().fillWithByte(0, 8).getBytes();

  try {
    const data = forge.util.decode64(text);
    const decipher = forge.cipher.createDecipher(("DES-" + mode) as forge.cipher.Algorithm, key);
    decipher.start({ iv: iv });
    decipher.update(forge.util.createBuffer(data));
    if (!decipher.finish()) {
      throw new Error("DES decryption failed. Check your key.");
    }
    return decipher.output.toString();
  } catch (err) {
    throw new Error("Invalid DES input or key.");
  }
}
