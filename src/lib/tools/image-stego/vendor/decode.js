// Vendored from steganography.js by Peter Eigenschink (MIT license)
// Original: https://github.com/peter eigenschink/steganography.js

import { util } from "./util";
import { defaultConfig } from "./config";

function normalizeImageSource(image) {
  if (typeof image === "string") {
    return util.loadImg(image);
  }

  if (image instanceof HTMLCanvasElement || image instanceof HTMLImageElement) {
    return image;
  }

  if (image && typeof image.src === "string") {
    return util.loadImg(image.src);
  }

  throw new Error("IllegalInput: The input image is neither a URL string nor an image.");
}

export function decodeCover(image, options) {
  const source = normalizeImageSource(image);
  options = options || {};
  const config = defaultConfig;

  const t = options.t || config.t,
    threshold = options.threshold || config.threshold,
    codeUnitSize = options.codeUnitSize || config.codeUnitSize,
    prime = util.findNextPrime(Math.pow(2, t)),
    args = options.args || config.args,
    messageCompleted = options.messageCompleted || config.messageCompleted;

  if (!t || t < 1 || t > 7) throw new Error('IllegalOptions: Parameter t = " + t + " is not valid: 0 < t < 8');

  const shadowCanvas = document.createElement("canvas");
  const shadowCtx = shadowCanvas.getContext("2d");
  if (!shadowCtx) {
    throw new Error("Unable to obtain 2D canvas context");
  }

  shadowCanvas.style.display = "none";
  shadowCanvas.width = options.width || source.width;
  shadowCanvas.height = options.height || source.height;
  if (options.height && options.width) {
    shadowCtx.drawImage(source, 0, 0, options.width, options.height);
  } else {
    shadowCtx.drawImage(source, 0, 0);
  }

  const imageData = shadowCtx.getImageData(0, 0, shadowCanvas.width, shadowCanvas.height);
  const data = imageData.data;
  const modMessage = [];

  let i, done;
  if (threshold === 1) {
    for (i = 3, done = false; !done && i < data.length && !done; i += 4) {
      done = messageCompleted(data, i, threshold);
      if (!done) modMessage.push(data[i] - (255 - prime + 1));
    }
  }

  let message = "", charCode = 0, bitCount = 0, mask = Math.pow(2, codeUnitSize) - 1;
  for (i = 0; i < modMessage.length; i += 1) {
    charCode += modMessage[i] << bitCount;
    bitCount += t;
    if (bitCount >= codeUnitSize) {
      message += String.fromCharCode(charCode & mask);
      bitCount %= codeUnitSize;
      charCode = modMessage[i] >> (t - bitCount);
    }
  }
  if (charCode !== 0) message += String.fromCharCode(charCode & mask);

  return message;
}
