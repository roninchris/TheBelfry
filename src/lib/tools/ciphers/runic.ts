/**
 * Elder Futhark runic transliteration.
 *
 * Distinct from the Gematria Primus tool, which uses the 24-rune Anglo-Saxon
 * futhorc and carries prime values. This is the older and far more commonly
 * encountered 24-rune Elder Futhark, used plainly as a substitution alphabet.
 *
 * Two details matter for round-tripping:
 *  - Digraphs (TH, NG) are single runes, so they must be matched before their
 *    component letters or "THE" would encode as three runes instead of two.
 *  - Elder Futhark has no C, Q, V, X or Y. They are folded onto their
 *    conventional phonetic equivalents on the way in. That fold is lossy by
 *    nature — decoding returns the rune's own letter — so it is reported rather
 *    than hidden.
 */

import type { ToolOptions, TransformOutput } from "../types";

export interface RuneEntry {
  latin: string;
  rune: string;
  name: string;
}

export const ELDER_FUTHARK: RuneEntry[] = [
  { latin: "F", rune: "ᚠ", name: "Fehu" },
  { latin: "U", rune: "ᚢ", name: "Uruz" },
  { latin: "TH", rune: "ᚦ", name: "Thurisaz" },
  { latin: "A", rune: "ᚨ", name: "Ansuz" },
  { latin: "R", rune: "ᚱ", name: "Raidho" },
  { latin: "K", rune: "ᚲ", name: "Kaunan" },
  { latin: "G", rune: "ᚷ", name: "Gebo" },
  { latin: "W", rune: "ᚹ", name: "Wunjo" },
  { latin: "H", rune: "ᚺ", name: "Hagalaz" },
  { latin: "N", rune: "ᚾ", name: "Naudiz" },
  { latin: "I", rune: "ᛁ", name: "Isaz" },
  { latin: "J", rune: "ᛃ", name: "Jera" },
  { latin: "EI", rune: "ᛇ", name: "Eihwaz" },
  { latin: "P", rune: "ᛈ", name: "Perth" },
  { latin: "Z", rune: "ᛉ", name: "Algiz" },
  { latin: "S", rune: "ᛊ", name: "Sowilo" },
  { latin: "T", rune: "ᛏ", name: "Tiwaz" },
  { latin: "B", rune: "ᛒ", name: "Berkanan" },
  { latin: "E", rune: "ᛖ", name: "Ehwaz" },
  { latin: "M", rune: "ᛗ", name: "Mannaz" },
  { latin: "L", rune: "ᛚ", name: "Laguz" },
  { latin: "NG", rune: "ᛜ", name: "Ingwaz" },
  { latin: "D", rune: "ᛞ", name: "Dagaz" },
  { latin: "O", rune: "ᛟ", name: "Othala" },
];

/** Letters with no Elder Futhark rune, folded onto their phonetic neighbours. */
const FOLDED: Record<string, string> = {
  C: "K",
  Q: "K",
  V: "W",
  X: "KS",
  Y: "I",
};

const latinToRune = new Map<string, string>();
const runeToLatin = new Map<string, string>();
for (const entry of ELDER_FUTHARK) {
  latinToRune.set(entry.latin, entry.rune);
  runeToLatin.set(entry.rune, entry.latin);
}

// Longest first, so TH and NG win over T, H, N and G.
const ENCODE_KEYS = [...latinToRune.keys()].sort((a, b) => b.length - a.length);

export function runicEncode(text: string, _options?: ToolOptions): TransformOutput {
  if (!text) return "";

  // Fold first, then transliterate. Doing it in one pass meant tracking how many
  // source characters a multi-rune fold like X -> KS had consumed; folding up
  // front makes the match loop a plain greedy scan.
  const folded = text
    .toUpperCase()
    .replace(/[CQVXY]/g, (c) => FOLDED[c] ?? c);

  let out = "";
  let i = 0;

  while (i < folded.length) {
    let matched = false;

    for (const key of ENCODE_KEYS) {
      if (folded.startsWith(key, i)) {
        out += latinToRune.get(key);
        i += key.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Spaces, digits and punctuation pass through untouched.
      out += folded[i];
      i += 1;
    }
  }

  return out;
}

export function runicDecode(text: string, _options?: ToolOptions): TransformOutput {
  if (!text) return "";

  let out = "";
  for (const char of text) {
    const latin = runeToLatin.get(char);
    out += latin !== undefined ? latin : char;
  }
  return out;
}
