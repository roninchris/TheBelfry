function getUniqueChars(str: string): string[] {
  const chars: string[] = [];
  for (const char of str) {
    if (!chars.includes(char)) {
      chars.push(char);
    }
  }
  return chars;
}

function genTrifidAlphabet(keyword: string): string {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.";
  const cleanKeyword = keyword.toUpperCase().replace(/[^A-Z.]/g, "");
  const uniqueChars = getUniqueChars(cleanKeyword + alpha);
  return uniqueChars.slice(0, 27).join("");
}

export function trifidEncode(text: string, options?: { key?: string }): string {
  const alphabet = genTrifidAlphabet(options?.key ?? "");
  const layerCo: number[] = [];
  const rowCo: number[] = [];
  const colCo: number[] = [];
  const structure: (boolean | string)[] = [];

  text.split("").forEach((letter) => {
    const uppercaseLetter = letter.toUpperCase();
    const alpInd = alphabet.indexOf(uppercaseLetter);

    if (alpInd >= 0) {
      layerCo.push(Math.floor(alpInd / 9));
      rowCo.push(Math.floor((alpInd % 9) / 3));
      colCo.push(alpInd % 3);

      if (letter === uppercaseLetter) {
        structure.push(true); // Uppercase
      } else {
        structure.push(false); // Lowercase
      }
    } else {
      structure.push(letter); // Non-alphabetic/extra char
    }
  });

  const trans = [...layerCo, ...rowCo, ...colCo];
  let count = 0;
  let output = "";

  structure.forEach((pos) => {
    if (typeof pos === "boolean") {
      const layer = trans[3 * count];
      const row = trans[3 * count + 1];
      const col = trans[3 * count + 2];
      const idx = layer * 9 + row * 3 + col;
      const char = alphabet[idx];

      output += pos ? char : char.toLowerCase();
      count++;
    } else {
      output += pos;
    }
  });

  return output;
}

export function trifidDecode(text: string, options?: { key?: string }): string {
  const alphabet = genTrifidAlphabet(options?.key ?? "");
  const structure: (boolean | string)[] = [];
  const trans: number[] = [];

  text.split("").forEach((letter) => {
    const uppercaseLetter = letter.toUpperCase();
    const alpInd = alphabet.indexOf(uppercaseLetter);

    if (alpInd >= 0) {
      trans.push(
        Math.floor(alpInd / 9),
        Math.floor((alpInd % 9) / 3),
        alpInd % 3
      );

      if (letter === uppercaseLetter) {
        structure.push(true);
      } else {
        structure.push(false);
      }
    } else {
      structure.push(letter);
    }
  });

  const N = trans.length / 3;
  let count = 0;
  let output = "";

  structure.forEach((pos) => {
    if (typeof pos === "boolean") {
      const layer = trans[count];
      const row = trans[count + N];
      const col = trans[count + 2 * N];
      const idx = layer * 9 + row * 3 + col;
      const char = alphabet[idx];

      output += pos ? char : char.toLowerCase();
      count++;
    } else {
      output += pos;
    }
  });

  return output;
}
