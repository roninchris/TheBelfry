const GRID: string[] = [
  "A", "B", "C", "D", "E",
  "F", "G", "H", "I", "K",
  "L", "M", "N", "O", "P",
  "Q", "R", "S", "T", "U",
  "V", "W", "X", "Y", "Z",
];

const charToCode: Record<string, string> = {};
const codeToChar: Record<string, string> = {};
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const ch = GRID[r * 5 + c];
    const code = `${r + 1}${c + 1}`;
    charToCode[ch] = code;
    codeToChar[code] = ch;
  }
}
// Map J to I code as common Polybius convention
charToCode["J"] = charToCode["I"];

export function polybiusEncode(text: string): string {
  const up = text.toUpperCase();
  const parts: string[] = [];
  for (const ch of up) {
    if (/[A-Z]/.test(ch)) {
      const mapped = ch === "J" ? "I" : ch;
      const code = charToCode[mapped];
      if (code) parts.push(code);
    } else if (ch === " ") {
      parts.push("/");
    }
  }
  return parts.join(" ");
}

export function polybiusDecode(text: string): string {
  const tokens = text.trim().split(/\s+/);
  const chars: string[] = [];
  for (const tok of tokens) {
    if (tok === "/") {
      chars.push(" ");
    } else if (/^[1-5][1-5]$/.test(tok)) {
      const ch = codeToChar[tok];
      if (ch) chars.push(ch);
    }
  }
  return chars.join("");
}
