import { ToolOptions } from "../types";

/**
 * Geek Code Block Wrapper
 */

export function geekCodeEncode(text: string): string {
  return `-----BEGIN GEEK CODE BLOCK-----
Version: 3.1
${text}
-----END GEEK CODE BLOCK-----`;
}

export function geekCodeDecode(text: string): string {
  const start = "-----BEGIN GEEK CODE BLOCK-----";
  const end = "-----END GEEK CODE BLOCK-----";
  
  let content = text;
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end);

  if (startIdx !== -1 && endIdx !== -1) {
    content = text.substring(startIdx + start.length, endIdx).trim();
    // Remove version line if present
    content = content.replace(/^Version:.*$/m, "").trim();
  }
  
  return content;
}
