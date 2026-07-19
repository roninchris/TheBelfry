import type { ToolEntry } from "./types";
import {
  caesarEncode,
  caesarDecode,
  vigenereEncode,
  vigenereDecode,
  atbashEncode,
  atbashDecode,
  xorEncode,
  xorDecode,
  rot13Encode,
  rot13Decode,
  
} from "./ciphers";
import {
  base64Encode,
  base64Decode,
  hexEncode,
  hexDecode,
  binaryEncode,
  binaryDecode,
  asciiEncode,
  asciiDecode,
  morseEncode,
  morseDecode,
  urlEncode,
  urlDecode,
  base32Encode,
  base32Decode,
  base58Encode,
  base58Decode,
  base85Encode,
  base85Decode,
  brailleEncode,
  brailleDecode,
  base62Encode,
  base62Decode,
  base100Encode,
  base100Decode,
  baudotEncode,
  baudotDecode,
  tapCodeEncode,
  tapCodeDecode,
  phoneKeypadEncode,
  phoneKeypadDecode,
  pigLatinEncode,
  pigLatinDecode,
  geekCodeEncode,
  geekCodeDecode,
} from "./encodings";
import { a1z26Encode, a1z26Decode, affineEncode, affineDecode, railFenceEncode, railFenceDecode, baconEncode, baconDecode, polybiusEncode, polybiusDecode, rot47Encode, rot47Decode, enigmaEncode, enigmaDecode } from "./ciphers";
import {
  playfairEncode,
  playfairDecode,
  bifidEncode,
  bifidDecode,
  trifidEncode,
  trifidDecode,
  hillEncode,
  hillDecode,
  bookCipherEncode,
  bookCipherDecode,
  gematriaEncode,
  gematriaDecode,
  runicEncode,
  runicDecode,
  pigpenEncode,
  pigpenDecode,
  dancingMenEncode,
  dancingMenDecode,
  nihilistEncode,
  nihilistDecode,
  homophonicEncode,
  homophonicDecode,
  keyedCaesarEncode,
  keyedCaesarDecode,
  gronsfeldEncode,
  gronsfeldDecode,
  amscoEncode,
  amscoDecode,
  doubleTranspositionEncode,
  doubleTranspositionDecode,
  routeEncode,
  routeDecode,
  scytaleEncode,
  scytaleDecode,
  vigenereAutokeyEncode,
  vigenereAutokeyDecode,
  beaufortEncode,
  beaufortDecode,
  beaufortAutokeyEncode,
  beaufortAutokeyDecode,
  variantBeaufortEncode,
  variantBeaufortDecode,
  aesEncode,
  aesDecode,
  desEncode,
  desDecode,
  blowfishEncode,
  blowfishDecode,
  rc4Encode,
  rc4Decode,
  adfgxEncode,
  adfgxDecode,
  adfgvxEncode,
  adfgvxDecode,
  columnarEncode,
  columnarDecode,
  substitutionEncode,
  substitutionDecode,
  cryptogramEncode,
  cryptogramDecode,
  foursquareEncode,
  foursquareDecode,
  grandpreEncode,
  grandpreDecode,
  morbitEncode,
  morbitDecode,
  polluxEncode,
  polluxDecode,
  oneTimePadEncode,
  oneTimePadDecode,
  rotNEncode,
  rotNDecode,
  rot5Encode,
  rot5Decode,
  rot18Encode,
  rot18Decode,
  rsaEncode,
  rsaDecode,
  cicadaEncode,
  cicadaDecode,
} from "./ciphers";
import {
  rsaFactorizeEncode,
  rsaFactorizeDecode,
  hashLabEncode,
  hashLabDecode,
} from "./utility";

const tools: ToolEntry[] = [
  {
    id: "caesar",
    label: "Caesar Shift",
    category: "cipher",
    encode: caesarEncode,
    decode: caesarDecode,
    optionsSchema: [
      { name: "shift", type: "number", label: "Shift", defaultValue: 3, min: 1, max: 25 }
    ]
  },
  {
    id: "vigenere",
    label: "Vigenère",
    category: "cipher",
    encode: vigenereEncode,
    decode: vigenereDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Key", defaultValue: "SECRET" }
    ]
  },
  {
    id: "rot13",
    label: "ROT13",
    category: "cipher",
    encode: rot13Encode,
    decode: rot13Decode,
    optionsSchema: []
  },
  {
    id: "atbash",
    label: "Atbash",
    category: "cipher",
    encode: atbashEncode,
    decode: atbashDecode,
    optionsSchema: []
  },
  {
    id: "xor",
    label: "XOR Bitwise",
    category: "cipher",
    encode: xorEncode,
    decode: xorDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "XOR Key", defaultValue: "" }
    ]
  },
  { id: "a1z26", label: "A1Z26", category: "cipher", encode: a1z26Encode, decode: a1z26Decode, optionsSchema: [] },
  { 
    id: "affine", 
    label: "Affine Cipher", 
    category: "cipher", 
    encode: affineEncode, 
    decode: affineDecode,
    optionsSchema: [
      { name: "a", type: "number", label: "A (coprime with 26)", defaultValue: 5, min: 1, max: 25 },
      { name: "b", type: "number", label: "B", defaultValue: 8, min: 0, max: 25 }
    ]
  },
  { 
    id: "railfence", 
    label: "Rail Fence", 
    category: "cipher", 
    encode: railFenceEncode, 
    decode: railFenceDecode,
    optionsSchema: [
      { name: "rails", type: "number", label: "Rails", defaultValue: 3, min: 2, max: 10 }
    ]
  },
  { id: "bacon", label: "Bacon Cipher", category: "cipher", encode: baconEncode, decode: baconDecode, optionsSchema: [] },
  { id: "polybius", label: "Polybius Square", category: "cipher", encode: polybiusEncode, decode: polybiusDecode, optionsSchema: [] },
  { id: "rot47", label: "ROT47", category: "cipher", encode: rot47Encode, decode: rot47Decode, optionsSchema: [] },
  { 
    id: "enigma", 
    label: "Enigma (M3)", 
    category: "cipher", 
    encode: enigmaEncode, 
    decode: enigmaDecode,
    optionsSchema: [
      { name: "rotors", type: "text", label: "Rotors (comma-separated, e.g. I,II,III)", defaultValue: "I,II,III" },
      { name: "ringSettings", type: "text", label: "Ring Settings (comma-separated numbers)", defaultValue: "1,1,1" },
      { name: "startPositions", type: "text", label: "Start Positions (e.g. AAA)", defaultValue: "AAA" },
      { name: "plugboard", type: "text", label: "Plugboard Pairs (e.g. AB CD)", defaultValue: "" }
    ]
  },
  { 
    id: "playfair", 
    label: "Playfair Cipher", 
    category: "cipher", 
    encode: playfairEncode, 
    decode: playfairDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Keyword", defaultValue: "KEYWORD" }
    ]
  },
  { 
    id: "bifid", 
    label: "Bifid Cipher", 
    category: "cipher", 
    encode: bifidEncode, 
    decode: bifidDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Keyword", defaultValue: "KEYWORD" }
    ]
  },
  { 
    id: "trifid", 
    label: "Trifid Cipher", 
    category: "cipher", 
    encode: trifidEncode, 
    decode: trifidDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Keyword", defaultValue: "KEYWORD" }
    ]
  },
  { 
    id: "hill", 
    label: "Hill Cipher", 
    category: "cipher", 
    encode: hillEncode, 
    decode: hillDecode,
    optionsSchema: [
      { name: "matrix", type: "matrix", label: "Key Matrix", defaultValue: [[3, 3], [2, 5]], matrixSize: 2 }
    ]
  },
  {
    id: "pigpen",
    label: "Pigpen (Masonic)",
    category: "cipher",
    encode: pigpenEncode,
    decode: pigpenDecode,
    optionsSchema: []
  },
  {
    id: "dancingmen",
    label: "Dancing Men (Sherlock)",
    category: "cipher",
    encode: dancingMenEncode,
    decode: dancingMenDecode,
    optionsSchema: []
  },
  {
    id: "nihilist",
    label: "Nihilist Cipher",
    category: "cipher",
    encode: nihilistEncode,
    decode: nihilistDecode,
    optionsSchema: [
      { name: "keyword", type: "text", label: "Polybius Keyword", defaultValue: "SECRET" },
      { name: "key", type: "text", label: "Numeric Key", defaultValue: "CIPHER" }
    ]
  },
  {
    id: "homophonic",
    label: "Homophonic Substitution",
    category: "cipher",
    encode: homophonicEncode,
    decode: homophonicDecode,
    optionsSchema: []
  },
  {
    id: "keyedcaesar",
    label: "Keyed Caesar",
    category: "cipher",
    encode: keyedCaesarEncode,
    decode: keyedCaesarDecode,
    optionsSchema: [
      { name: "keyword", type: "text", label: "Keyword", defaultValue: "SECRET" },
      { name: "shift", type: "number", label: "Shift", defaultValue: 3, min: 1, max: 25 }
    ]
  },
  {
    id: "gronsfeld",
    label: "Gronsfeld Cipher",
    category: "cipher",
    encode: gronsfeldEncode,
    decode: gronsfeldDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Numeric Key", defaultValue: "1234" }
    ]
  },
  {
    id: "amsco",
    label: "Amsco Transposition",
    category: "cipher",
    encode: amscoEncode,
    decode: amscoDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Keyword", defaultValue: "SECRET" }
    ]
  },
  {
    id: "doubletransposition",
    label: "Double Columnar",
    category: "cipher",
    encode: doubleTranspositionEncode,
    decode: doubleTranspositionDecode,
    optionsSchema: [
      { name: "key1", type: "text", label: "Key 1", defaultValue: "SECRET" },
      { name: "key2", type: "text", label: "Key 2", defaultValue: "CIPHER" }
    ]
  },
  {
    id: "route",
    label: "Route Transposition",
    category: "cipher",
    encode: routeEncode,
    decode: routeDecode,
    optionsSchema: [
      { name: "columns", type: "number", label: "Grid Columns", defaultValue: 5, min: 2, max: 20 },
      { name: "route", type: "enum", label: "Route Pattern", defaultValue: "spiral", enumValues: [
        { value: "spiral", label: "Spiral" },
        { value: "diagonal", label: "Diagonal" },
        { value: "boustrophedon", label: "Boustrophedon" },
        { value: "columnar", label: "Simple Columnar" }
      ]}
    ]
  },
  {
    id: "scytale",
    label: "Scytale (Rod)",
    category: "cipher",
    encode: scytaleEncode,
    decode: scytaleDecode,
    optionsSchema: [
      { name: "faces", type: "number", label: "Rod Faces", defaultValue: 4, min: 2, max: 20 }
    ]
  },
  {
    id: "vigenereautokey",
    label: "Vigenère Autokey",
    category: "cipher",
    encode: vigenereAutokeyEncode,
    decode: vigenereAutokeyDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Primer Key", defaultValue: "SECRET" }
    ]
  },
  {
    id: "beaufort",
    label: "Beaufort Cipher",
    category: "cipher",
    encode: beaufortEncode,
    decode: beaufortDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Key", defaultValue: "SECRET" }
    ]
  },
  {
    id: "beaufortautokey",
    label: "Beaufort Autokey",
    category: "cipher",
    encode: beaufortAutokeyEncode,
    decode: beaufortAutokeyDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Primer Key", defaultValue: "SECRET" }
    ]
  },
  {
    id: "variantbeaufort",
    label: "Variant Beaufort",
    category: "cipher",
    encode: variantBeaufortEncode,
    decode: variantBeaufortDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Key", defaultValue: "SECRET" }
    ]
  },
  {
    id: "aes",
    label: "AES (Advanced Encryption)",
    category: "cipher",
    encode: aesEncode,
    decode: aesDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Secret Key", defaultValue: "SECRET" },
      { name: "mode", type: "enum", label: "Mode", defaultValue: "CBC", enumValues: [
        { value: "CBC", label: "CBC" },
        { value: "ECB", label: "ECB" },
        { value: "CFB", label: "CFB" },
        { value: "OFB", label: "OFB" },
        { value: "CTR", label: "CTR" }
      ]}
    ]
  },
  {
    id: "des",
    label: "DES (Data Encryption)",
    category: "cipher",
    encode: desEncode,
    decode: desDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Secret Key", defaultValue: "SECRET" },
      { name: "mode", type: "enum", label: "Mode", defaultValue: "CBC", enumValues: [
        { value: "CBC", label: "CBC" },
        { value: "ECB", label: "ECB" }
      ]}
    ]
  },
  {
    id: "blowfish",
    label: "Blowfish",
    category: "cipher",
    encode: blowfishEncode,
    decode: blowfishDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Secret Key", defaultValue: "SECRET" },
      { name: "mode", type: "enum", label: "Mode", defaultValue: "CBC", enumValues: [
        { value: "CBC", label: "CBC" },
        { value: "ECB", label: "ECB" }
      ]}
    ]
  },
  {
    id: "rc4",
    label: "RC4 (Arcfour)",
    category: "cipher",
    encode: rc4Encode,
    decode: rc4Decode,
    optionsSchema: [
      { name: "key", type: "text", label: "Secret Key", defaultValue: "SECRET" }
    ]
  },
  { id: "base32", label: "Base32", category: "encoding", encode: base32Encode, decode: base32Decode, optionsSchema: [] },
  {
    id: "base64",
    label: "Base64",
    category: "encoding",
    encode: base64Encode,
    decode: base64Decode,
    optionsSchema: []
  },
  {
    id: "hex",
    label: "Hexadecimal",
    category: "encoding",
    encode: hexEncode,
    decode: hexDecode,
    optionsSchema: []
  },
  {
    id: "binary",
    label: "Binary",
    category: "encoding",
    encode: binaryEncode,
    decode: binaryDecode,
    optionsSchema: []
  },
  {
    id: "ascii",
    label: "ASCII Decimal",
    category: "encoding",
    encode: asciiEncode,
    decode: asciiDecode,
    optionsSchema: []
  },
  {
    id: "morse",
    label: "Morse Code",
    category: "encoding",
    encode: morseEncode,
    decode: morseDecode,
    optionsSchema: []
  },
  {
    id: "url",
    label: "URL Encoding",
    category: "encoding",
    encode: urlEncode,
    decode: urlDecode,
    optionsSchema: []
  },
  {
    id: "base58",
    label: "Base58",
    category: "encoding",
    encode: base58Encode,
    decode: (text, options) => {
      try {
        return base58Decode(text);
      } catch (err: any) {
        return "ERROR: " + err.message;
      }
    },
    optionsSchema: []
  },
  {
    id: "base85",
    label: "Base85",
    category: "encoding",
    encode: base85Encode,
    decode: (text, options) => {
      try {
        return base85Decode(text);
      } catch (err: any) {
        return "ERROR: " + err.message;
      }
    },
    optionsSchema: []
  },
  {
    id: "braille",
    label: "Braille",
    category: "encoding",
    encode: brailleEncode,
    decode: brailleDecode,
    optionsSchema: []
  },
  {
    id: "base62",
    label: "Base62",
    category: "encoding",
    encode: base62Encode,
    decode: (text, options) => {
      try {
        return base62Decode(text);
      } catch (err: any) {
        return "ERROR: " + err.message;
      }
    },
    optionsSchema: []
  },
  {
    id: "base100",
    label: "Base100 (Emoji)",
    category: "encoding",
    encode: base100Encode,
    decode: base100Decode,
    optionsSchema: []
  },
  {
    id: "baudot",
    label: "Baudot (ITA2)",
    category: "encoding",
    encode: baudotEncode,
    decode: baudotDecode,
    optionsSchema: []
  },
  {
    id: "tapcode",
    label: "Tap Code",
    category: "encoding",
    encode: tapCodeEncode,
    decode: tapCodeDecode,
    optionsSchema: []
  },
  {
    id: "phonekeypad",
    label: "Phone Keypad",
    category: "encoding",
    encode: phoneKeypadEncode,
    decode: phoneKeypadDecode,
    optionsSchema: []
  },
  {
    id: "piglatin",
    label: "Pig Latin",
    category: "encoding",
    encode: pigLatinEncode,
    decode: pigLatinDecode,
    optionsSchema: []
  },
  {
    id: "geekcode",
    label: "Geek Code Block",
    category: "encoding",
    encode: geekCodeEncode,
    decode: geekCodeDecode,
    optionsSchema: []
  },
  {
    id: "bookcipher",
    label: "Book Cipher",
    category: "cipher",
    encode: bookCipherEncode,
    decode: bookCipherDecode,
    optionsSchema: [
      { name: "referenceText", type: "textarea", label: "Reference Text", defaultValue: "" },
      { name: "separator", type: "text", label: "Separator", defaultValue: "-" }
    ]
  },
  {
    id: "gematria",
    label: "Gematria Primus",
    category: "cipher",
    encode: gematriaEncode,
    decode: gematriaDecode,
    optionsSchema: [
      { name: "format", type: "enum", label: "Output Format", defaultValue: "primes", enumValues: [{value: "runes", label: "Runes"}, {value: "primes", label: "Primes"}, {value: "latin", label: "Latin"}] }
    ]
  },
  {
    id: "runic",
    label: "Runic (Elder Futhark)",
    category: "cipher",
    encode: runicEncode,
    decode: runicDecode,
    optionsSchema: []
  },
  {
    id: "rsafactorizer",
    label: "RSA Factorizer",
    category: "utility",
    encode: rsaFactorizeEncode,
    decode: rsaFactorizeDecode,
    optionsSchema: []
  },
  {
    id: "hashlab",
    label: "Hash Lab",
    category: "utility",
    encode: hashLabEncode,
    decode: hashLabDecode,
    optionsSchema: []
  },
  {
    id: "adfgx",
    label: "ADFGX Cipher",
    category: "cipher",
    encode: adfgxEncode,
    decode: adfgxDecode,
    optionsSchema: [
      { name: "squareKey", type: "text", label: "Square Keyword", defaultValue: "KEYWORD" },
      { name: "key", type: "text", label: "Transposition Key", defaultValue: "CIPHER" }
    ]
  },
  {
    id: "adfgvx",
    label: "ADFGVX Cipher",
    category: "cipher",
    encode: adfgvxEncode,
    decode: adfgvxDecode,
    optionsSchema: [
      { name: "squareKey", type: "text", label: "Square Keyword", defaultValue: "KEYWORD" },
      { name: "key", type: "text", label: "Transposition Key", defaultValue: "CIPHER" }
    ]
  },
  {
    id: "columnar",
    label: "Columnar Transposition",
    category: "cipher",
    encode: columnarEncode,
    decode: columnarDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Key", defaultValue: "KEY" }
    ]
  },
  {
    id: "substitution",
    label: "Substitution Cipher",
    category: "cipher",
    encode: substitutionEncode,
    decode: substitutionDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Cipher Alphabet Key", defaultValue: "QWERTYUIOPASDFGHJKLZXCVBNM" }
    ]
  },
  {
    id: "cryptogram",
    label: "Cryptogram",
    category: "cipher",
    encode: cryptogramEncode,
    decode: cryptogramDecode,
    optionsSchema: [
      { name: "keyword", type: "text", label: "Keyword", defaultValue: "PUZZLE" }
    ]
  },
  {
    id: "foursquare",
    label: "Four-Square Cipher",
    category: "cipher",
    encode: foursquareEncode,
    decode: foursquareDecode,
    optionsSchema: [
      { name: "key1", type: "text", label: "Top-Right Keyword", defaultValue: "EXAMPLE" },
      { name: "key2", type: "text", label: "Bottom-Left Keyword", defaultValue: "KEYWORD" }
    ]
  },
  {
    id: "grandpre",
    label: "Grandpré Cipher",
    category: "cipher",
    encode: grandpreEncode,
    decode: grandpreDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Row Keyword (10 letters)", defaultValue: "REPUBLICAN" }
    ]
  },
  {
    id: "morbit",
    label: "Morbit Cipher",
    category: "cipher",
    encode: morbitEncode,
    decode: morbitDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Digit Key (permutation of 1-9)", defaultValue: "123456789" }
    ]
  },
  {
    id: "pollux",
    label: "Pollux Cipher",
    category: "cipher",
    encode: polluxEncode,
    decode: polluxDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Digit Key (permutation of 0-9)", defaultValue: "0123456789" }
    ]
  },
  {
    id: "onetimepad",
    label: "One-Time Pad (Vernam)",
    category: "cipher",
    encode: oneTimePadEncode,
    decode: oneTimePadDecode,
    optionsSchema: [
      { name: "key", type: "text", label: "Pad Key (letters, ≥ message length)", defaultValue: "" }
    ]
  },
  {
    id: "rotn",
    label: "ROT-N",
    category: "cipher",
    encode: rotNEncode,
    decode: rotNDecode,
    optionsSchema: [
      { name: "shift", type: "number", label: "N (rotation amount)", defaultValue: 13, min: 1, max: 25 }
    ]
  },
  {
    id: "rot5",
    label: "ROT5",
    category: "cipher",
    encode: rot5Encode,
    decode: rot5Decode,
    optionsSchema: []
  },
  {
    id: "rot18",
    label: "ROT18",
    category: "cipher",
    encode: rot18Encode,
    decode: rot18Decode,
    optionsSchema: []
  },
  {
    id: "rsa",
    label: "RSA Encryption",
    category: "cipher",
    encode: rsaEncode,
    decode: rsaDecode,
    optionsSchema: [
      { name: "p", type: "text", label: "Prime p", defaultValue: "61" },
      { name: "q", type: "text", label: "Prime q", defaultValue: "53" },
      { name: "e", type: "text", label: "Public Exponent e", defaultValue: "17" },
      { name: "d", type: "text", label: "Private Exponent d (decrypt only, optional)", defaultValue: "" }
    ]
  },
  {
    id: "cicada",
    label: "Cicada 3301 Totient Cipher",
    category: "cipher",
    encode: cicadaEncode,
    decode: cicadaDecode,
    optionsSchema: [
      { name: "seed", type: "number", label: "Starting Prime Seed", defaultValue: 2, min: 2, max: 10000 }
    ]
  },
];

const toolMap = new Map(tools.map((t) => [t.id, t]));

/** Pipeline layer display names → registry ids (EncodingLab cascade presets). */
export const pipelineLayerIds: Record<string, string> = {
  Base64: "base64",
  Hex: "hex",
  Binary: "binary",
  URL: "url",
  Morse: "morse",
  Base32: "base32",
  Base58: "base58",
  Base85: "base85",
  Braille: "braille",
};

export function getTool(id: string): ToolEntry | undefined {
  return toolMap.get(id);
}

export function getAllTools(): ToolEntry[] {
  return [...tools];
}

export function getToolsByCategory(category: ToolEntry["category"]): ToolEntry[] {
  return tools.filter((t) => t.category === category);
}

export { asText, asResult } from "./types";
export type { ToolEntry, ToolOptions, TransformOutput, TransformResult, ToolCategory } from "./types";
