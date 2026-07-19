/** Gematria Primus 24-rune Cipher - converts Latin letters to/from runes or primes */

import type { ToolOptions, TransformOutput } from "../types";

export interface GematriaEntry {
  latin: string;
  rune: string;
  prime: number;
}

export const GEMATRIA_TABLE: GematriaEntry[] = [
  { latin: "F", rune: "ᚠ", prime: 2 },
  { latin: "U", rune: "ᚢ", prime: 3 },
  { latin: "TH", rune: "ᚦ", prime: 5 },
  { latin: "O", rune: "ᚩ", prime: 7 },
  { latin: "R", rune: "ᚱ", prime: 11 },
  { latin: "C", rune: "ᚳ", prime: 13 }, // C or K usually map here
  { latin: "G", rune: "ᚷ", prime: 17 },
  { latin: "W", rune: "ᚹ", prime: 19 },
  { latin: "H", rune: "ᚻ", prime: 23 },
  { latin: "N", rune: "ᚾ", prime: 29 },
  { latin: "I", rune: "ᛁ", prime: 31 },
  { latin: "J", rune: "ᛡ", prime: 37 }, // GER or J
  { latin: "EO", rune: "ᛇ", prime: 41 },
  { latin: "P", rune: "ᛈ", prime: 43 },
  { latin: "X", rune: "ᛉ", prime: 47 }, // X or Z usually map here
  { latin: "S", rune: "ᛋ", prime: 53 },
  { latin: "T", rune: "ᛏ", prime: 59 },
  { latin: "B", rune: "ᛒ", prime: 61 },
  { latin: "E", rune: "ᛖ", prime: 67 },
  { latin: "M", rune: "ᛗ", prime: 71 },
  { latin: "L", rune: "ᛚ", prime: 73 },
  { latin: "ING", rune: "ᛜ", prime: 79 },
  { latin: "OE", rune: "ᛟ", prime: 83 },
  { latin: "D", rune: "ᛞ", prime: 89 },
];

// Mapping helper tables
const runeToLatin: Record<string, string> = {};
const primeToLatin: Record<number, string> = {};
const primeToRune: Record<number, string> = {};

GEMATRIA_TABLE.forEach((item) => {
  runeToLatin[item.rune] = item.latin;
  primeToLatin[item.prime] = item.latin;
  primeToRune[item.prime] = item.rune;
});

// Greedy tokenizer for Latin text matching larger tokens first ("ING", "THE" etc.)
function tokenizeLatin(text: string): string[] {
  const upper = text.toUpperCase();
  const tokens: string[] = [];
  let i = 0;

  while (i < upper.length) {
    // Check 3-character tokens ("ING")
    if (i + 3 <= upper.length && upper.slice(i, i + 3) === "ING") {
      tokens.push("ING");
      i += 3;
      continue;
    }
    // Check 2-character tokens ("TH", "EO", "OE")
    if (i + 2 <= upper.length) {
      const duo = upper.slice(i, i + 2);
      if (duo === "TH" || duo === "EO" || duo === "OE") {
        tokens.push(duo);
        i += 2;
        continue;
      }
    }
    // Check 3-character "GER"
    if (i + 3 <= upper.length && upper.slice(i, i + 3) === "GER") {
      tokens.push("J"); // Maps to J's rune ᛡ
      i += 3;
      continue;
    }
    // Single character
    tokens.push(upper[i]);
    i += 1;
  }

  return tokens;
}

export function gematriaEncode(text: string, options?: ToolOptions): TransformOutput {
  if (!text) return "";
  const format = (options?.format as "runes" | "primes" | "latin") || "runes";
  const tokens = tokenizeLatin(text);

  if (format === "primes") {
    const primeSequence: string[] = [];
    tokens.forEach((tok) => {
      // Find matching table entry
      let entry = GEMATRIA_TABLE.find((e) => e.latin === tok);
      if (!entry && tok === "K") {
        entry = GEMATRIA_TABLE.find((e) => e.latin === "C");
      }
      if (!entry && tok === "Z") {
        entry = GEMATRIA_TABLE.find((e) => e.latin === "X");
      }

      if (entry) {
        primeSequence.push(entry.prime.toString());
      } else {
        // Pass non-mapped characters through as they are, or skip if spacing
        if (tok === " ") {
          // Keep a gap indicator or just space
          primeSequence.push("-");
        } else if (/\s/.test(tok)) {
          // skip duplicate spaces or newlines
        } else {
          primeSequence.push(tok);
        }
      }
    });
    return primeSequence.join(" ");
  } else if (format === "latin") {
    /**
     * Latin transliteration: the table's own token per glyph, space separated.
     *
     * The options schema has always offered "Latin", but only "primes" was ever
     * branched on and everything else fell through to runes — so choosing Latin
     * silently produced rune output identical to the Runes option, and the
     * format was effectively dead.
     */
    return tokens
      .map((tok) => {
        let entry = GEMATRIA_TABLE.find((e) => e.latin === tok);
        if (!entry && tok === "K") entry = GEMATRIA_TABLE.find((e) => e.latin === "C");
        if (!entry && tok === "Z") entry = GEMATRIA_TABLE.find((e) => e.latin === "X");
        if (entry) return entry.latin;
        return /\s/.test(tok) ? "-" : tok;
      })
      .join(" ");
  } else {
    // Format is "runes"
    let runeStr = "";
    tokens.forEach((tok) => {
      let entry = GEMATRIA_TABLE.find((e) => e.latin === tok);
      if (!entry && tok === "K") {
        entry = GEMATRIA_TABLE.find((e) => e.latin === "C");
      }
      if (!entry && tok === "Z") {
        entry = GEMATRIA_TABLE.find((e) => e.latin === "X");
      }

      if (entry) {
        runeStr += entry.rune;
      } else {
        runeStr += tok; // Pass through spaces, punctuation, etc.
      }
    });
    return runeStr;
  }
}

export function gematriaDecode(input: string, options?: ToolOptions): TransformOutput {
  if (!input) return "";
  const format = (options?.format as "runes" | "primes" | "latin") || "runes";

  if (format === "latin") {
    // Space-separated transliteration tokens back to a plain string.
    return input
      .trim()
      .split(/\s+/)
      .map((tok) => (tok === "-" ? " " : tok))
      .join("");
  }

  if (format === "primes") {
    // Input is space-separated primes or pass-through characters
    const parts = input.trim().split(/\s+/);
    let latinStr = "";

    parts.forEach((part) => {
      const primeVal = parseInt(part, 10);
      if (!isNaN(primeVal) && primeToLatin[primeVal]) {
        latinStr += primeToLatin[primeVal];
      } else if (part === "-") {
        latinStr += " ";
      } else {
        latinStr += part; // Pass-through
      }
    });
    return latinStr;
  } else {
    // Input is rune characters
    let latinStr = "";
    let i = 0;
    while (i < input.length) {
      const char = input[i];
      if (runeToLatin[char]) {
        latinStr += runeToLatin[char];
      } else {
        latinStr += char; // Pass through spaces, punctuation, etc.
      }
      i++;
    }
    return latinStr;
  }
}
