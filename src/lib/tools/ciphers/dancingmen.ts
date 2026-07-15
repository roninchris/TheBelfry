import { ToolOptions, TransformOutput } from "../types";

/**
 * Dancing Men Cipher (Sherlock Holmes)
 * Represented as symbolic notation codes [Mxx] for regular poses
 * and [Fxx] for poses holding a flag (usually indicates end of word).
 */
export function dancingMenEncode(text: string): string {
  const words = text.toUpperCase().split(/\s+/);
  return words
    .map((word) => {
      return word
        .split("")
        .map((char, index) => {
          const code = char.charCodeAt(0) - 64;
          if (code < 1 || code > 26) return char;
          const isLast = index === word.length - 1;
          const prefix = isLast ? "F" : "M";
          const num = code.toString().padStart(2, "0");
          return `[${prefix}${num}]`;
        })
        .join("");
    })
    .join(" ");
}

export function dancingMenDecode(text: string): string {
  return text
    .split(" ")
    .map((word) => {
      const symbols = word.match(/\[[MF]\d{2}\]/g) || [];
      if (symbols.length === 0) return word;
      return symbols
        .map((sym) => {
          const num = parseInt(sym.substring(2, 4), 10);
          return String.fromCharCode(num + 64);
        })
        .join("");
    })
    .join(" ");
}
