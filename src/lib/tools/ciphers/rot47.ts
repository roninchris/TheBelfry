/** ROT47 — self-inverse substitution over printable ASCII 33-126 */
export function rot47(text: string): string {
  return text.replace(/[!-~]/g, (c) => {
    const code = c.charCodeAt(0);
    return String.fromCharCode(33 + ((code - 33 + 47) % 94));
  });
}

// encode and decode are the same operation (self-inverse)
export const rot47Encode = rot47;
export const rot47Decode = rot47;