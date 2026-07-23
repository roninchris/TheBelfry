import type { Atlas } from "../types";
import { binaryTallyAtlas } from "./binaryTally";

/**
 * Atlas id → glyph set, referenced by `StrategyConfig.atlas`.
 *
 * Only `binaryTally` remains: it recognises tally-stroke binary (bar = 1,
 * ring = 0), which is a well-defined 2-glyph shape. Symbol-alphabet atlases
 * (dancing men, pigpen, runic, braille) were removed — a self-authored atlas
 * only matches the app's own art, not real-world images, so those ciphers no
 * longer offer image intake (see IMAGE_INTAKE_UNSUPPORTED).
 */
const ATLASES: Record<string, Atlas> = {
  binaryTally: binaryTallyAtlas,
};

export function getAtlas(id: string): Atlas | undefined {
  return ATLASES[id];
}
