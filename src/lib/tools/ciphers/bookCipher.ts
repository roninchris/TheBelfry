/** Book Cipher - decode mapping coordinates to reference text */

import type { ToolOptions, TransformOutput } from "../types";

export function bookCipherEncode(text: string, options?: ToolOptions): TransformOutput {
  throw new Error("Book cipher encoding is not auto-generated because it requires matching words against a specific reference text.");
}

export function bookCipherDecode(input: string, options?: ToolOptions): TransformOutput {
  const refText = (options?.referenceText as string | undefined) || "";
  const sep = (options?.separator as string | undefined) || "-";

  if (!refText.trim()) {
    throw new Error("Reference text is required for Book Cipher decoding.");
  }

  if (!input.trim()) {
    return "";
  }

  // Tokenize referenceText: split by blank lines to get paragraphs, then by newlines to get lines, then by whitespace to get words
  const paragraphs = refText
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const doc = paragraphs.map((p) => {
    const lines = p
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return lines.map((l) => l.split(/\s+/).filter((w) => w.length > 0));
  });

  const coordinateGroups = input.trim().split(/\s+/);
  let decodedMessage = "";

  for (const group of coordinateGroups) {
    const parts = group.split(sep);
    if (parts.length < 3) {
      throw new Error(`Invalid coordinate group format: '${group}'. Expected [paragraph]${sep}[line]${sep}[word].`);
    }

    const pIdx = parseInt(parts[0], 10);
    const lIdx = parseInt(parts[1], 10);
    const wIdx = parseInt(parts[2], 10);

    if (isNaN(pIdx) || isNaN(lIdx) || isNaN(wIdx)) {
      throw new Error(`Invalid non-numeric coordinates in group: '${group}'`);
    }

    if (pIdx < 1 || pIdx > doc.length) {
      throw new Error(`Paragraph coordinate ${pIdx} is out of bounds. The reference text has ${doc.length} paragraph(s).`);
    }

    const paragraph = doc[pIdx - 1];
    if (lIdx < 1 || lIdx > paragraph.length) {
      throw new Error(`Line coordinate ${lIdx} is out of bounds for paragraph ${pIdx}. Paragraph ${pIdx} has ${paragraph.length} line(s).`);
    }

    const line = paragraph[lIdx - 1];
    if (wIdx < 1 || wIdx > line.length) {
      throw new Error(`Word coordinate ${wIdx} is out of bounds for paragraph ${pIdx}, line ${lIdx}. That line has ${line.length} word(s).`);
    }

    const word = line[wIdx - 1];
    if (!word || word.length === 0) {
      throw new Error(`Targeted word at paragraph ${pIdx}, line ${lIdx}, word ${wIdx} is empty.`);
    }

    decodedMessage += word[0];
  }

  return decodedMessage;
}
