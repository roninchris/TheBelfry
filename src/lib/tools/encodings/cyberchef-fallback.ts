/**
 * CyberChef fallback placeholder.
 * 
 * NOTE: CyberChef's Node.js API is incompatible with this environment due to:
 * - Broken dependency chain (crypto-api has missing imports)
 * - Not designed for browser/Vite bundling
 * - Requires Node.js-specific features that don't work in the browser
 * 
 * Future encodings (ROT13/47, Base32/58/85, etc.) should be hand-rolled
 * in plain TypeScript rather than relying on CyberChef's bake() API.
 */

export function cyberChefBake(
  input: string,
  recipe: string | string[]
): string {
  return "ERROR: CyberChef not available in this environment";
}

/** Placeholder encodings - to be hand-rolled in future phases. */
export const cyberChefEncodings = {
  rot13: (text: string) => cyberChefBake(text, "ROT13"),
  rot47: (text: string) => cyberChefBake(text, "ROT47"),
  base32: (text: string) => cyberChefBake(text, "To Base32"),
  base32Decode: (text: string) => cyberChefBake(text, "From Base32"),
  base58: (text: string) => cyberChefBake(text, "To Base58"),
  base58Decode: (text: string) => cyberChefBake(text, "From Base58"),
  base85: (text: string) => cyberChefBake(text, "To Base85"),
  base85Decode: (text: string) => cyberChefBake(text, "From Base85"),
} as const;
