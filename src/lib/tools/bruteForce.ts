import { getTool, asResult } from "./registry";
import { scoreDecodedPlaintext } from "./scoring";
import { estimateXorKeyLength, gcd } from "./crypto-utils";

export interface BruteForceResult {
  label: string;
  parameter: string;
  options: any;
  output: string;
  score: number;
}

export interface BruteForceOutcome {
  results: BruteForceResult[];
  /** Non-ranked informational banners (e.g. multi-byte XOR key-length estimate, truncated search space) — never sortable "answers". */
  notes: string[];
  /** Count of parameter combinations whose decode() call threw and were skipped. */
  failedCount: number;
}

export const DEFAULT_WORDLIST = [
  "THE", "AND", "THAT", "HAVE", "FOR", "NOT", "WITH", "YOU", "THIS", "BUT",
  "FROM", "THEY", "SAY", "HER", "SHE", "OR", "AN", "WILL", "MY", "ONE",
  "ALL", "WOULD", "THERE", "THEIR", "WHAT", "SO", "UP", "OUT", "IF", "ABOUT",
  "WHO", "GET", "WHICH", "GO", "ME", "WHEN", "MAKE", "CAN", "LIKE", "TIME",
  "NO", "JUST", "HIM", "KNOW", "TAKE", "PEOPLE", "INTO", "YEAR", "YOUR", "GOOD",
  "SOME", "COULD", "THEM", "SEE", "OTHER", "THAN", "THEN", "NOW", "LOOK", "ONLY",
  "COME", "ITS", "OVER", "THINK", "ALSO", "BACK", "AFTER", "USE", "TWO", "HOW",
  "OUR", "WORK", "FIRST", "WELL", "WAY", "EVEN", "NEW", "WANT", "BECAUSE", "ANY",
  "THESE", "GIVE", "DAY", "MOST", "US", "MESSAGE", "TARGET", "ACCESS", "SYSTEM",
  "PROTOCOL", "SIGNAL", "SECURE", "COORDINATES", "SECRET", "SAFE", "EAST",
  "WEST", "NORTH", "SOUTH", "MEET", "NINE", "SEVEN", "ZERO", "FOUR", "SECTOR",
  "CLOCK", "CODE", "KEY", "DATA", "POLICE", "DETECTIVE", "EVIDENCE", "REPORT",
  "PACKET", "STREAM", "BUFFER", "DECODE", "ENCRYPT", "CIPHER", "PLAIN", "TEXT",
  "SERVER", "NETWORK", "CHANNEL", "RELAY", "CRIME", "SCENE", "FILE", "RECORD",
  "BANK", "TOWER", "BRIDGE", "RIVER", "PORT", "DOCKS", "STATION", "GRID"
];

export function bruteForceTool(
  toolId: string,
  input: string,
  wordlist?: string[]
): BruteForceOutcome {
  if (!input) return { results: [], notes: [], failedCount: 0 };

  const tool = getTool(toolId);
  if (!tool) return { results: [], notes: [], failedCount: 0 };

  const results: BruteForceResult[] = [];
  const notes: string[] = [];
  let failedCount = 0;

  const addResult = (label: string, parameter: string, options: any) => {
    try {
      const res = tool.decode(input, options);
      const output = asResult(res).text;
      results.push({
        label,
        parameter,
        options,
        output,
        score: scoreDecodedPlaintext(output)
      });
    } catch (e) {
      failedCount++;
    }
  };

  switch (toolId) {
    case "caesar":
      for (let s = 1; s <= 25; s++) {
        addResult(`Caesar Shift ${s}`, `shift: ${s}`, { shift: s });
      }
      break;

    case "railfence":
      for (let r = 2; r <= 10; r++) {
        addResult(`Rail Fence (Rails: ${r})`, `rails: ${r}`, { rails: r });
      }
      break;

    case "affine": {
      const validA = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];
      for (const a of validA) {
        for (let b = 0; b < 26; b++) {
          addResult(`Affine (a:${a}, b:${b})`, `a: ${a}, b: ${b}`, { a, b });
        }
      }
      break;
    }

    case "atbash":
      addResult("Atbash", "none", {});
      break;

    case "xor":
      // Single-byte brute force
      for (let i = 0; i < 256; i++) {
        const char = String.fromCharCode(i);
        addResult(`XOR Key 0x${i.toString(16).padStart(2, '0')} ('${char}')`, `key: "${char}"`, { key: char });
      }
      
      // Multi-byte estimation info — informational only, never a ranked "answer"
      const xorEstimate = estimateXorKeyLength(input);
      if (xorEstimate) {
        notes.push(
          `Repeating-key XOR pattern detected. Estimated key length: ${xorEstimate.keySize}. Normalized Hamming Distance: ${xorEstimate.distance.toFixed(2)}. This does not decode the message — it only suggests trying a multi-byte key of this length manually; single-byte candidates are ranked above.`
        );
      }
      break;

    case "vigenere":
    case "playfair":
    case "bifid":
    case "trifid":
      if (wordlist && wordlist.length > 0) {
        for (const word of wordlist) {
           addResult(`${tool.label} Key: ${word}`, `key: "${word}"`, { key: word });
        }
      }
      break;

    case "hill": {
      // 2x2 with small integers -5 to 5
      let hillCount = 0;
      let truncated = false;
      for (let a = -5; a <= 5; a++) {
        for (let b = -5; b <= 5; b++) {
          for (let c = -5; c <= 5; c++) {
            for (let d = -5; d <= 5; d++) {
              if (hillCount >= 5000) {
                truncated = true;
                break;
              }
              const det = (a * d - b * c) % 26;
              const positiveDet = (det + 26) % 26;
              if (positiveDet !== 0 && gcd(positiveDet, 26) === 1) {
                addResult(`Hill Matrix [[${a},${b}],[${c},${d}]]`, `matrix: [[${a},${b}],[${c},${d}]]`, { matrix: [[a, b], [c, d]] });
                hillCount++;
              }
            }
            if (truncated) break;
          }
          if (truncated) break;
        }
        if (truncated) break;
      }
      if (truncated) {
        notes.push("Hill search space was truncated at 5000 combinations. Try narrower parameters if known.");
      }
      break;
    }

    default:
      break;
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return { results, notes, failedCount };
}
