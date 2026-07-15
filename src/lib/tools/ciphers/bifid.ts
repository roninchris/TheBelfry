function getUniqueChars(str: string): string[] {
  const chars: string[] = [];
  for (const char of str) {
    if (!chars.includes(char)) {
      chars.push(char);
    }
  }
  return chars;
}

function genPolybiusSquare(keyword: string): string[][] {
  const alpha = "ABCDEFGHIKLMNOPQRSTUVWXYZ";
  const cleanKeyword = keyword.toUpperCase().replace(/J/g, "I");
  const polArray = getUniqueChars(cleanKeyword + alpha);
  const polybius: string[][] = [];
  for (let i = 0; i < 5; i++) {
    polybius.push(polArray.slice(i * 5, i * 5 + 5));
  }
  return polybius;
}

export function bifidEncode(text: string, options?: { key?: string }): string {
  const keywordStr = (options?.key ?? "").toUpperCase().replace(/J/g, "I");
  const alpha = "ABCDEFGHIKLMNOPQRSTUVWXYZ";
  const xCo: number[] = [];
  const yCo: number[] = [];
  const structure: (boolean | string)[] = [];

  const polybius = genPolybiusSquare(keywordStr);

  text.replace(/J/g, "I").replace(/j/g, "i").split("").forEach((letter) => {
    const uppercaseLetter = letter.toUpperCase();
    const alpInd = alpha.indexOf(uppercaseLetter) >= 0;

    if (alpInd) {
      let found = false;
      for (let i = 0; i < 5; i++) {
        const polInd = polybius[i].indexOf(uppercaseLetter);
        if (polInd >= 0) {
          xCo.push(polInd);
          yCo.push(i);
          found = true;
          break;
        }
      }

      if (found) {
        if (alpha.indexOf(letter) >= 0) {
          structure.push(true);
        } else {
          structure.push(false);
        }
      } else {
        structure.push(letter);
      }
    } else {
      structure.push(letter);
    }
  });

  const trans = [...yCo, ...xCo];
  let count = 0;
  let output = "";

  structure.forEach((pos) => {
    if (typeof pos === "boolean") {
      const row = trans[2 * count];
      const col = trans[2 * count + 1];
      const char = polybius[row]?.[col] ?? "";

      output += pos ? char : char.toLowerCase();
      count++;
    } else {
      output += pos;
    }
  });

  return output;
}

export function bifidDecode(text: string, options?: { key?: string }): string {
  const keywordStr = (options?.key ?? "").toUpperCase().replace(/J/g, "I");
  const alpha = "ABCDEFGHIKLMNOPQRSTUVWXYZ";
  const structure: (boolean | string)[] = [];

  let trans: number[] = [];

  const polybius = genPolybiusSquare(keywordStr);

  text.replace(/J/g, "I").replace(/j/g, "i").split("").forEach((letter) => {
    const uppercaseLetter = letter.toUpperCase();
    const alpInd = alpha.indexOf(uppercaseLetter) >= 0;

    if (alpInd) {
      let found = false;
      for (let i = 0; i < 5; i++) {
        const polInd = polybius[i].indexOf(uppercaseLetter);
        if (polInd >= 0) {
          trans.push(i, polInd);
          found = true;
          break;
        }
      }

      if (found) {
        if (alpha.indexOf(letter) >= 0) {
          structure.push(true);
        } else {
          structure.push(false);
        }
      } else {
        structure.push(letter);
      }
    } else {
      structure.push(letter);
    }
  });

  let count = 0;
  let output = "";
  const halfLen = trans.length / 2;

  structure.forEach((pos) => {
    if (typeof pos === "boolean") {
      const row = trans[count];
      const col = trans[count + halfLen];
      const char = polybius[row]?.[col] ?? "";

      output += pos ? char : char.toLowerCase();
      count++;
    } else {
      output += pos;
    }
  });

  return output;
}
