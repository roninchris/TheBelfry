function getUniqueChars(str: string): string[] {
  const chars: string[] = [];
  for (const char of str) {
    if (!chars.includes(char)) {
      chars.push(char);
    }
  }
  return chars;
}

function genPlayfairMatrix(key: string): string[][] {
  const alpha = "ABCDEFGHIKLMNOPQRSTUVWXYZ"; // 'J' is excluded, mapped to 'I'
  const cleanKey = key.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
  const uniqueChars = getUniqueChars(cleanKey + alpha);
  const matrix: string[][] = [];
  for (let i = 0; i < 5; i++) {
    matrix.push(uniqueChars.slice(i * 5, i * 5 + 5));
  }
  return matrix;
}

interface AlphabeticChar {
  char: string;
  isUpper: boolean;
  originalIndex?: number;
}

export function playfairEncode(text: string, options?: { key?: string }): string {
  const matrix = genPlayfairMatrix(options?.key ?? "");
  const alpha = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

  // 1. Extract alphabetic characters and track casing
  const originalChars: AlphabeticChar[] = [];
  const textChars = text.split("");

  textChars.forEach((char, index) => {
    let cleanChar = char.toUpperCase();
    if (cleanChar === "J") cleanChar = "I";

    if (alpha.includes(cleanChar)) {
      originalChars.push({
        char: cleanChar,
        isUpper: char === char.toUpperCase(),
        originalIndex: index,
      });
    }
  });

  // 2. Group into bigrams inserting fillers ('X') as needed
  const bigramChars: AlphabeticChar[] = [];
  let i = 0;
  while (i < originalChars.length) {
    const char1 = originalChars[i];
    bigramChars.push(char1);

    if (i + 1 < originalChars.length) {
      const char2 = originalChars[i + 1];
      if (char1.char === char2.char) {
        // Insert 'X' filler
        bigramChars.push({
          char: "X",
          isUpper: char1.isUpper,
          originalIndex: undefined, // Indicates this is an inserted character
        });
        i++;
      } else {
        bigramChars.push(char2);
        i += 2;
      }
    } else {
      // Pad with 'X'
      bigramChars.push({
        char: "X",
        isUpper: char1.isUpper,
        originalIndex: undefined,
      });
      i++;
    }
  }

  // Helper to find coords in matrix
  const findCoords = (char: string): [number, number] => {
    for (let r = 0; r < 5; r++) {
      const c = matrix[r].indexOf(char);
      if (c >= 0) return [r, c];
    }
    return [0, 0];
  };

  // 3. Encrypt bigrams
  const encryptedChars: AlphabeticChar[] = [];
  for (let j = 0; j < bigramChars.length; j += 2) {
    const c1 = bigramChars[j];
    const c2 = bigramChars[j + 1];

    const [r1, col1] = findCoords(c1.char);
    const [r2, col2] = findCoords(c2.char);

    let newR1 = r1, newCol1 = col1;
    let newR2 = r2, newCol2 = col2;

    if (r1 === r2) {
      // Same row
      newCol1 = (col1 + 1) % 5;
      newCol2 = (col2 + 1) % 5;
    } else if (col1 === col2) {
      // Same column
      newR1 = (r1 + 1) % 5;
      newR2 = (r2 + 1) % 5;
    } else {
      // Rectangle
      newCol1 = col2;
      newCol2 = col1;
    }

    encryptedChars.push({
      char: matrix[newR1][newCol1],
      isUpper: c1.isUpper,
      originalIndex: c1.originalIndex,
    });
    encryptedChars.push({
      char: matrix[newR2][newCol2],
      isUpper: c2.isUpper,
      originalIndex: c2.originalIndex,
    });
  }

  // 4. Reconstruct the output
  // To handle inserted fillers, we can build the string by walking through the input
  // and replacing letters, inserting the encrypted fillers where they were created.
  let output = "";
  let encryptedIndex = 0;

  for (let idx = 0; idx < text.length; idx++) {
    const char = text[idx];
    let cleanChar = char.toUpperCase();
    if (cleanChar === "J") cleanChar = "I";

    if (alpha.includes(cleanChar)) {
      // Consume encrypted characters until we match originalIndex or find an inserted character
      while (
        encryptedIndex < encryptedChars.length &&
        encryptedChars[encryptedIndex].originalIndex === undefined
      ) {
        const fill = encryptedChars[encryptedIndex];
        output += fill.isUpper ? fill.char : fill.char.toLowerCase();
        encryptedIndex++;
      }

      if (encryptedIndex < encryptedChars.length) {
        const enc = encryptedChars[encryptedIndex];
        output += enc.isUpper ? enc.char : enc.char.toLowerCase();
        encryptedIndex++;
      }
    } else {
      output += char;
    }
  }

  // Catch any remaining characters (like trailing padding 'X')
  while (encryptedIndex < encryptedChars.length) {
    const fill = encryptedChars[encryptedIndex];
    output += fill.isUpper ? fill.char : fill.char.toLowerCase();
    encryptedIndex++;
  }

  return output;
}

export function playfairDecode(text: string, options?: { key?: string }): string {
  const matrix = genPlayfairMatrix(options?.key ?? "");
  const alpha = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

  // 1. Extract alphabetic characters and track casing
  const originalChars: AlphabeticChar[] = [];
  const textChars = text.split("");

  textChars.forEach((char, index) => {
    let cleanChar = char.toUpperCase();
    if (cleanChar === "J") cleanChar = "I";

    if (alpha.includes(cleanChar)) {
      originalChars.push({
        char: cleanChar,
        isUpper: char === char.toUpperCase(),
        originalIndex: index,
      });
    }
  });

  // Helper to find coords in matrix
  const findCoords = (char: string): [number, number] => {
    for (let r = 0; r < 5; r++) {
      const c = matrix[r].indexOf(char);
      if (c >= 0) return [r, c];
    }
    return [0, 0];
  };

  // 2. Decrypt bigrams directly (no filler insertion since it's already encoded)
  const decryptedChars: AlphabeticChar[] = [];
  for (let j = 0; j < originalChars.length; j += 2) {
    if (j + 1 >= originalChars.length) {
      // Odd character at the very end of decode (unlikely if valid Playfair, but handle gracefully)
      decryptedChars.push(originalChars[j]);
      break;
    }

    const c1 = originalChars[j];
    const c2 = originalChars[j + 1];

    const [r1, col1] = findCoords(c1.char);
    const [r2, col2] = findCoords(c2.char);

    let newR1 = r1, newCol1 = col1;
    let newR2 = r2, newCol2 = col2;

    if (r1 === r2) {
      // Same row
      newCol1 = (col1 + 4) % 5;
      newCol2 = (col2 + 4) % 5;
    } else if (col1 === col2) {
      // Same column
      newR1 = (r1 + 4) % 5;
      newR2 = (r2 + 4) % 5;
    } else {
      // Rectangle
      newCol1 = col2;
      newCol2 = col1;
    }

    decryptedChars.push({
      char: matrix[newR1][newCol1],
      isUpper: c1.isUpper,
      originalIndex: c1.originalIndex,
    });
    decryptedChars.push({
      char: matrix[newR2][newCol2],
      isUpper: c2.isUpper,
      originalIndex: c2.originalIndex,
    });
  }

  // 3. Reconstruct output
  let output = "";
  let decryptedIndex = 0;

  for (let idx = 0; idx < text.length; idx++) {
    const char = text[idx];
    let cleanChar = char.toUpperCase();
    if (cleanChar === "J") cleanChar = "I";

    if (alpha.includes(cleanChar)) {
      if (decryptedIndex < decryptedChars.length) {
        const dec = decryptedChars[decryptedIndex];
        output += dec.isUpper ? dec.char : dec.char.toLowerCase();
        decryptedIndex++;
      }
    } else {
      output += char;
    }
  }

  return output;
}
