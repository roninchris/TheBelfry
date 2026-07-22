/**
 * Multilingual plaintext detection.
 *
 * The cipher identifier and the brute-force ranker both need to answer one
 * question about a candidate decode: "does this read as a real language?" The
 * old answer was English-only — a correct Portuguese or Latin decode scored no
 * better than gibberish, so a brute-force sweep buried the right key and the
 * identifier reported "no signal". This module scores a string against English,
 * Portuguese and Latin at once and returns the best fit, so a solved message in
 * any of the three rises to the top on its own merits.
 *
 * Two independent signals are combined per language, because either alone is
 * foolable:
 *   - dictionary coverage: how many tokens are real words. Strongest signal,
 *     but blind to space-stripped output (transposition ciphers).
 *   - letter-frequency fit (chi-squared per letter): survives missing spaces,
 *     and the per-language tables are what separate Latin (no J/K/W/Y) from
 *     Portuguese (vowel-heavy) from English.
 */

export type LanguageCode = "EN" | "PT" | "LA";

/** Fold accented characters onto their base letter so "NÃO"/"CÉSAR" match. */
function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

interface LangProfile {
  code: LanguageCode;
  name: string;
  words: Set<string>;
  /** Letter frequency in percent. Absent letters are penalised via a small floor. */
  freq: Record<string, number>;
}

// --- Word lists (uppercase, unaccented). Deliberately the highest-frequency
//     function words of each language, since those are what a short intercept
//     is most likely to contain and are the cheapest reliable signal. ---

const EN_WORDS = [
  "THE", "AND", "THAT", "HAVE", "FOR", "NOT", "WITH", "YOU", "THIS", "BUT",
  "FROM", "THEY", "HER", "SHE", "WILL", "ONE", "ALL", "WOULD", "THERE", "WHAT",
  "OUT", "ABOUT", "WHO", "GET", "WHICH", "WHEN", "MAKE", "CAN", "LIKE", "TIME",
  "JUST", "HIM", "KNOW", "TAKE", "INTO", "YEAR", "YOUR", "GOOD", "SOME", "THEM",
  "SEE", "OTHER", "THAN", "THEN", "NOW", "LOOK", "ONLY", "OVER", "ALSO", "BACK",
  "AFTER", "USE", "TWO", "HOW", "OUR", "WORK", "FIRST", "WELL", "WAY", "EVEN",
  "NEW", "WANT", "ANY", "ARE", "WAS", "HAS", "HAD", "HERE", "MEET", "SECRET",
  "MESSAGE", "TARGET", "NORTH", "SOUTH", "EAST", "WEST", "BRIDGE", "CODE", "KEY",
  "AT", "ON", "IN", "IT", "IS", "OF", "TO", "BE", "AS", "BY", "OR", "AN", "IF", "WE", "HE",
];

const PT_WORDS = [
  "DE", "QUE", "NAO", "UMA", "COM", "PARA", "OS", "SE", "NA", "POR",
  "MAIS", "AS", "DOS", "COMO", "MAS", "AO", "ELE", "DAS", "SEU", "SUA",
  "OU", "QUANDO", "MUITO", "NOS", "JA", "EU", "TAMBEM", "PELO", "PELA", "ATE",
  "ISSO", "ELA", "ENTRE", "ERA", "DEPOIS", "SEM", "MESMO", "AOS", "SER", "QUEM",
  "NAS", "ESSE", "ESSA", "NUM", "NEM", "MEU", "MINHA", "VOCE", "ESTE", "ESTA",
  "SAO", "TEM", "FOI", "SOBRE", "ONDE", "AGORA", "ANOS", "DIA", "CASA", "TEMPO",
  "FAZER", "PODE", "BEM", "ISTO", "TUDO", "NADA", "CADA", "ENTAO", "ASSIM", "AINDA",
  "UM", "DO", "DA", "EM", "NO", "OA", "TE", "ME", "LHE", "REI", "NOITE", "PONTE",
  "NORTE", "SUL", "LESTE", "OESTE", "CHAVE", "SEGREDO", "ALVO", "MENSAGEM",
];

const LA_WORDS = [
  "ET", "IN", "EST", "NON", "AD", "QUOD", "QUI", "CUM", "SED", "UT",
  "SI", "QUAE", "EX", "DE", "SUNT", "PER", "AUT", "HOC", "ESSE", "ENIM",
  "ATQUE", "QUAM", "NEC", "ME", "TE", "SE", "NOS", "VOS", "EO", "EA",
  "ID", "QUIS", "QUID", "OMNIA", "OMNIS", "TAMEN", "IAM", "ERGO", "AUTEM", "VERO",
  "ETIAM", "QUOQUE", "NUNC", "TUM", "UBI", "IBI", "INTER", "ANTE", "POST", "SINE",
  "SUB", "SUPER", "CONTRA", "ERAT", "SUM", "REX", "DEUS", "TERRA", "BELLUM", "PAX",
  "AMOR", "VITA", "MORS", "TEMPUS", "MAGNUS", "BONUS", "PRIMUS", "DOMINUS", "RES", "CAUSA",
  "MANUS", "PARS", "LEX", "FIDES", "VIRTUS", "IGITUR", "QUIA", "NISI", "DUM", "DONEC",
  "SICUT", "AGER", "AQUA", "IGNIS", "URBS", "NOX", "DIES", "VIA", "PORTA", "GLADIUS",
];

const EN_FREQ: Record<string, number> = {
  A: 8.167, B: 1.492, C: 2.782, D: 4.253, E: 12.702, F: 2.228, G: 2.015, H: 6.094,
  I: 6.966, J: 0.153, K: 0.772, L: 4.025, M: 2.406, N: 6.749, O: 7.507, P: 1.929,
  Q: 0.095, R: 5.987, S: 6.327, T: 9.056, U: 2.758, V: 0.978, W: 2.360, X: 0.150,
  Y: 1.974, Z: 0.074,
};

const PT_FREQ: Record<string, number> = {
  A: 14.63, B: 1.04, C: 3.88, D: 4.99, E: 12.57, F: 1.02, G: 1.30, H: 1.28,
  I: 6.18, J: 0.40, K: 0.02, L: 2.78, M: 4.74, N: 5.05, O: 10.73, P: 2.52,
  Q: 1.20, R: 6.53, S: 7.81, T: 4.34, U: 4.63, V: 1.67, W: 0.01, X: 0.21,
  Y: 0.01, Z: 0.47,
};

// Classical Latin, approximated from prose corpora. J/K/W/Y are effectively
// absent, which is the strongest single discriminator for Latin.
const LA_FREQ: Record<string, number> = {
  A: 8.29, B: 1.60, C: 3.90, D: 3.00, E: 11.28, F: 0.90, G: 1.20, H: 0.80,
  I: 11.44, J: 0.01, K: 0.01, L: 3.50, M: 5.29, N: 6.29, O: 5.42, P: 3.00,
  Q: 1.50, R: 5.29, S: 7.02, T: 8.83, U: 8.85, V: 1.00, W: 0.01, X: 0.60,
  Y: 0.04, Z: 0.01,
};

const PROFILES: LangProfile[] = [
  { code: "EN", name: "English", words: new Set(EN_WORDS), freq: EN_FREQ },
  { code: "PT", name: "Portuguese", words: new Set(PT_WORDS), freq: PT_FREQ },
  { code: "LA", name: "Latin", words: new Set(LA_WORDS), freq: LA_FREQ },
];

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  EN: "English",
  PT: "Portuguese",
  LA: "Latin",
};

function isErrorText(text: string): boolean {
  return text.startsWith("[CHAIN ERROR]") || text.startsWith("[ERROR]") || text.startsWith("ERROR:");
}

/** Chi-squared per letter against a language table. Lower = closer fit. */
function chiPerLetter(letters: string, freq: Record<string, number>): number {
  const len = letters.length;
  if (len === 0) return Infinity;
  const counts: Record<string, number> = {};
  for (const c of letters) counts[c] = (counts[c] || 0) + 1;
  let chi = 0;
  for (let i = 65; i <= 90; i++) {
    const L = String.fromCharCode(i);
    // Floor keeps a language's "impossible" letters (e.g. Latin K/W) from a
    // divide-by-zero while still penalising them heavily when they appear.
    const expected = ((freq[L] ?? 0.01) / 100) * len;
    const observed = counts[L] || 0;
    chi += Math.pow(observed - expected, 2) / expected;
  }
  return chi / len;
}

export interface PlaintextAssessment {
  /** 0..100, the best score across the three languages. */
  score: number;
  /** Winning language, or null when nothing reads as language at all. */
  language: LanguageCode | null;
  languageName: string | null;
  /** Distinct dictionary words matched for the winning language (deduped, capped). */
  matched: string[];
}

const EMPTY: PlaintextAssessment = { score: 0, language: null, languageName: null, matched: [] };

/**
 * Scores text as plaintext across English, Portuguese and Latin, returning the
 * best fit. Space-preserving ciphers (Caesar, Vigenère, …) are scored mostly on
 * word coverage; space-stripping ciphers (transposition) fall back to letter
 * frequency and substring word hits.
 */
export function assessPlaintext(text: string): PlaintextAssessment {
  if (!text || text.trim().length === 0) return EMPTY;
  if (isErrorText(text)) return EMPTY;

  const norm = stripDiacritics(text).toUpperCase();
  const total = norm.length;

  // Printable gate: gibberish (control chars / symbol soup) is not any language.
  const printable = (norm.match(/[A-Z0-9\s.,!?'"\-()]/g) || []).length;
  const printableRatio = printable / total;
  if (printableRatio < 0.8) {
    return { ...EMPTY, score: Math.max(0, Math.round(printableRatio * 20)) };
  }

  const letters = norm.replace(/[^A-Z]/g, "");
  if (letters.length === 0) return EMPTY;

  const tokens = norm.split(/[^A-Z]/).filter((w) => w.length >= 2);
  const spaceCount = (norm.match(/ /g) || []).length;
  const spaceRatio = spaceCount / total;
  // Language-agnostic structure signal, computed once.
  const spaceScore =
    spaceRatio >= 0.1 && spaceRatio <= 0.22 ? 10 : spaceRatio > 0.05 && spaceRatio < 0.3 ? 5 : 0;

  let best: PlaintextAssessment = { ...EMPTY };
  let bestRaw = -1;

  for (const p of PROFILES) {
    // Token coverage — the primary signal when spaces survived.
    const matched = new Set<string>();
    let tokenHits = 0;
    let longBonus = 0;
    for (const tok of tokens) {
      if (p.words.has(tok)) {
        tokenHits++;
        if (!matched.has(tok)) {
          matched.add(tok);
          if (tok.length >= 4) longBonus += 4;
        }
      }
    }
    const coverage = tokens.length > 0 ? tokenHits / tokens.length : 0;

    // Substring hits — the fallback when there are no word boundaries at all
    // (transposition output), where token matching finds nothing.
    let substringHits = 0;
    if (coverage === 0) {
      for (const w of p.words) {
        if (w.length >= 3 && norm.includes(w)) {
          substringHits++;
          matched.add(w);
          if (substringHits >= 6) break;
        }
      }
    }

    const wordScore = Math.min(50, tokenHits * 12 + longBonus + substringHits * 6);
    const coverageScore = coverage * 20;

    const chi = chiPerLetter(letters, p.freq);
    // chiPerLetter <= 1.5 reads as this language; >= 5 reads as noise.
    const fitScore = Math.max(0, Math.min(1, (5 - chi) / 3.5)) * 20;

    const raw = Math.min(100, wordScore + coverageScore + fitScore + spaceScore);

    if (raw > bestRaw) {
      bestRaw = raw;
      // A language is only *named* when there is lexical evidence for it —
      // frequency fit alone is too weak to attribute, and near-identical Latin
      // characters would otherwise steal attribution from short English.
      const named = matched.size > 0;
      best = {
        score: Math.round(raw),
        language: named ? p.code : null,
        languageName: named ? p.name : null,
        matched: [...matched].slice(0, 8),
      };
    }
  }

  return best;
}

/**
 * Does this read as real words in any supported language? Used by the
 * identifier to tell plaintext / a solved substitution from a transposition
 * whose letters are language-shaped but whose words are destroyed.
 */
export function readsAsWords(text: string): boolean {
  const a = assessPlaintext(text);
  return a.language !== null && a.matched.length >= 1 && a.score >= 30;
}
