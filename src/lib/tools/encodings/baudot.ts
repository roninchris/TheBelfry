import { ToolOptions } from "../types";

/**
 * Baudot ITA2 (5-bit code)
 */

const LTRS = 0x1F;
const FIGS = 0x1B;

const TABLE: Record<string, { ltrs: number; figs: number }> = {
  "A": { ltrs: 0x03, figs: 0x03 }, // -
  "B": { ltrs: 0x19, figs: 0x19 }, // ?
  "C": { ltrs: 0x0E, figs: 0x0E }, // :
  "D": { ltrs: 0x09, figs: 0x09 }, // $
  "E": { ltrs: 0x01, figs: 0x01 }, // 3
  "F": { ltrs: 0x0D, figs: 0x0D }, // !
  "G": { ltrs: 0x1A, figs: 0x1A }, // &
  "H": { ltrs: 0x14, figs: 0x14 }, // #
  "I": { ltrs: 0x06, figs: 0x06 }, // 8
  "J": { ltrs: 0x0B, figs: 0x0B }, // '
  "K": { ltrs: 0x0F, figs: 0x0F }, // (
  "L": { ltrs: 0x12, figs: 0x12 }, // )
  "M": { ltrs: 0x1C, figs: 0x1C }, // .
  "N": { ltrs: 0x0C, figs: 0x0C }, // ,
  "O": { ltrs: 0x18, figs: 0x18 }, // 9
  "P": { ltrs: 0x16, figs: 0x16 }, // 0
  "Q": { ltrs: 0x17, figs: 0x17 }, // 1
  "R": { ltrs: 0x0A, figs: 0x0A }, // 4
  "S": { ltrs: 0x05, figs: 0x05 }, // '
  "T": { ltrs: 0x10, figs: 0x10 }, // 5
  "U": { ltrs: 0x07, figs: 0x07 }, // 7
  "V": { ltrs: 0x1E, figs: 0x1E }, // ;
  "W": { ltrs: 0x13, figs: 0x13 }, // 2
  "X": { ltrs: 0x1D, figs: 0x1D }, // /
  "Y": { ltrs: 0x15, figs: 0x15 }, // 6
  "Z": { ltrs: 0x11, figs: 0x11 }, // "
  " ": { ltrs: 0x04, figs: 0x04 },
  "\n": { ltrs: 0x08, figs: 0x08 }, // Carriage Return
  "\r": { ltrs: 0x02, figs: 0x02 }, // Line Feed
};

const FIGS_MAP: Record<string, string> = {
  "-": "A", "?": "B", ":": "C", "$": "D", "3": "E", "!": "F", "&": "G", "#": "H", "8": "I", "'": "J",
  "(": "K", ")": "L", ".": "M", ",": "N", "9": "O", "0": "P", "1": "Q", "4": "R", "5": "T",
  "7": "U", ";": "V", "2": "W", "/": "X", "6": "Y", "\"": "Z"
};

const REVERSE_LTRS: Record<number, string> = {};
const REVERSE_FIGS: Record<number, string> = {};
for (const char in TABLE) {
  REVERSE_LTRS[TABLE[char].ltrs] = char;
}
for (const fig in FIGS_MAP) {
  const ltr = FIGS_MAP[fig];
  REVERSE_FIGS[TABLE[ltr].figs] = fig;
}
REVERSE_FIGS[0x04] = " ";
REVERSE_FIGS[0x08] = "\n";
REVERSE_FIGS[0x02] = "\r";

export function baudotEncode(text: string): string {
  let result = "";
  let isFigs = false;
  const upper = text.toUpperCase();

  for (const char of upper) {
    if (TABLE[char]) {
      if (isFigs) {
        result += LTRS.toString(2).padStart(5, "0") + " ";
        isFigs = false;
      }
      result += TABLE[char].ltrs.toString(2).padStart(5, "0") + " ";
    } else if (FIGS_MAP[char]) {
      if (!isFigs) {
        result += FIGS.toString(2).padStart(5, "0") + " ";
        isFigs = true;
      }
      const ltr = FIGS_MAP[char];
      result += TABLE[ltr].figs.toString(2).padStart(5, "0") + " ";
    }
  }
  return result.trim();
}

export function baudotDecode(text: string): string {
  const codes = text.trim().split(/\s+/);
  let result = "";
  let isFigs = false;

  for (const codeStr of codes) {
    const code = parseInt(codeStr, 2);
    if (isNaN(code)) continue;

    if (code === LTRS) {
      isFigs = false;
    } else if (code === FIGS) {
      isFigs = true;
    } else {
      if (isFigs) {
        result += REVERSE_FIGS[code] || REVERSE_LTRS[code] || "";
      } else {
        result += REVERSE_LTRS[code] || "";
      }
    }
  }
  return result;
}
