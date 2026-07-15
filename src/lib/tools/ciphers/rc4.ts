import forge from "node-forge";
import { ToolOptions, TransformOutput } from "../types";

/**
 * RC4 Stream Cipher
 * Wraps node-forge RC4 implementation.
 */

export function rc4Encode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  if (!keyStr) throw new Error("Key is required for RC4.");

  const rc4 = (forge as any).rc4.createInstance(keyStr);
  const out = rc4.output(forge.util.createBuffer(text, "utf8"));
  
  return {
    text: forge.util.encode64(out.getBytes()),
    hex: out.toHex()
  };
}

export function rc4Decode(text: string, options?: ToolOptions): TransformOutput {
  const keyStr = (options?.key as string) || "SECRET";
  if (!keyStr) throw new Error("Key is required for RC4.");

  try {
    const data = forge.util.decode64(text);
    const rc4 = (forge as any).rc4.createInstance(keyStr);
    const out = rc4.output(forge.util.createBuffer(data));
    return out.toString();
  } catch (err) {
    throw new Error("Invalid RC4 input or key.");
  }
}
