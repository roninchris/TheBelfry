/**
 * Cipher taxonomy overlay — NON-DESTRUCTIVE.
 *
 * This file does NOT modify the tool registry or how tools are stored. It is a
 * read-only classification layer that groups the Crypto Lab's ciphers into a
 * real cryptographic taxonomy for information architecture (categorized
 * browsing, filtering). Any cipher id not explicitly mapped falls back to the
 * "specialty" group, so a cipher can never be hidden or lost.
 */
import { useCallback, useEffect, useState } from "react";

export type CipherGroupId =
  | "substitution"
  | "polyalphabetic"
  | "polygraphic"
  | "transposition"
  | "modern"
  | "symbolic"
  | "specialty";

export interface CipherGroup {
  id: CipherGroupId;
  label: string; // full section header
  short: string; // compact filter-chip label
  blurb: string; // one-line description
}

/** Ordered so the browsing hierarchy reads most-common → most-exotic. */
export const CIPHER_GROUPS: CipherGroup[] = [
  { id: "substitution", label: "Substitution", short: "SUB", blurb: "Monoalphabetic letter-for-letter mappings" },
  { id: "polyalphabetic", label: "Polyalphabetic", short: "POLY", blurb: "Keyword-driven shifting alphabets" },
  { id: "polygraphic", label: "Polygraphic & Grid", short: "GRID", blurb: "Matrix & fractionation ciphers" },
  { id: "transposition", label: "Transposition", short: "TRANS", blurb: "Character-reordering schemes" },
  { id: "modern", label: "Machine & Modern", short: "MODERN", blurb: "Rotor machines & computational crypto" },
  { id: "symbolic", label: "Symbolic & Puzzle", short: "SYMBOL", blurb: "Visual, glyphic & ARG ciphers" },
  { id: "specialty", label: "Specialty", short: "MISC", blurb: "Uncategorized engines" },
];

const ID_TO_GROUP: Record<string, CipherGroupId> = {
  // Substitution — monoalphabetic
  caesar: "substitution",
  atbash: "substitution",
  rot13: "substitution",
  rot5: "substitution",
  rot18: "substitution",
  rotn: "substitution",
  keyedcaesar: "substitution",
  affine: "substitution",
  substitution: "substitution",
  cryptogram: "substitution",
  homophonic: "substitution",
  gematria: "substitution",
  a1z26: "substitution",
  bacon: "substitution",
  rot47: "substitution",
  // Polyalphabetic
  vigenere: "polyalphabetic",
  vigenereautokey: "polyalphabetic",
  beaufort: "polyalphabetic",
  beaufortautokey: "polyalphabetic",
  variantbeaufort: "polyalphabetic",
  gronsfeld: "polyalphabetic",
  nihilist: "polyalphabetic",
  onetimepad: "polyalphabetic",
  // Polygraphic & grid / fractionation
  playfair: "polygraphic",
  bifid: "polygraphic",
  trifid: "polygraphic",
  hill: "polygraphic",
  foursquare: "polygraphic",
  adfgx: "polygraphic",
  adfgvx: "polygraphic",
  grandpre: "polygraphic",
  polybius: "polygraphic",
  // Transposition
  railfence: "transposition",
  columnar: "transposition",
  doubletransposition: "transposition",
  amsco: "transposition",
  route: "transposition",
  scytale: "transposition",
  // Machine & modern / computational
  enigma: "modern",
  aes: "modern",
  des: "modern",
  blowfish: "modern",
  rc4: "modern",
  rsa: "modern",
  xor: "modern",
  // Symbolic, visual & puzzle
  pigpen: "symbolic",
  dancingmen: "symbolic",
  morbit: "symbolic",
  pollux: "symbolic",
  cicada: "symbolic",
  bookcipher: "symbolic",
};

export function groupForCipher(id: string): CipherGroupId {
  return ID_TO_GROUP[id] ?? "specialty";
}

/* -------------------------------------------------------------------------- */
/* Favorites & recents — localStorage-backed, isolated from app state.         */
/* -------------------------------------------------------------------------- */

const FAV_KEY = "belfry.crypto.favorites";
const RECENT_KEY = "belfry.crypto.recents";
const MAX_RECENTS = 8;

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useCipherPrefs() {
  const [favorites, setFavorites] = useState<string[]>(() => readIds(FAV_KEY));
  const [recents, setRecents] = useState<string[]>(() => readIds(RECENT_KEY));

  useEffect(() => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
    } catch {}
  }, [recents]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]));
  }, []);

  const pushRecent = useCallback((id: string) => {
    setRecents((r) => [id, ...r.filter((x) => x !== id)].slice(0, MAX_RECENTS));
  }, []);

  return { favorites, recents, toggleFavorite, pushRecent };
}
