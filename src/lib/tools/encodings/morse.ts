/** Morse code encode/decode — relocated from EncodingLab.tsx */
const morseMap: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  "0": "-----",
  " ": "/",
};

const revMorseMap = Object.entries(morseMap).reduce(
  (acc, [char, code]) => {
    acc[code] = char;
    return acc;
  },
  {} as Record<string, string>
);

export function textToMorse(str: string): string {
  return str
    .toUpperCase()
    .split("")
    .map((c) => morseMap[c] || "")
    .filter(Boolean)
    .join(" ");
}

export function morseToText(morse: string): string {
  try {
    return morse
      .split(" ")
      .map((code) => revMorseMap[code] || " ")
      .join("");
  } catch {
    return "ERROR: Invalid morse sequence";
  }
}

export const morseEncode = textToMorse;
export const morseDecode = morseToText;
