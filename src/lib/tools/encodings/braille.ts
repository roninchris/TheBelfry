/** Braille encode/decode — ported from CyberChef */

const BRAILLE_LOOKUP = {
  ascii: " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=",
  dot6:  "⠀⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿"
};

export function brailleEncode(str: string): string {
  if (!str) return "";
  return str
    .split("")
    .map((c) => {
      const idx = BRAILLE_LOOKUP.ascii.indexOf(c.toUpperCase());
      return idx < 0 ? c : BRAILLE_LOOKUP.dot6[idx];
    })
    .join("");
}

export function brailleDecode(str: string): string {
  if (!str) return "";
  return str
    .split("")
    .map((b) => {
      const idx = BRAILLE_LOOKUP.dot6.indexOf(b);
      return idx < 0 ? b : BRAILLE_LOOKUP.ascii[idx];
    })
    .join("");
}
