// Vendored from steganography.js by Peter Eigenschink (MIT license)
// Original: https://github.com/peter eigenschink/steganography.js

export class Cover {
  constructor() {
    this.config = defaultConfig;
  }
}

export const defaultConfig = {
  t: 3,
  threshold: 1,
  codeUnitSize: 16,
  args: function(i) {
    return i + 1;
  },
  messageDelimiter: function(modMessage, threshold) {
    const delimiter = new Array(threshold * 3);
    for (let i = 0; i < delimiter.length; i += 1)
      delimiter[i] = 255;
    return delimiter;
  },
  messageCompleted: function(data, i, threshold) {
    let done = true;
    for (let j = 0; j < 16 && done; j += 1) {
      done = done && data[i + j * 4] === 255;
    }
    return done;
  }
};
