import { createC2pa, ManifestStore } from "c2pa";
import wasmUrl from "c2pa/dist/assets/wasm/toolkit_bg.wasm?url";
import workerUrl from "c2pa/dist/c2pa.worker.js?url";

let c2paInstance: any = null;

/**
 * Initializes and returns a singleton C2PA instance.
 */
async function getC2paInstance() {
  if (!c2paInstance) {
    c2paInstance = await createC2pa({
      wasmSrc: wasmUrl,
      workerSrc: workerUrl,
    });
  }
  return c2paInstance;
}

/**
 * Reads C2PA Content Credentials from a file.
 * @param file - The image file to analyze
 * @returns Manifest store or null if no credentials found
 */
export async function readContentCredentials(file: File): Promise<ManifestStore | null> {
  try {
    const c2pa = await getC2paInstance();
    const result = await c2pa.read(file);
    return result.manifestStore || null;
  } catch (error) {
    console.error("C2PA read error:", error);
    return null;
  }
}
