/** Bacon cipher (classic 24-code variant, I/J and U/V share a code) — ported from cryptii's BaconCipher encoder */
const BACON_TABLE = [
  "AAAAA", "AAAAB", "AAABA", "AAABB", "AABAA", "AABAB", "AABBA", "AABBB",
  "ABAAA", "ABAAA", "ABAAB", "ABABA", "ABABB", "ABBAA", "ABBAB", "ABBBA",
  "ABBBB", "BAAAA", "BAAAB", "BAABA", "BAABB", "BAABB", "BABAA", "BABAB",
  "BABBA", "BABBB",
]; // index 0=A ... 25=Z; I/J share index 8, U/V share index 20

export function baconEncode(text: string): string {
  return text
    .toUpperCase()
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0) - 65;
      if (code < 0 || code > 25) return null;
      return BACON_TABLE[code];
    })
    .filter((x): x is string => x !== null)
    .join(" ");
}

export function baconDecode(text: string): string {
  const groups = (text.replace(/[^AaBb]/g, "").toUpperCase().match(/.{1,5}/g) || []);
  return groups
    .map((g) => {
      const idx = BACON_TABLE.indexOf(g);
      return idx === -1 ? "" : String.fromCharCode(65 + idx);
    })
    .join("");
}