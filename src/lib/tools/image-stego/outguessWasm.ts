/**
 * OutGuess payload extractor backed by a real Emscripten build of the reference OutGuess 0.2 C
 * source (see tools/outguess-wasm/), rather than a reimplementation — byte-for-byte verified against
 * the canonical Cicada 3301 sample (boxentriq.com/samples/outguess-sample.jpg) and boxentriq's own
 * emcc-compiled outguess.wasm output.
 *
 * outguess.c's CLI declares `char *key = "Default key"` and only overwrites it if the user passes
 * `-k <key>` — an empty/omitted passphrase is NOT the same as an empty key. This module reproduces
 * that: a blank passphrase is sent to the wasm module as the literal bytes "Default key", matching
 * every real-world file embedded without an explicit passphrase (the common case).
 *
 * A fresh module instance is instantiated per extraction call rather than reused: outguess's C code
 * calls exit(1) directly on malformed input (wrong passphrase, no payload, corrupt header) — this is
 * unmodified upstream behavior in steg_retrieve()/decode_data(), not a bug introduced here. Emscripten
 * turns that into a catchable thrown JS exception, but the module's internal state afterward isn't
 * guaranteed reusable, so each call gets its own isolated instance instead of trying to recover one.
 */
import type { OutguessExtractResult } from "./outguess";

const OUTGUESS_DEFAULT_KEY = "Default key";

interface OutguessWasmExports {
  FS: { writeFile: (path: string, data: Uint8Array) => void };
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _wasm_outguess_free: (ptr: number) => void;
  stringToNewUTF8: (s: string) => number;
  ccall: (name: string, returnType: string, argTypes: string[], args: unknown[]) => number;
}

type OutguessModuleFactory = (opts?: Record<string, unknown>) => Promise<OutguessWasmExports>;

let moduleFactory: OutguessModuleFactory | null | undefined;

/**
 * Lazily loads the wasm module factory. Returns null (once) if the asset isn't available.
 *
 * The glue script lives in public/wasm/, so it's served as-is and must NOT be reached via a plain
 * `import("/wasm/outguess.js")` — Vite's dev server refuses to run its module transform pipeline on
 * anything under /public ("should not be imported from source code"). Fetching the source as text
 * and importing it via a blob: URL sidesteps that, in both dev and prod.
 */
async function loadModuleFactory(): Promise<OutguessModuleFactory | null> {
  if (moduleFactory !== undefined) return moduleFactory;
  try {
    const source = await fetch("/wasm/outguess.js").then((r) => {
      if (!r.ok) throw new Error(`outguess.js fetch failed: ${r.status}`);
      return r.text();
    });
    const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    try {
      const mod = await import(/* @vite-ignore */ blobUrl);
      moduleFactory = mod.default as OutguessModuleFactory;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    moduleFactory = null;
  }
  return moduleFactory;
}

/** Options passed to every module instantiation, so the wasm binary resolves relative to /wasm/
 * rather than to the blob: URL the glue script was loaded from. */
function instantiateOpts() {
  return { locateFile: (path: string) => `/wasm/${path}` };
}

/** Whether the compiled OutGuess wasm module is available in this build (vs. only the JS fallback). */
export async function isOutguessWasmAvailable(): Promise<boolean> {
  return (await loadModuleFactory()) !== null;
}

/**
 * Attempts to extract an OutGuess payload from `file` using `passphrase` (may be empty — mapped to
 * outguess's own "Default key" default). Returns null if the wasm module itself isn't available
 * (asset missing / failed to load), so the caller can fall back to the pure-JS heuristic extractor.
 */
export async function extractOutguessWasm(file: File, passphrase: string): Promise<OutguessExtractResult | null> {
  const factory = await loadModuleFactory();
  if (!factory) return null;

  const effectiveKey = passphrase.length > 0 ? passphrase : OUTGUESS_DEFAULT_KEY;
  const keyBytes = new TextEncoder().encode(effectiveKey);
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  let mod: OutguessWasmExports;
  try {
    mod = await factory(instantiateOpts());
  } catch {
    return null;
  }

  mod.FS.writeFile("/input.jpg", fileBytes);

  const keyPtr = mod._malloc(Math.max(1, keyBytes.length));
  mod.HEAPU8.set(keyBytes, keyPtr);
  const outLenPtr = mod._malloc(4);
  const pathPtr = mod.stringToNewUTF8("/input.jpg");

  let resultPtr = 0;
  try {
    resultPtr = mod.ccall(
      "wasm_outguess_extract",
      "number",
      ["number", "number", "number", "number"],
      [pathPtr, keyPtr, keyBytes.length, outLenPtr]
    );
  } catch {
    // outguess's own code calls exit(1) on a wrong passphrase / no embedded payload / corrupt
    // header — this is the expected shape of a "nothing found" result, not an unusual failure.
    return {
      success: false,
      error: "No OutGuess payload found — wrong passphrase, or this JPEG has no embedded data."
    };
  }

  if (resultPtr === 0) {
    return { success: false, error: "Unsupported cover format for OutGuess — needs a JPEG that libjpeg can decode." };
  }

  const outLen = mod.HEAP32[outLenPtr / 4];
  const bytes = mod.HEAPU8.slice(resultPtr, resultPtr + outLen);
  mod._wasm_outguess_free(resultPtr);

  let text: string | undefined;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = undefined;
  }

  return { success: true, bytes, text };
}
