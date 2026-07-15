const ROTOR_WIRINGS: Record<string, string> = {
  "I": "EKMFLGDQVZNTOWYHXUSPAIBRCJ",
  "II": "AJDKSIRUXBLHWTMCQGZNPYFVOE",
  "III": "BDFHJLCPRTXVZNYEIWGAKMUSQO",
  "IV": "ESOVPZJAYQUIRHXLNFTGKDCMWB",
  "V": "VZBRGITYUPSDNHLXAWMJQOFECK",
  "VI": "JPGVOUMFYQBENHZRDKASXLICTW",
  "VII": "NZJHGRCXMYSWBOVFAIVLPEKQDT",
  "VIII": "FKQHTLXOCBJSPOZRAMEWNIUYGV",
  "beta": "LEYJVCNIXWPBQMDRTAKZGFUHOS",
  "gamma": "FSOKANUERHMBTIYCWLQPZXVGJD"
};

const TURNOVERS: Record<string, string[]> = {
  "I": ["Q"],
  "II": ["E"],
  "III": ["V"],
  "IV": ["J"],
  "V": ["Z"],
  "VI": ["Z", "M"],
  "VII": ["Z", "M"],
  "VIII": ["Z", "M"],
  "beta": [],
  "gamma": []
};

const REFLECTOR_B = "ENKQAUYWJICOPLMBDXZVFTHRGS";

interface RotorSetting {
  rotorName: string;
  rotorPosition: string;
  ringSetting: string;
}

function getDistance(l1: string, l2: string): number {
  return (l2.charCodeAt(0) - l1.charCodeAt(0) + 26) % 26;
}

function getLetterPlusShift(letter: string, shift: number): string {
  const code = letter.charCodeAt(0) - 65;
  const shiftedCode = (code + shift + 26) % 26;
  return String.fromCharCode(shiftedCode + 65);
}

function getInverseWiring(wiring: string): string {
  const inverse = new Array(26);
  for (let i = 0; i < 26; i++) {
    const char = wiring[i];
    const index = char.charCodeAt(0) - 65;
    inverse[index] = String.fromCharCode(i + 65);
  }
  return inverse.join("");
}

function isOnTurnoverLetter(setting: RotorSetting): boolean {
  const turnovers = TURNOVERS[setting.rotorName];
  if (!turnovers) return false;
  return turnovers.includes(setting.rotorPosition);
}

function advanceRotors(settings: RotorSetting[]): RotorSetting[] {
  return settings.map((rotorSetting, index, currentSettings) => {
    const isSlowRotor = index === 0;
    const isFastRotor = index === currentSettings.length - 1;
    
    const shouldAdvance = isFastRotor ||
      (!isSlowRotor && isOnTurnoverLetter(rotorSetting)) ||
      isOnTurnoverLetter(currentSettings[index + 1]);
      
    if (shouldAdvance) {
      const nextChar = getLetterPlusShift(rotorSetting.rotorPosition, 1);
      return { ...rotorSetting, rotorPosition: nextChar };
    } else {
      return rotorSetting;
    }
  });
}

function getRotorEncryptor(rotorWiring: string, rotorPosition: string, ringSetting = "A") {
  const rotorOffset = getDistance(ringSetting, rotorPosition);
  return (letter: string): string => {
    const wiringElementToPerformShift = getLetterPlusShift(letter, rotorOffset);
    const targetChar = rotorWiring[wiringElementToPerformShift.charCodeAt(0) - 65];
    const wiringElementShift = getDistance(wiringElementToPerformShift, targetChar);
    return getLetterPlusShift(letter, wiringElementShift);
  };
}

function encryptCharacter(
  letter: string,
  settings: RotorSetting[],
  reflectorWiring: string,
  plugboardMap: Record<string, string>
): string {
  const uppercaseLetter = letter.toUpperCase();
  if (uppercaseLetter >= "A" && uppercaseLetter <= "Z") {
    // 1. Plugboard
    let char = plugboardMap[uppercaseLetter] || uppercaseLetter;
    
    // 2. Forward rotors (right to left, so backward through the array settings)
    for (let i = settings.length - 1; i >= 0; i--) {
      const { rotorName, rotorPosition, ringSetting } = settings[i];
      const wiring = ROTOR_WIRINGS[rotorName] || ROTOR_WIRINGS["I"];
      const encryptor = getRotorEncryptor(wiring, rotorPosition, ringSetting);
      char = encryptor(char);
    }
    
    // 3. Reflector
    char = reflectorWiring[char.charCodeAt(0) - 65] || char;
    
    // 4. Backward rotors (left to right, forward through the array settings)
    for (let i = 0; i < settings.length; i++) {
      const { rotorName, rotorPosition, ringSetting } = settings[i];
      const wiring = ROTOR_WIRINGS[rotorName] || ROTOR_WIRINGS["I"];
      const inverseWiring = getInverseWiring(wiring);
      const encryptor = getRotorEncryptor(inverseWiring, rotorPosition, ringSetting);
      char = encryptor(char);
    }
    
    // 5. Plugboard
    char = plugboardMap[char] || char;
    
    return char;
  }
  return letter;
}

export function enigmaCipher(
  text: string,
  options?: any
): string {
  let rotorsOpt: string[] = ["I", "II", "III"];
  if (options?.rotors) {
    if (typeof options.rotors === "string") {
      rotorsOpt = options.rotors.split(",").map((s: string) => s.trim());
    } else if (Array.isArray(options.rotors)) {
      rotorsOpt = options.rotors;
    }
  } else if (options?.rotor1) {
    rotorsOpt = [
      options?.rotor1 ?? "I",
      options?.rotor2 ?? "II",
      options?.rotor3 ?? "III"
    ];
  }
  
  let startPosOpt = options?.startPositions ?? "AAA";
  startPosOpt = startPosOpt.toUpperCase().replace(/[^A-Z]/g, "");
  if (startPosOpt.length < rotorsOpt.length) {
    startPosOpt = startPosOpt.padEnd(rotorsOpt.length, "A");
  } else if (startPosOpt.length > rotorsOpt.length) {
    startPosOpt = startPosOpt.substring(0, rotorsOpt.length);
  }
  
  let ringSettingsOpt: number[] = [1, 1, 1];
  if (options?.ringSettings) {
    if (typeof options.ringSettings === "string") {
      ringSettingsOpt = options.ringSettings.split(",").map((s: string) => parseInt(s.trim(), 10) || 1);
    } else if (Array.isArray(options.ringSettings)) {
      ringSettingsOpt = options.ringSettings;
    }
  } else if (options?.ring1) {
    ringSettingsOpt = [
      options?.ring1 ?? 1,
      options?.ring2 ?? 1,
      options?.ring3 ?? 1
    ];
  }
  
  const ringLetters: string[] = [];
  for (let i = 0; i < rotorsOpt.length; i++) {
    const num = ringSettingsOpt[i] ?? 1;
    const letterCode = ((num - 1 + 26) % 26) + 65;
    ringLetters.push(String.fromCharCode(letterCode));
  }
  
  const plugboardMap: Record<string, string> = {};
  if (options?.plugboard) {
    const pairs = options.plugboard.toUpperCase().split(/\s+/);
    for (const pair of pairs) {
      if (pair.length === 2) {
        const [char1, char2] = pair.split("");
        if (char1 >= "A" && char1 <= "Z" && char2 >= "A" && char2 <= "Z") {
          plugboardMap[char1] = char2;
          plugboardMap[char2] = char1;
        }
      }
    }
  }
  
  let currentSettings = rotorsOpt.map((rotorName, index) => {
    return {
      rotorName,
      rotorPosition: startPosOpt[index] ?? "A",
      ringSetting: ringLetters[index] ?? "A"
    };
  });
  
  const reflectorWiring = REFLECTOR_B;
  
  return text
    .split("")
    .map((char) => {
      const isUpper = char >= "A" && char <= "Z";
      const isLower = char >= "a" && char <= "z";
      if (isUpper || isLower) {
        currentSettings = advanceRotors(currentSettings);
        const uppercaseChar = char.toUpperCase();
        const encryptedUpper = encryptCharacter(uppercaseChar, currentSettings, reflectorWiring, plugboardMap);
        return isUpper ? encryptedUpper : encryptedUpper.toLowerCase();
      }
      return char;
    })
    .join("");
}

export function enigmaEncode(
  text: string,
  options?: {
    rotors?: string[];
    ringSettings?: number[];
    startPositions?: string;
    plugboard?: string;
  }
): string {
  return enigmaCipher(text, options);
}

export function enigmaDecode(
  text: string,
  options?: {
    rotors?: string[];
    ringSettings?: number[];
    startPositions?: string;
    plugboard?: string;
  }
): string {
  return enigmaCipher(text, options);
}
