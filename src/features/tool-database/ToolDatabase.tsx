import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  BookOpen,
  Terminal,
  Database,
  Cpu,
  Hash,
  Activity,
  Sliders,
  Grid,
  Percent,
  Key,
  Binary,
  Radio,
  Globe,
  Shuffle,
  RefreshCw,
  ArrowLeftRight,
  Fingerprint,
  Info,
  Layers,
  Sparkles,
  ArrowRight,
  ClipboardCheck,
  Copy,
  Check,
  Zap,
  Eye,
  Settings
} from "lucide-react";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import HexCluster from "../../components/ui/HexCluster";
import ShinyText from "../../components/react-bits/ShinyText";
import BlurText from "../../components/react-bits/BlurText";
import TreeGrowth from "../../components/react-bits/TreeGrowth";
import { getAllTools, asResult, type ToolEntry } from "../../lib/tools/registry";
import { moduleForTool } from "../../lib/toolRouting";
import { useAppStore } from "../../store/appStore";
import {
  playPinClick,
  playHoverEvidence,
  playReticleLock,
  playSuccessChime,
  playTypeKey
} from "../../lib/soundEngine";

interface ToolDoc {
  id: string;
  name: string;
  category: "cipher" | "encoding" | "utility";
  icon: React.ComponentType<any>;
  summary: string;
  howItWorks: string;
  tutorialSteps: string[];
  exampleInput: string;
  exampleOutput: string;
  securityClassification: "HISTORICAL" | "STANDARD" | "LEGACY" | "TRANSPOSITION" | "BINARY_STREAM";
  forensicValue: string;
  /**
   * False for instruments present in the tool registry but without a
   * hand-written field entry yet. They are still listed, searchable and fully
   * operational in the sandbox — the catalogue's job is to reflect what the
   * platform actually carries, not only what has been written up.
   */
  documented?: boolean;
}

// Complete in-universe database documentation for all 18 tools
const TOOL_DOCS_REGISTRY: Record<string, ToolDoc> = {
  caesar: {
    id: "caesar",
    name: "Caesar Shift",
    category: "cipher",
    icon: Shuffle,
    summary: "A fundamental monoalphabetic substitution cipher that shifts letters down the alphabet.",
    howItWorks: "Each letter in the plaintext is replaced by a letter some fixed number of positions down the alphabet. For instance, with a shift of 3, 'A' is replaced by 'D', 'B' becomes 'E', and so on. To decrypt, you shift letters backward by the same offset.",
    tutorialSteps: [
      "Obtain the ciphertext and the numeric shift value (displacement offset).",
      "For each letter, find its position in the alphabet (A = 0, B = 1, ...).",
      "Subtract the shift value from the position (for decoding) or add it (for encoding).",
      "Wrap around using modulo 26 if the index exceeds alphabet bounds.",
      "Convert the new numeric index back to its corresponding alphabet character."
    ],
    exampleInput: "SIGNAL",
    exampleOutput: "VLJQDO (Shift: 3)",
    securityClassification: "HISTORICAL",
    forensicValue: "Weakest historic cipher. Cracked instantaneously via frequency analysis or automated 25-key brute-force sweeps."
  },
  vigenere: {
    id: "vigenere",
    name: "Vigenère Cipher",
    category: "cipher",
    icon: Layers,
    summary: "A polyalphabetic substitution cipher encrypting text using a repeating keyword.",
    howItWorks: "Instead of shifting all letters by a fixed number, Vigenère uses a keyword. Each letter of the keyword represents a separate Caesar shift index (e.g., 'A'=0, 'B'=1). The key is repeated across the entire length of the plaintext, and each character is shifted by its corresponding key letter's value.",
    tutorialSteps: [
      "Align the secret keyword repeatedly over the input message.",
      "Convert both the plaintext letter and the aligned key letter to numbers (0-25).",
      "Add them modulo 26 to encrypt, or subtract them modulo 26 to decrypt.",
      "Non-alphabetic characters (numbers, spaces, punctuation) are bypassed unmodified.",
      "Maintain key alignment indexing only when processing valid alphabetic characters."
    ],
    exampleInput: "ACCESS",
    exampleOutput: "SGEVWL (Key: SECRET)",
    securityClassification: "LEGACY",
    forensicValue: "Resistant to simple single-letter frequency analysis. Analyzed forensically by finding repeating letter blocks to estimate key length (Kasiski examination), followed by split frequency cracking."
  },
  rot13: {
    id: "rot13",
    name: "ROT13",
    category: "cipher",
    icon: RefreshCw,
    summary: "A symmetrical Caesar shift by 13 spaces. Applying it twice fully restores original text.",
    howItWorks: "ROT13 replaces each letter with the one 13 spaces ahead of it in the alphabet. Because there are 26 letters, shifting by 13 twice wraps back to 26 (equivalent to 0), making the encryption and decryption processes completely identical.",
    tutorialSteps: [
      "Scan each alphabetic character in the cipher text.",
      "Shift the character by 13 positions forward or backward (the result is identical).",
      "Punctuation, numbers, and case formatting remain fully unchanged."
    ],
    exampleInput: "SECRET",
    exampleOutput: "FRPERG",
    securityClassification: "HISTORICAL",
    forensicValue: "Zero cryptographic security. Primarily used as a quick obfuscation tool rather than a confidentiality shield."
  },
  atbash: {
    id: "atbash",
    name: "Atbash Cipher",
    category: "cipher",
    icon: ArrowLeftRight,
    summary: "A Hebrew reciprocal substitution cipher that completely mirrors the alphabet.",
    howItWorks: "Atbash flips the alphabet backwards. 'A' maps to 'Z', 'B' maps to 'Y', 'C' maps to 'X', and so forth. It is reciprocal: applying the mirror mapping to encrypted text automatically decrypts it.",
    tutorialSteps: [
      "Locate the character on the standard alphabet string (A to Z).",
      "Map it to the inverse alphabet position: NewChar = 25 - OldChar.",
      "Preserve case casing: lowercase maps to lowercase, uppercase to uppercase.",
      "Ignore any numeric values or symbol hashes."
    ],
    exampleInput: "BEACON",
    exampleOutput: "YVZXLM",
    securityClassification: "HISTORICAL",
    forensicValue: "Extremely simple substitution. Frequently deployed to obfuscate secondary clues or hidden location parameters."
  },
  xor: {
    id: "xor",
    name: "XOR Bitwise",
    category: "cipher",
    icon: Cpu,
    summary: "A bitwise logical cipher that applies XOR operations using a repeating key mask.",
    howItWorks: "XOR (Exclusive OR) operates at the binary level. It compares each bit of the plaintext with the corresponding bit of the key. If the bits are different, the output bit is 1; if they are the same, the output is 0. XOR is fully self-reciprocal.",
    tutorialSteps: [
      "Convert the input text character into its binary byte representation (ASCII code).",
      "Convert the secret key into binary bytes, repeating it as necessary.",
      "Perform a bitwise XOR (exclusive OR) on each aligned byte: output = plaintext ^ key.",
      "Render the resulting bytes as printable text, hexadecimal digits, or escaped sequences.",
      "To recover, XOR the resulting stream with the identical key byte-array."
    ],
    exampleInput: "HELLO",
    exampleOutput: "XOR bytes or hex strings (Key: SECRET)",
    securityClassification: "STANDARD",
    forensicValue: "The mathematical backbone of modern cryptography. Single-byte XOR is cracked by checking all 256 keys. Repeating keys are decoded using Hamming distance calculations or index of coincidence."
  },
  a1z26: {
    id: "a1z26",
    name: "A1Z26",
    category: "cipher",
    icon: Hash,
    summary: "A basic direct translation replacing letters with their alphabetical position indices.",
    howItWorks: "Each letter is converted to its 1-indexed position in the English alphabet (A=1, B=2, ..., Z=26). Typically, numbers are delimited by hyphens or spaces to avoid parsing ambiguity (e.g., separating '1' and '2' from '12').",
    tutorialSteps: [
      "Filter the message to standard English characters.",
      "Replace 'A' or 'a' with 1, 'B' or 'b' with 2, up to 'Z' or 'z' with 26.",
      "Delimit consecutive numbers with a hyphen (-) or space to maintain sequence bounds.",
      "Keep non-alphabetic elements as literal spacers or skip them altogether."
    ],
    exampleInput: "CIPHER",
    exampleOutput: "3-9-16-8-5-18",
    securityClassification: "HISTORICAL",
    forensicValue: "Instantly identifiable by its numeric ranges (rarely exceeding 26). Easily decoded manually or via basic substitution script filters."
  },
  affine: {
    id: "affine",
    name: "Affine Cipher",
    category: "cipher",
    icon: Sliders,
    summary: "A mathematical monoalphabetic substitution combining multiplication and addition.",
    howItWorks: "Letters are converted to numbers (0-25) and processed using the linear equation: E(x) = (a * x + b) mod 26. The multiplier 'a' must be coprime with 26 (only values 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25 are valid) to allow division for decoding.",
    tutorialSteps: [
      "Convert each character to its numeric value x (0-25).",
      "Check that multiplier 'a' has a modular multiplicative inverse modulo 26.",
      "To encrypt, evaluate: E(x) = (a * x + b) mod 26.",
      "To decrypt, evaluate: D(c) = a^-1 * (c - b) mod 26, where a^-1 is the modular inverse.",
      "Re-translate the numbers back to alphabetic letters."
    ],
    exampleInput: "PACKET",
    exampleOutput: "FISGCZ (a: 5, b: 8)",
    securityClassification: "LEGACY",
    forensicValue: "Slightly more complex than Caesar Shift, but limited to only 312 possible keys (12 valid multipliers * 26 offsets). Fully cracked via brute force in microseconds."
  },
  railfence: {
    id: "railfence",
    name: "Rail Fence Cipher",
    category: "cipher",
    icon: Activity,
    summary: "A transposition cipher writing text in a physical zigzag across modular 'rails'.",
    howItWorks: "The characters of the plaintext are written diagonally downwards and upwards on imaginary 'rails' of a fence, and then read off row by row as a horizontal sequence. No letters are substituted; they are only rearranged.",
    tutorialSteps: [
      "Construct a grid with height equal to the number of rails and width equal to text length.",
      "Place characters along a diagonal zigzag (down, then up) across the rails.",
      "Read characters horizontally row-by-row, starting with the top rail.",
      "To decrypt, reconstruct the diagonal path locations, fill in the characters by rows, and read out the zigzag pattern."
    ],
    exampleInput: "HELLOWORLD",
    exampleOutput: "HOERLWDLOO (3 Rails)",
    securityClassification: "TRANSPOSITION",
    forensicValue: "Vulnerable to anagramming analysis. Because letter frequency distributions are completely unaltered, identification of the rail count is trivial once a transposition is suspected."
  },
  bacon: {
    id: "bacon",
    name: "Bacon's Cipher",
    category: "cipher",
    icon: Eye,
    summary: "A steganographic substitution cipher encoding text into five-character binary groups.",
    howItWorks: "Invented by Sir Francis Bacon, this cipher encodes each letter of plaintext into a group of 5 characters using two symbols (traditionally 'A' and 'B'). It is a 5-bit binary system (e.g., A = aaaaa, B = aaaab, C = aaaba).",
    tutorialSteps: [
      "Determine if utilizing the 20-letter classic system (where I/J and U/V are shared) or the 26-letter variant.",
      "Replace each plaintext letter with its 5-letter Bacon code of 'A's and 'B's.",
      "To hide the code, format 'A's and 'B's using two distinct font styles, colors, or casing in a cover text.",
      "Decode by converting 5-character blocks of cover styles back to 'A's and 'B's, then mapping to letters."
    ],
    exampleInput: "SECURE",
    exampleOutput: "BAABA AABAA AAABA BABAA BAAAB AABAA",
    securityClassification: "HISTORICAL",
    forensicValue: "Steganographic in nature. Forensic analysis isolates recurring 5-character clusters or binary contrasts in metadata to expose the underlying carrier channel."
  },
  polybius: {
    id: "polybius",
    name: "Polybius Square",
    category: "cipher",
    icon: Grid,
    summary: "A grid cipher representing each letter by its row and column coordinate numbers.",
    howItWorks: "An ancient cipher utilizing a 5x5 grid containing the alphabet (usually combining 'I' and 'J' in a single cell). Each letter is replaced by two numbers representing its row and column coordinate within the square grid.",
    tutorialSteps: [
      "Draw a 5x5 grid and write the alphabet inside (left-to-right, top-to-bottom).",
      "Treat 'I' and 'J' as sharing coordinates in row 2, column 4.",
      "To encode, locate the letter, and write down its row index followed by its column index.",
      "To decode, divide the coordinate pairs, and look up the grid cell at (Row, Col)."
    ],
    exampleInput: "VECTOR",
    exampleOutput: "51 15 13 44 34 42",
    securityClassification: "HISTORICAL",
    forensicValue: "Easily spotted by its strictly numeric, paired coordinate values (numbers 1-5 only). Often combined with other transposition steps (like ADFGVX) to increase security."
  },
  rot47: {
    id: "rot47",
    name: "ROT47",
    category: "cipher",
    icon: Percent,
    summary: "A character transposition shifting all ASCII printable symbols by 47.",
    howItWorks: "Similar to ROT13, but expands the character set beyond letters. It shifts all printable ASCII characters (from code 33 '!' to code 126 '~') by 47 spaces. Since the range is 94 characters, running it twice returns the original string.",
    tutorialSteps: [
      "Identify the ASCII decimal value of the printable character.",
      "If the value is between 33 and 126, add 47.",
      "If the resulting value is greater than 126, wrap it around by subtracting 94.",
      "Convert the modified ASCII decimal back to its character representation."
    ],
    exampleInput: "Belfry",
    exampleOutput: "(2J?6%649",
    securityClassification: "LEGACY",
    forensicValue: "Pure obfuscation. Used extensively in email headers, web scrapers, and obfuscated shell script payloads to evade primitive keyword filters."
  },
  base32: {
    id: "base32",
    name: "Base32 Encoding",
    category: "encoding",
    icon: Key,
    summary: "Binary-to-text encoding using a 32-character subset (A-Z, 2-7).",
    howItWorks: "Base32 takes binary stream data in 5-bit (40-bit block) chunks and maps each chunk to one of 32 alphanumeric symbols. Because it avoids numbers like '0', '1', and '8' that easily look like letters, it is highly human-readable and resilient to error.",
    tutorialSteps: [
      "Break the input string down into its binary representation (8 bits per char).",
      "Regroup the binary bits into blocks of 5 bits.",
      "Map each 5-bit block to its matching index on the Base32 alphabet (A-Z, 2-7).",
      "Add '=' padding characters at the end to satisfy standard 8-character block alignment."
    ],
    exampleInput: "STREAM",
    exampleOutput: "KNKFERKBJU======",
    securityClassification: "BINARY_STREAM",
    forensicValue: "Widely used in authentication protocols (such as Google Authenticator MFA secret keys) and offline physical radio codes because of its case-insensitive clarity."
  },
  base64: {
    id: "base64",
    name: "Base64 Encoding",
    category: "encoding",
    icon: Database,
    summary: "A standard encoding protocol representing binary streams in safe ASCII characters.",
    howItWorks: "Base64 represents binary data as an ASCII string. It splits every 3 bytes (24 bits) into 4 chunks of 6 bits each. Each 6-bit chunk maps to one of 64 characters (A-Z, a-z, 0-9, +, /). Pads empty spots with '='.",
    tutorialSteps: [
      "Convert the input string into a contiguous stream of binary bits.",
      "Divide the bit stream into consecutive 6-bit segments.",
      "Look up each 6-bit segment value on the index chart (0-63 maps to A-Z, a-z, 0-9, +, /).",
      "Pad the remaining spaces with '=' if the input length is not a multiple of 3 bytes."
    ],
    exampleInput: "DECODE",
    exampleOutput: "REVDT0RF",
    securityClassification: "BINARY_STREAM",
    forensicValue: "Ubiquitous in computing. Forensically vital for decoding embedded attachments, images, and obfuscated malware payloads packed inside text scripts."
  },
  hex: {
    id: "hex",
    name: "Hexadecimal",
    category: "encoding",
    icon: Binary,
    summary: "A base-16 numerical system representing bytes using characters 0-9 and A-F.",
    howItWorks: "Hex represents each byte of text using exactly two characters from the base-16 set (0-9, A-F). Since a byte holds 256 states (8 bits), and each hex digit holds 16 states (4 bits), two hex digits represent a byte perfectly.",
    tutorialSteps: [
      "Convert each plaintext character to its ASCII code number.",
      "Divide the ASCII number by 16 to find the first hex digit (0-F).",
      "Find the remainder to determine the second hex digit (0-F).",
      "Format the output digits with or without spaces, percent signs, or prefixes (e.g. \\x or 0x)."
    ],
    exampleInput: "BAT",
    exampleOutput: "424154",
    securityClassification: "BINARY_STREAM",
    forensicValue: "Universal representation of machine instructions and raw memory. Primary format used to audit data packet headers or raw file headers."
  },
  binary: {
    id: "binary",
    name: "Binary Stream",
    category: "encoding",
    icon: Terminal,
    summary: "Base-2 numeral code representing characters as strings of 1s and 0s.",
    howItWorks: "Binary converts characters into their fundamental base-2 numeric byte formats. Each character is represented by 8 binary digits (bits), which map to standard electronic hardware transitions.",
    tutorialSteps: [
      "Convert each text character into its ASCII decimal value.",
      "Decompose the decimal value into powers of 2 (128, 64, 32, 16, 8, 4, 2, 1).",
      "Write '1' for active powers and '0' for inactive ones, padding to 8 digits.",
      "Delimit individual byte blocks with spaces to ensure readability."
    ],
    exampleInput: "HI",
    exampleOutput: "01001000 01001001",
    securityClassification: "BINARY_STREAM",
    forensicValue: "The absolute lowest-level data representation. Deciphering binary dumps reveals alignment schemas, compiler signatures, and physical storage architecture."
  },
  ascii: {
    id: "ascii",
    name: "ASCII Decimal",
    category: "encoding",
    icon: Fingerprint,
    summary: "Represents characters by their standard numeric codes on the ASCII table.",
    howItWorks: "ASCII (American Standard Code for Information Interchange) translates keyboard characters into decimal numbers between 0 and 127 (e.g., Space is 32, 'A' is 65, 'a' is 97). Delimited by spaces.",
    tutorialSteps: [
      "Convert each character to its 7-bit standard code index on the ASCII table.",
      "Write down the resulting decimal numbers in sequence.",
      "Separate each decimal code with a space to avoid parsing ambiguity."
    ],
    exampleInput: "BOY",
    exampleOutput: "66 79 89",
    securityClassification: "BINARY_STREAM",
    forensicValue: "Standard text representation mapping. Reading raw decimal numbers bypasses formatting bugs and exposes non-printable character traps."
  },
  morse: {
    id: "morse",
    name: "Morse Code",
    category: "encoding",
    icon: Radio,
    summary: "An acoustic/optical encoding using sequences of dots and dashes.",
    howItWorks: "Morse Code maps alphabetic letters and numbers to sequences of short and long signals, called dits (dots '.') and dahs (dashes '-'). Characters are separated by single spaces, and words are separated by slashes or triple spaces.",
    tutorialSteps: [
      "Look up each character on the international Morse Code translation key.",
      "Replace the letter with its corresponding sequence of dots and dashes.",
      "Write a space after each character's Morse group to keep letters distinct.",
      "Use a slash (/) or multiple spaces to delimit word endings."
    ],
    exampleInput: "SOS",
    exampleOutput: "... --- ...",
    securityClassification: "LEGACY",
    forensicValue: "Acoustic and optical utility standard. Vital for decoding emergency radio beacon logs, light signal flash captures, or background audio clicks (such as tapping codes)."
  },
  url: {
    id: "url",
    name: "URL Encoding",
    category: "encoding",
    icon: Globe,
    summary: "Percent-encoding for transmission of special characters in web addresses.",
    howItWorks: "URL encoding replaces non-ASCII and reserved symbols with a percent symbol '%' followed by two hexadecimal digits representing the character's ASCII code. Space is encoded as '%20' or '+'.",
    tutorialSteps: [
      "Determine if the character is an unreserved URL symbol (letters, numbers, hyphen, period, underscore, tilde).",
      "If reserved or non-ASCII, find its hexadecimal ASCII byte value.",
      "Format the output as a percent sign (%) followed by the hex digits.",
      "Verify the encoded string complies with URI standards."
    ],
    exampleInput: "A B!",
    exampleOutput: "A%20B%21",
    securityClassification: "BINARY_STREAM",
    forensicValue: "Crucial for identifying attack payloads (such as SQL injection or XSS payloads) hidden within web server requests and network traffic intercepts."
  }
};

/**
 * Route out of the catalogue into the module that actually operates the tool.
 *
 * Three of the seventy tools have no home (see moduleForTool). Rather than
 * offering a button that goes nowhere, they say so — the tool is still real and
 * documented, it just has no station yet.
 */
function ToolHandoff({ toolId, onOpen }: { toolId: string; onOpen: (id: string) => void }) {
  const home = moduleForTool(toolId);

  if (!home) {
    return (
      <div className="border-t border-border-hairline/25 pt-4">
        <p className="font-mono text-[12px] text-text-dim uppercase tracking-wider leading-relaxed">
          No dedicated station carries this instrument yet — it is available to the
          Signal Chain as a pipeline operation.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border-hairline/25 pt-4">
      <button
        type="button"
        onClick={() => onOpen(toolId)}
        onMouseEnter={() => playReticleLock()}
        className="hud-target w-full py-2.5 px-3 flex items-center justify-center gap-2
                   border border-accent-primary/50 text-accent-primary bg-accent-primary/[0.06]
                   font-display text-[13px] font-black uppercase tracking-[0.2em]
                   hover:bg-accent-primary/15 hover:shadow-[0_0_16px_rgb(var(--rgb-accent) / 0.25)]
                   transition-all duration-200 cursor-pointer"
      >
        <Zap className="w-4 h-4" />
        <span>Open in {home.label}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
      <p className="mt-2 text-center font-mono text-[12px] text-text-dim/70 uppercase tracking-wider">
        Loads this instrument with full parameter control
      </p>
    </div>
  );
}

const CATEGORY_ICON: Record<ToolDoc["category"], React.ComponentType<any>> = {
  cipher: Shuffle,
  encoding: Binary,
  utility: Sliders,
};

/**
 * Builds a catalogue entry for a tool the platform carries but that has no
 * hand-written field entry yet.
 *
 * Everything here is derived from the tool itself — its label, its category,
 * and an example produced by actually running it. Nothing about how the cipher
 * works is invented: an authoritative-sounding but wrong explanation of a
 * cryptographic instrument is worse than an honest gap, so the detail view
 * renders a "pending transcription" state instead of prose.
 */
function synthesizeDoc(entry: ToolEntry): ToolDoc {
  const exampleInput = "SIGNAL";
  let exampleOutput: string;
  try {
    exampleOutput = asResult(entry.encode(exampleInput)).text;
  } catch {
    // Tools whose defaults need parameters (keys, rotors, rails) cannot produce
    // a canned example; the sandbox below still drives them properly.
    exampleOutput = "";
  }

  return {
    id: entry.id,
    name: entry.label,
    category: entry.category,
    icon: CATEGORY_ICON[entry.category] ?? Shuffle,
    summary: "",
    howItWorks: "",
    tutorialSteps: [],
    exampleInput,
    exampleOutput,
    securityClassification: entry.category === "encoding" ? "BINARY_STREAM" : "STANDARD",
    forensicValue: "",
    documented: false,
  };
}

/**
 * The catalogue: every tool in the registry, hand-written entry where one
 * exists. Previously this listed only the ~19 documented tools, which made the
 * database quietly claim the platform carried no Enigma, no Playfair, and so on.
 * Documented entries sort first, then alphabetically.
 *
 * Built on first use and cached, not at module scope: synthesizing an entry runs
 * the tool to produce a real example, and this module is imported eagerly by
 * App.tsx — at module scope every visitor would pay ~50 cipher runs during boot
 * whether or not they ever open the catalogue.
 */
let cachedToolDocs: ToolDoc[] | null = null;
function getAllToolDocs(): ToolDoc[] {
  if (!cachedToolDocs) {
    cachedToolDocs = getAllTools()
      .map((entry) => {
        const written = TOOL_DOCS_REGISTRY[entry.id];
        return written ? { ...written, documented: true } : synthesizeDoc(entry);
      })
      .sort((a, b) => {
        if (a.documented !== b.documented) return a.documented ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }
  return cachedToolDocs;
}

export default function ToolDatabase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "cipher" | "encoding" | "utility">("all");
  const [selectedToolId, setSelectedToolId] = useState<string>("caesar");

  const openToolInModule = useAppStore((s) => s.openToolInModule);

  const allToolDocs = useMemo(() => getAllToolDocs(), []);

  // Filter tools based on search and category
  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return allToolDocs.filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(q) ||
        tool.id.toLowerCase().includes(q) ||
        tool.summary.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === "all" || tool.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allToolDocs, searchQuery, selectedCategory]);

  const activeToolDoc = useMemo(() => {
    return allToolDocs.find((t) => t.id === selectedToolId) ?? allToolDocs[0];
  }, [allToolDocs, selectedToolId]);

  const selectNode = (id: string) => {
    playPinClick();
    setSelectedToolId(id);
  };

  // Icon component helper
  const renderIcon = (DocIcon: React.ComponentType<any>, className = "w-5 h-5") => {
    return <DocIcon className={className} />;
  };

  // Explicit rows + content-start. With auto rows and a grid taller than its
  // content, align-content stretches every row — so on a large display the
  // header row inflated far past its ~104px of content and left a wide band of
  // nothing between the ribbon and the catalogue.
  return (
    <div className="h-full w-full p-4 grid grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)] content-start gap-4 overflow-hidden font-chakra text-text-primary animate-fade-in" id="tool-database-root">
      
      {/* ================= HEADER SECTION (SPAN 12) ================= */}
      <div className="col-span-12 flex flex-col space-y-3">
        <GlassPanel className="p-4" clipSize="sm" showCornerTicks={true}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-4 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_8px_var(--color-accent-primary)]" />
                <h1 className="font-display text-sm font-black tracking-widest text-cyan-text uppercase">
                  <ShinyText text="SECURE CRYPTOGRAPHIC CODEX" speed={3} />
                </h1>
              </div>
              <p className="text-[13px] text-text-dim uppercase tracking-wider font-share mt-1 leading-relaxed">
                Belfry Forensic Databank. A comprehensive reference tracking historical and standard cryptography ciphers, binary stream encoders, and transposition algorithms.
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <Badge variant="cyan" size="xs">
                DATA INTEGRITY LOCKED
              </Badge>
              <span className="font-mono text-[12px] text-text-dim">
                DB_VER: 4.8.1
              </span>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* ================= LEFT COLUMN: SEARCH & STYLIZED NODE GRID (SPAN 6) ================= */}
      <div className="col-span-12 lg:col-span-6 flex flex-col space-y-4 min-h-0">
        
        {/* Search & Category Filter Ribbon */}
        <GlassPanel className="p-3" clipSize="sm">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1 group">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-text-dim/60 group-focus-within:text-cyan-primary transition-colors" />
              {searchQuery && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  className="absolute bottom-0 left-0 h-[1px] bg-cyan-primary/40 z-10"
                />
              )}
              <input
                type="text"
                placeholder="Search database nodes or categories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  playTypeKey();
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-bg-void border border-border-hairline/25 text-xs text-text-primary placeholder:text-text-dim/40 font-mono focus:outline-none focus:border-cyan-primary/50"
              />
            </div>

            {/* Segmented Category Buttons */}
            <div className="flex bg-bg-void border border-border-hairline/25 rounded-none overflow-hidden select-none shrink-0">
              <button
                onClick={() => {
                  playPinClick();
                  setSelectedCategory("all");
                }}
                className={`px-3 py-1 text-[12px] font-mono font-bold uppercase tracking-widest transition-all ${
                  selectedCategory === "all"
                    ? "bg-cyan-primary/15 text-cyan-text font-bold shadow-[inset_0_0_8px_rgb(var(--rgb-accent) / 0.25)]"
                    : "text-text-dim hover:text-text-primary"
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  playPinClick();
                  setSelectedCategory("cipher");
                }}
                className={`px-3 py-1 text-[12px] font-mono font-bold uppercase tracking-widest transition-all border-l border-border-hairline/15 ${
                  selectedCategory === "cipher"
                    ? "bg-amber-alert/15 text-amber-alert font-bold shadow-[inset_0_0_8px_rgba(245,158,11,0.25)]"
                    : "text-text-dim hover:text-text-primary"
                }`}
              >
                Ciphers
              </button>
              <button
                onClick={() => {
                  playPinClick();
                  setSelectedCategory("encoding");
                }}
                className={`px-3 py-1 text-[12px] font-mono font-bold uppercase tracking-widest transition-all border-l border-border-hairline/15 ${
                  selectedCategory === "encoding"
                    ? "bg-cyan-primary/15 text-cyan-text font-bold shadow-[inset_0_0_8px_rgb(var(--rgb-accent) / 0.25)]"
                    : "text-text-dim hover:text-text-primary"
                }`}
              >
                Encodings
              </button>
              <button
                onClick={() => {
                  playPinClick();
                  setSelectedCategory("utility");
                }}
                className={`px-3 py-1 text-[13px] font-mono font-bold uppercase tracking-widest transition-all border-l border-border-hairline/15 ${
                  selectedCategory === "utility"
                    ? "bg-cyan-primary/15 text-cyan-text font-bold shadow-[inset_0_0_8px_rgb(var(--rgb-accent) / 0.25)]"
                    : "text-text-dim hover:text-text-primary"
                }`}
              >
                Utilities
              </button>
            </div>
          </div>
        </GlassPanel>

        {/* Dynamic Nodes Grid (Bento/Hex Theme matching Belfry Upgrade Grid) */}
        <GlassPanel className="panel-console p-4 flex-1 flex flex-col justify-between min-h-[460px]" clipSize="md">
          <div className="border-b border-border-hairline/20 pb-2 mb-4 flex justify-between items-center">
            <h3 className="font-display text-xs font-black tracking-widest text-cyan-text uppercase flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-primary animate-hex-pulse-flicker" />
              <span>ACTIVE DATABASE CORES</span>
            </h3>
            <span className="font-mono text-[12px] text-text-dim uppercase">
              GRID INDEX: {filteredTools.length} NODES
            </span>
          </div>

          {filteredTools.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border-hairline/15 bg-bg-void/25 rounded-none">
              <Terminal className="w-10 h-10 text-cyan-primary/20 animate-hex-pulse-flicker mb-3" />
              <h4 className="font-display text-xs font-black tracking-widest text-red-threat uppercase">
                NO CORRELATING NODES
              </h4>
              <p className="text-[13px] text-text-dim uppercase tracking-widest font-share max-w-xs mt-1.5 leading-relaxed">
                Your search query did not yield matches in the cryptographic databank. Refine terms or clear filters.
              </p>
              <button
                onClick={() => {
                  playPinClick();
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-4 px-3 py-1 border border-cyan-primary/30 text-cyan-primary hover:border-cyan-primary text-[12px] font-mono uppercase"
              >
                Reset Filter Core
              </button>
            </div>
          ) : (
            /* Hexagonal-inspired grid view of nodes */
            <div className="flex-1 overflow-y-auto max-h-[400px] pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3.5 select-none hud-scrollbar relative">
              {/* Archive Search Scanline */}
              {searchQuery && (
                <motion.div 
                  initial={{ left: "-100%" }}
                  animate={{ left: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute top-0 bottom-0 w-[100px] bg-gradient-to-r from-transparent via-cyan-primary/5 to-transparent z-10 pointer-events-none skew-x-12"
                />
              )}

              <AnimatePresence mode="popLayout">
                {filteredTools.map((tool, index) => {
                  const isSelected = tool.id === selectedToolId;
                  const isCipher = tool.category === "cipher";

                  return (
                    <motion.div
                      layout
                      key={tool.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ 
                        delay: index * 0.03,
                        type: "spring",
                        stiffness: 200,
                        damping: 20
                      }}
                      onClick={() => selectNode(tool.id)}
                      onMouseEnter={playHoverEvidence}
                      className={`hud-target ${isCipher ? "hud-target-amber" : ""} relative cursor-pointer transition-all duration-250 border p-3 flex flex-col justify-between group ${
                        isSelected
                          ? isCipher
                            ? "bg-amber-alert/10 border-amber-alert shadow-[0_0_12px_rgba(245,158,11,0.25)] scale-[1.01]"
                            : "bg-cyan-primary/10 border-cyan-primary shadow-[0_0_12px_rgb(var(--rgb-accent) / 0.25)] scale-[1.01]"
                          : "bg-bg-void/65 border-border-hairline/20 hover:bg-bg-void hover:border-text-primary/45"
                      }`}
                      style={{
                        clipPath: "polygon(2% 0, 98% 0, 100% 10%, 100% 90%, 98% 100%, 2% 100%, 0 90%, 0 10%)"
                      }}
                    >
                    {/* Tiny visual indicators */}
                    <div className="absolute top-1 right-2 flex space-x-1">
                      <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-cyan-primary animate-lock-on-snap" : "bg-text-dim/20"}`} />
                    </div>

                    {/* Node Icon - Hexagonal framing */}
                    <div className="flex justify-center my-1">
                      <div 
                        className={`w-9 h-9 flex items-center justify-center transition-transform group-hover:scale-110 ${
                          isSelected 
                            ? isCipher ? "text-amber-alert" : "text-cyan-primary" 
                            : "text-text-dim"
                        }`}
                        style={{
                          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                          background: isSelected 
                            ? isCipher ? "rgba(245,158,11,0.15)" : "rgb(var(--rgb-accent) / 0.15)" 
                            : "rgba(255,255,255,0.03)",
                          border: isSelected
                            ? `1px solid ${isCipher ? "var(--color-amber-alert)" : "var(--color-accent-primary)"}`
                            : "1px solid rgba(255,255,255,0.1)"
                        }}
                      >
                        {renderIcon(tool.icon, "w-4.5 h-4.5")}
                      </div>
                    </div>

                    {/* Node Metadata Label */}
                    <div className="text-center mt-2 px-1 w-full">
                      <h4 className="font-display text-[12px] font-black tracking-widest uppercase text-white break-words leading-tight">
                        {tool.name}
                      </h4>
                      <span className="text-[12px] font-mono text-text-dim uppercase tracking-wider block mt-0.5 truncate">
                        ID: {tool.id}
                      </span>
                    </div>

                    {/* Bottom Category Tab Indicator */}
                    <div className="mt-2.5 flex justify-center">
                      <span 
                        className={`text-[12px] font-mono tracking-widest px-1.5 py-0.5 border ${
                          isCipher 
                            ? "text-amber-alert border-amber-alert/20 bg-amber-alert/5" 
                            : "text-cyan-text border-cyan-primary/20 bg-cyan-primary/5"
                        }`}
                      >
                        {tool.category}
                      </span>
                    </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Prompt footer */}
          <div className="border-t border-border-hairline/10 pt-3 mt-4 text-center">
            <span className="text-[12px] font-mono text-text-dim uppercase tracking-wider">
              [ Hover node to probe frequencies — Select to retrieve forensic blueprints ]
            </span>
          </div>
        </GlassPanel>

        {/* Interactive Workspace Sandbox is now part of the main scrollable content above */}

      </div>

      {/* ================= RIGHT COLUMN: DETAIL DOSSIER VIEW (SPAN 6) ================= */}
      <div className="col-span-12 lg:col-span-6 flex flex-col space-y-4 min-h-0">
        
        {/* Core Detail Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedToolId}
            initial={{ clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)", opacity: 0 }}
            animate={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", opacity: 1 }}
            exit={{ clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)", opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col h-fit"
          >
            <GlassPanel className="p-4 flex flex-col" clipSize="md">
          
          {/* Header metadata dossier */}
          <div className="border-b border-border-hairline/25 pb-3 mb-4 flex justify-between items-start flex-wrap gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <Badge variant={activeToolDoc.category === "cipher" ? "amber" : "cyan"} size="xs">
                  {activeToolDoc.category}
                </Badge>
                <span className="font-mono text-[12px] text-text-dim uppercase">
                  CLASSIFICATION: {activeToolDoc.securityClassification}
                </span>
              </div>
              <h2 className="font-display text-base font-black tracking-widest text-white uppercase mt-1 w-full">
                <BlurText text={activeToolDoc.name} animateBy="words" />
              </h2>
            </div>

            <div className="flex items-center space-x-1">
              <div 
                className="w-8 h-8 rounded-full bg-bg-void border border-border-hairline/20 flex items-center justify-center text-cyan-primary"
                style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
              >
                {renderIcon(activeToolDoc.icon, "w-4 h-4")}
              </div>
            </div>
          </div>

          {/* Dossier Tabs Container (Scrollable) */}
          <div className="flex-1 overflow-y-auto max-h-[420px] space-y-4 pr-1 scrollbar-thin select-text">
            
            {activeToolDoc.documented ? (
              <>
                {/* Short Summary */}
                <div className="p-3 bg-bg-void/50 border-l-2 border-cyan-primary border-y border-r border-border-hairline/10 w-full">
                  <h4 className="font-display text-[14px] font-black tracking-widest text-cyan-text uppercase mb-1.5 flex items-center">
                    <Info className="w-3.5 h-3.5 text-cyan-primary mr-1.5" />
                    <span>Forensic Summary</span>
                  </h4>
                  <p className="text-[14px] text-text-primary uppercase tracking-wide font-share leading-relaxed w-full">
                    <BlurText text={activeToolDoc.summary} animateBy="words" delay={0.02} />
                  </p>
                </div>

                {/* How it Works Description */}
                <div className="space-y-1.5 w-full">
                  <h4 className="font-display text-[14px] font-black tracking-widest text-text-dim uppercase">
                    MECHANICAL ARCHITECTURE
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-3 bg-bg-void/30 p-3 border border-border-hairline/15 w-full items-center">
                    <p className="flex-1 text-[14px] font-share uppercase tracking-wide text-text-primary leading-relaxed">
                      {activeToolDoc.howItWorks}
                    </p>
                    {/* Visual Branching Cipher Diagram */}
                    <div key={activeToolDoc.id} className="w-16 h-16 shrink-0 bg-bg-void/60 border border-border-hairline/10 rounded flex items-center justify-center overflow-hidden relative" title="Structural branching mapping">
                      <TreeGrowth active={true} color="rgb(var(--rgb-accent) / 0.45)" className="scale-35 transform absolute" />
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Blueprint Instructions */}
                <div className="space-y-2">
                  <h4 className="font-display text-[14px] font-black tracking-widest text-text-dim uppercase">
                    DECRYPTION BLUEPRINT ALGORITHM
                  </h4>
                  <ol className="space-y-1.5 pl-4 list-decimal text-[14px] uppercase font-share text-text-dim leading-relaxed">
                    {activeToolDoc.tutorialSteps.map((step, idx) => (
                      <li key={idx} className="hover:text-white transition-colors">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              /* Carried by the platform, not yet written up. Says so plainly
                 rather than inventing an explanation that might be wrong. */
              <div className="p-4 bg-amber-alert/[0.04] border-l-2 border-amber-alert/70 border-y border-r border-border-hairline/10 w-full space-y-2">
                <h4 className="font-display text-[14px] font-black tracking-widest text-amber-alert uppercase flex items-center">
                  <Info className="w-3.5 h-3.5 mr-1.5" />
                  <span>Field entry pending transcription</span>
                </h4>
                <p className="text-[14px] text-text-primary font-share uppercase tracking-wide leading-relaxed">
                  This instrument is installed and fully operational — the written analysis
                  has not been filed yet. Drive it directly from the calibration sandbox below,
                  or open it in the Codex for full parameter control.
                </p>
                <p className="font-mono text-[13px] text-text-dim tracking-wider">
                  REGISTRY_ID: <span className="text-cyan-text">{activeToolDoc.id}</span>
                  <span className="opacity-40"> // </span>
                  CLASS: <span className="text-cyan-text">{activeToolDoc.category.toUpperCase()}</span>
                </p>
              </div>
            )}

            {/* Worked Static Example — omitted when the tool needs parameters
                to produce one, rather than showing an empty panel. */}
            {activeToolDoc.exampleOutput && (
              <div className="grid grid-cols-2 gap-3 pt-1 w-full">
                <div className="p-2.5 bg-bg-void/80 border border-border-hairline/20 overflow-hidden">
                  <span className="text-[13px] font-mono text-cyan-primary uppercase tracking-widest block mb-1">
                    STATIC ENCODE TEST:
                  </span>
                  <span className="font-mono text-[14px] font-bold text-white block break-all">
                    {activeToolDoc.exampleInput}
                  </span>
                </div>
                <div className="p-2.5 bg-bg-void/80 border border-border-hairline/20 overflow-hidden">
                  <span className="text-[13px] font-mono text-amber-alert uppercase tracking-widest block mb-1">
                    STATIC CASCADE OUTPUT:
                  </span>
                  <span className="font-mono text-[14px] font-bold text-green-verified block break-all">
                    {activeToolDoc.exampleOutput}
                  </span>
                </div>
              </div>
            )}

            {/* Technical Forensic Vulnerability Info */}
            {activeToolDoc.forensicValue && (
              <div className="p-3 bg-red-threat/5 border border-red-threat/20 w-full">
                <h4 className="font-display text-[14px] font-black tracking-widest text-red-threat uppercase mb-1 flex items-center">
                  <Terminal className="w-3.5 h-3.5 text-red-threat mr-1.5 animate-hex-pulse-flicker" />
                  <span>Forensic Intelligence Vulnerability Report</span>
                </h4>
                <p className="text-[14px] font-mono text-text-dim uppercase leading-relaxed w-full break-words">
                  {activeToolDoc.forensicValue}
                </p>
              </div>
            )}

            {/* Hand-off to the module that actually operates this tool. The
                catalogue is a reference surface: a second live editor here
                duplicated the labs and cost every visitor the render. */}
            <ToolHandoff toolId={activeToolDoc.id} onOpen={openToolInModule} />

          </div>

          {/* Dossier footer */}
          <div className="border-t border-border-hairline/10 pt-3 mt-4 text-right">
            <span className="text-[12px] font-mono text-cyan-primary uppercase tracking-wider">
              [ CRYPTO_ Blueprints Verified // Belfry Calibration Lab Clear ]
            </span>
          </div>

        </GlassPanel>
      </motion.div>
    </AnimatePresence>
  </div>

    </div>
  );
}
