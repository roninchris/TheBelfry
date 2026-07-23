/**
 * Anagram Solver — a utility tool for The Codex.
 *
 * Puzzle intercepts (and a lot of CTF flags) hide their payload as a jumble of
 * letters. This tool takes such a jumble and reveals the real words hiding in
 * it, checked against a full dictionary. Two modes cover the two questions an
 * analyst actually asks:
 *
 *   - EXACT: which dictionary words use *every* input letter, rearranged? This
 *     is the classic anagram ("LISTEN" -> "SILENT").
 *   - SUBWORDS: which dictionary words can be spelled from *some* of the input
 *     letters? Longest first — useful for pulling a hidden word out of a longer
 *     scramble, or seeing every playable word (Scrabble-style).
 *
 * It solves against English, Portuguese or Latin — the same three languages the
 * plaintext scorer recognises — or all three at once, tagging each hit with the
 * language(s) it belongs to. A custom dictionary can be pasted to override the
 * built-in ones.
 *
 * The three language dictionaries are large (hundreds of thousands of words
 * each), so they are NOT bundled into the boot payload: they live as static
 * text assets under public/dictionaries and are fetched lazily the first time a
 * language is used, then cached. English is warmed in the background at load so
 * the default is ready by the time the operator reaches for it. There is no
 * inverse operation, so encode and decode both simply solve.
 */

import type { ToolOptions, TransformOutput } from "../types";
import { assetUrl } from "../../assetUrl";

/** Cap on how many candidates we emit, so a vowel-heavy scramble can't flood the console. */
const MAX_RESULTS = 400;

type LangCode = "EN" | "PT" | "LA";

const LANG_META: Record<LangCode, { name: string; file: string }> = {
  EN: { name: "English", file: "dictionaries/en.txt" },
  PT: { name: "Portuguese", file: "dictionaries/pt.txt" },
  LA: { name: "Latin", file: "dictionaries/la.txt" },
};

// Loaded word lists, cached per language. `loadState` tracks an in-flight fetch
// (so a second solve doesn't kick a duplicate request) or a failed one.
const wordCache: Partial<Record<LangCode, string[]>> = {};
const loadState: Partial<Record<LangCode, "loading" | "error">> = {};

/** Kick off (or no-op) the lazy fetch of a language's dictionary. */
function ensureLoaded(code: LangCode): void {
  if (typeof fetch === "undefined") return; // non-browser (tests / typecheck)
  if (wordCache[code] || loadState[code] === "loading") return;
  loadState[code] = "loading";
  fetch(assetUrl(LANG_META[code].file))
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => {
      // The files are already normalised (lowercase a-z, one word per line).
      wordCache[code] = text.split("\n").filter((w) => w.length > 0);
      delete loadState[code];
    })
    .catch(() => {
      loadState[code] = "error";
    });
}

// Warm the default language in the background so it is ready by first use.
ensureLoaded("EN");

/** Multiset "signature" of a word: its letters sorted. Two words are exact anagrams iff their signatures match. */
function signature(letters: string): string {
  return letters.split("").sort().join("");
}

/** Per-letter counts, a-z indexed 0..25. Input must already be normalised. */
function letterCounts(letters: string): Int16Array {
  const counts = new Int16Array(26);
  for (let i = 0; i < letters.length; i++) {
    counts[letters.charCodeAt(i) - 97]++;
  }
  return counts;
}

/**
 * Reduce arbitrary input to lowercase a-z, folding accents (á→a, ç→c, ã→a) onto
 * their base letter so Portuguese/Latin input matches the folded dictionaries.
 */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

interface Dict {
  code: LangCode | "CUSTOM";
  name: string;
  words: string[];
}

/**
 * Exact-anagram index: signature -> the words sharing it. Built once per word
 * list and memoised (the language lists are reused across every solve).
 */
const exactIndexCache = new WeakMap<string[], Map<string, string[]>>();

function getExactIndex(words: string[]): Map<string, string[]> {
  const cached = exactIndexCache.get(words);
  if (cached) return cached;

  const index = new Map<string, string[]>();
  for (const w of words) {
    if (w.length === 0) continue;
    const sig = signature(w);
    const bucket = index.get(sig);
    if (bucket) bucket.push(w);
    else index.set(sig, [w]);
  }
  exactIndexCache.set(words, index);
  return index;
}

/** A solved candidate: the word plus which active languages contain it. */
interface Candidate {
  word: string;
  langs: string[];
}

function solveExact(input: string, dicts: Dict[]): Candidate[] {
  const sig = signature(input);
  const byWord = new Map<string, Set<string>>();
  for (const dict of dicts) {
    const matches = getExactIndex(dict.words).get(sig) ?? [];
    for (const w of matches) {
      if (w === input) continue; // an anagram is a *different* arrangement
      const langs = byWord.get(w) ?? new Set<string>();
      langs.add(dict.code);
      byWord.set(w, langs);
    }
  }
  return [...byWord.entries()]
    .map(([word, langs]) => ({ word, langs: [...langs] }))
    .sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
}

function solveSubwords(input: string, dicts: Dict[], minLength: number): Candidate[] {
  const available = letterCounts(input);
  const byWord = new Map<string, Set<string>>();

  for (const dict of dicts) {
    for (const w of dict.words) {
      if (w.length < minLength || w.length > input.length || w === input) continue;

      const seen = byWord.get(w);
      if (seen) {
        seen.add(dict.code); // already known to fit — just tag the language
        continue;
      }

      const need = letterCounts(w);
      let fits = true;
      for (let i = 0; i < 26; i++) {
        if (need[i] > available[i]) {
          fits = false;
          break;
        }
      }
      if (fits) byWord.set(w, new Set([dict.code]));
    }
  }

  return [...byWord.entries()]
    .map(([word, langs]) => ({ word, langs: [...langs] }))
    // Longest first (the most useful hit), then alphabetically for stability.
    .sort((a, b) => b.word.length - a.word.length || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
}

/** Which languages a run should search, from the `language` option. */
function resolveLanguages(options?: ToolOptions): LangCode[] {
  switch (options?.language) {
    case "pt":
      return ["PT"];
    case "la":
      return ["LA"];
    case "all":
      return ["EN", "PT", "LA"];
    default:
      return ["EN"];
  }
}

function formatOutput(
  input: string,
  candidates: Candidate[],
  mode: "exact" | "subwords",
  minLength: number,
  sourceLabel: string,
  showTags: boolean,
): string {
  const upper = input.toUpperCase();
  const modeLabel = mode === "exact" ? "EXACT ANAGRAMS" : `SUBWORDS (MIN ${minLength})`;

  const header = [
    `▓ ANAGRAM SOLVER · ${modeLabel}`,
    `▪ LETTERS: ${upper} (${input.length}) · SOURCE: ${sourceLabel}`,
  ];

  if (candidates.length === 0) {
    const reason =
      mode === "exact"
        ? "No dictionary word is an exact rearrangement of these letters."
        : "No dictionary word can be spelled from these letters.";
    header.push(`▪ NO MATCHES · ${reason}`);
    if (mode === "exact") header.push("▪ Try SUBWORDS mode, or switch language / paste a custom dictionary.");
    return header.join("\n");
  }

  const shown = candidates.slice(0, MAX_RESULTS);
  const truncated = candidates.length - shown.length;
  header.push(
    `▪ ${candidates.length} MATCH${candidates.length === 1 ? "" : "ES"}${truncated > 0 ? ` (showing ${shown.length})` : ""}`,
  );

  const body = shown
    .map((c) => (showTags ? `${c.word.toUpperCase()}  [${c.langs.join("·")}]` : c.word.toUpperCase()))
    .join("\n");

  const out = header.join("\n") + "\n\n" + body;
  return truncated > 0
    ? `${out}\n\n▪ …${truncated} more suppressed. Narrow the search or raise the minimum length.`
    : out;
}

/** Core solve — shared by both console buttons since the operation has no inverse. */
function solve(text: string, options?: ToolOptions): string {
  const input = normalise(text);
  if (input.length === 0) {
    return "▓ ANAGRAM SOLVER\n▪ NO LETTERS · Enter letters (A–Z) to unscramble.";
  }

  const mode = options?.mode === "subwords" ? "subwords" : "exact";
  const rawMin = Number(options?.minLength);
  const minLength = Number.isFinite(rawMin) && rawMin >= 2 ? Math.floor(rawMin) : 3;

  // A custom dictionary overrides the language selection entirely.
  const customRaw = typeof options?.dictionary === "string" ? options.dictionary.trim() : "";
  if (customRaw.length > 0) {
    const seen = new Set<string>();
    const words: string[] = [];
    for (const tok of customRaw.split(/[\s,]+/)) {
      const w = normalise(tok);
      if (w.length >= 2 && !seen.has(w)) {
        seen.add(w);
        words.push(w);
      }
    }
    if (words.length === 0) {
      return "▓ ANAGRAM SOLVER\n▪ EMPTY DICTIONARY · The custom dictionary contained no usable words.";
    }
    const dicts: Dict[] = [{ code: "CUSTOM", name: "Custom Dictionary", words }];
    const candidates = mode === "exact" ? solveExact(input, dicts) : solveSubwords(input, dicts, minLength);
    return formatOutput(input, candidates, mode, minLength, "CUSTOM DICTIONARY", false);
  }

  const codes = resolveLanguages(options);

  // Gate on the dictionaries being loaded. Any missing one is fetched now; the
  // operator re-runs once indexing completes (English is pre-warmed at boot).
  const pending: LangCode[] = [];
  const failed: LangCode[] = [];
  for (const code of codes) {
    if (wordCache[code]) continue;
    if (loadState[code] === "error") {
      failed.push(code);
    } else {
      ensureLoaded(code);
      pending.push(code);
    }
  }
  if (failed.length > 0) {
    const names = failed.map((c) => LANG_META[c].name).join(", ");
    return `▓ ANAGRAM SOLVER\n▪ DICTIONARY UNAVAILABLE · Could not load ${names}. Check the connection and run again.`;
  }
  if (pending.length > 0) {
    const names = pending.map((c) => LANG_META[c].name).join(", ");
    return `▓ ANAGRAM SOLVER\n▪ INDEXING ${names.toUpperCase()} LEXICON… · Large dictionary loading — press RUN again in a moment.`;
  }

  const dicts: Dict[] = codes.map((code) => ({ code, name: LANG_META[code].name, words: wordCache[code]! }));
  const sourceLabel = codes.length === 1 ? `${LANG_META[codes[0]].name.toUpperCase()} DICTIONARY` : "ALL LANGUAGES";
  const showTags = codes.length > 1;

  const candidates = mode === "exact" ? solveExact(input, dicts) : solveSubwords(input, dicts, minLength);
  return formatOutput(input, candidates, mode, minLength, sourceLabel, showTags);
}

export function anagramEncode(text: string, options?: ToolOptions): TransformOutput {
  return solve(text, options);
}

export function anagramDecode(text: string, options?: ToolOptions): TransformOutput {
  return solve(text, options);
}
