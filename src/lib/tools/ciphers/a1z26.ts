/** A1Z26 letter-number cipher — ported from cryptii's A1Z26 encoder */
export function a1z26Encode(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 97 && code <= 122) return (code - 96).toString();
      return null;
    })
    .filter((x): x is string => x !== null)
    .join(" ");
}

export function a1z26Decode(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const n = parseInt(tok, 10);
      if (isNaN(n) || n < 1 || n > 26) return "";
      return String.fromCharCode(96 + n);
    })
    .join("");
}