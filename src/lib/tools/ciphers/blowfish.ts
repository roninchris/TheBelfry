import { Blowfish } from "egoroof-blowfish";
import forge from "node-forge";
import { ToolOptions, TransformOutput } from "../types";

/**
 * Blowfish Encryption Tool
 * Wraps egoroof-blowfish implementation.
 * Supports keys from 4 to 56 bytes.
 */

export function blowfishEncode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  const modeStr = (options?.mode as string) || "CBC";
  
  if (!keyStr || keyStr.length < 4 || keyStr.length > 56) {
    throw new Error("Blowfish key must be between 4 and 56 characters.");
  }

  const mode = modeStr === "ECB" ? Blowfish.MODE.ECB : Blowfish.MODE.CBC;
  const bf = new Blowfish(keyStr, mode, Blowfish.PADDING.PKCS5);
  
  if (mode === Blowfish.MODE.CBC) {
    bf.setIv("00000000"); // Standard fixed IV for ARG consistency
  }

  const encoded = bf.encode(text);
  const binary = forge.util.createBuffer(encoded).getBytes();

  return {
    text: forge.util.encode64(binary),
    hex: forge.util.createBuffer(binary).toHex()
  };
}

export function blowfishDecode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  const modeStr = (options?.mode as string) || "CBC";

  if (!keyStr) throw new Error("Key is required.");

  const mode = modeStr === "ECB" ? Blowfish.MODE.ECB : Blowfish.MODE.CBC;
  const bf = new Blowfish(keyStr, mode, Blowfish.PADDING.PKCS5);
  
  if (mode === Blowfish.MODE.CBC) {
    bf.setIv("00000000");
  }

  try {
    const data = forge.util.decode64(text);
    const uint8 = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) uint8[i] = data.charCodeAt(i);
    
    return bf.decode(uint8, Blowfish.TYPE.STRING);
  } catch (err) {
    throw new Error("Invalid Blowfish input or key.");
  }
}
