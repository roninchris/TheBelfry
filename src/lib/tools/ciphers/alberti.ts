/**
 * Alberti cipher — the first polyalphabetic cipher (Leon Battista Alberti,
 * c. 1467), worked with two concentric disks.
 *
 * The outer disk is the fixed plaintext alphabet; the inner disk is a movable
 * mixed cipher alphabet. A letter is enciphered by finding it on the outer ring
 * and reading the inner-ring letter beneath it. What makes it polyalphabetic —
 * and what defeated frequency analysis for centuries — is that the inner disk
 * is periodically turned during the message, so the same plaintext letter
 * enciphers to different letters depending on where it falls.
 *
 * This implementation captures that mechanism with parameters an analyst can
 * set:
 *   - `keyword`   builds the mixed inner ring (keyword letters first, deduped,
 *                 then the rest of the alphabet), the way the disk's inner face
 *                 was engraved.
 *   - `index`     the initial disk setting: which inner letter starts under the
 *                 outer 'A'.
 *   - `period`    how many letters are enciphered before the disk is turned.
 *   - `step`      how far the disk turns each time.
 *
 * With period ≥ message length it reduces to a simple mixed-alphabet
 * substitution (a single disk setting), which is the historically accurate
 * degenerate case. Non-letters pass through untouched and do not advance the
 * period counter, so encode/decode stay in lockstep.
 */

const OUTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Keyword-mixed cipher alphabet: keyword letters (deduped) then the remainder. */
function mixedAlphabet(keyword: string): string {
  const seen = new Set<string>();
  let out = "";
  for (const ch of keyword.toUpperCase()) {
    if (ch >= "A" && ch <= "Z" && !seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  for (let i = 0; i < 26; i++) {
    const ch = OUTER[i];
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}

interface AlbertiOptions {
  keyword?: string;
  index?: string;
  period?: number;
  step?: number;
  // Registry tools are called with the shared ToolOptions bag; the index
  // signature keeps this assignable to that call signature.
  [key: string]: unknown;
}

function transform(text: string, options: AlbertiOptions | undefined, decrypt: boolean): string {
  const inner = mixedAlphabet(options?.keyword ?? "ALBERTI");

  // Initial disk offset: the outer position that the inner alphabet's start is
  // rotated to. Defaults to 'A' (no initial turn).
  const indexLetter = (options?.index ?? "A").toUpperCase().replace(/[^A-Z]/g, "").charAt(0) || "A";
  let rotation = OUTER.indexOf(indexLetter);

  // period < 1 means "never turn" — a single fixed disk setting.
  const period = options?.period && options.period >= 1 ? Math.floor(options.period) : Infinity;
  const step = ((Math.floor(options?.step ?? 1) % 26) + 26) % 26;

  let processed = 0;
  let result = "";

  for (const ch of text) {
    const upper = ch.toUpperCase();
    const isLetter = upper >= "A" && upper <= "Z";
    if (!isLetter) {
      result += ch; // spaces, digits, punctuation carried through
      continue;
    }
    const isLower = ch !== upper;

    let outChar: string;
    if (decrypt) {
      // Cipher letter -> its position on the inner ring -> back to the outer ring.
      const j = inner.indexOf(upper);
      const i = (((j - rotation) % 26) + 26) % 26;
      outChar = OUTER[i];
    } else {
      // Plaintext letter -> outer position -> inner letter beneath it.
      const i = OUTER.indexOf(upper);
      outChar = inner[(i + rotation) % 26];
    }

    result += isLower ? outChar.toLowerCase() : outChar;

    // Turn the disk after every `period` enciphered letters.
    processed++;
    if (processed % period === 0) {
      rotation = (rotation + step) % 26;
    }
  }

  return result;
}

export function albertiEncode(text: string, options?: AlbertiOptions): string {
  return transform(text, options, false);
}

export function albertiDecode(text: string, options?: AlbertiOptions): string {
  return transform(text, options, true);
}
