import { ToolOptions } from "../types";

/**
 * Pig Latin Translator
 */

function translateWord(word: string): string {
  if (!word) return "";
  const match = word.match(/^([^aeiouAEIOU]+)(.*)$/);
  if (match) {
    const consonants = match[1];
    const rest = match[2];
    // Preserve casing roughly
    const isUpper = word[0] === word[0].toUpperCase() && word.length > 1;
    let result = rest + consonants.toLowerCase() + "ay";
    if (isUpper) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
  }
  return word + "way";
}

function decodeWord(word: string): string {
  if (word.endsWith("way")) {
    return word.slice(0, -3);
  }
  if (word.endsWith("ay")) {
    const base = word.slice(0, -2);
    // This is lossy as we don't know how many consonants were moved
    // Standard reverse is hard without a dictionary, but we'll try the last char move
    const lastChar = base.slice(-1);
    return lastChar + base.slice(0, -1);
  }
  return word;
}

export function pigLatinEncode(text: string): string {
  return text.split(/\b/).map(word => {
    if (/^[a-zA-Z]+$/.test(word)) {
      return translateWord(word);
    }
    return word;
  }).join("");
}

export function pigLatinDecode(text: string): string {
  return text.split(/\b/).map(word => {
    if (/^[a-zA-Z]+$/.test(word)) {
      return decodeWord(word);
    }
    return word;
  }).join("");
}
