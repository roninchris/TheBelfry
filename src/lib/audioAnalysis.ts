export const applySpectralSubtraction = (channelData: Float32Array, sampleRate: number): Float32Array => {
  const fftSize = 1024;
  const hopSize = 512;
  const length = channelData.length;
  
  // Hann Window
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  // Bit reversal table
  const reverseTable = new Uint32Array(fftSize);
  let limit = 1;
  let bit = fftSize >> 1;
  while (limit < fftSize) {
    for (let i = 0; i < limit; i++) {
      reverseTable[i + limit] = reverseTable[i] + bit;
    }
    limit = limit << 1;
    bit = bit >> 1;
  }

  const fft = (re: Float32Array, im: Float32Array) => {
    for (let i = 0; i < fftSize; i++) {
      if (i < reverseTable[i]) {
        [re[i], re[reverseTable[i]]] = [re[reverseTable[i]], re[i]];
        [im[i], im[reverseTable[i]]] = [im[reverseTable[i]], im[i]];
      }
    }
    for (let len = 2; len <= fftSize; len <<= 1) {
      const angle = -2 * Math.PI / len;
      const wlenRe = Math.cos(angle);
      const wlenIm = Math.sin(angle);
      for (let i = 0; i < fftSize; i += len) {
        let wRe = 1;
        let wIm = 0;
        for (let j = 0; j < len / 2; j++) {
          const uRe = re[i + j];
          const uIm = im[i + j];
          const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
          const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
          re[i + j] = uRe + vRe;
          im[i + j] = uIm + vIm;
          re[i + j + len / 2] = uRe - vRe;
          im[i + j + len / 2] = uIm - vIm;
          const tmpRe = wRe * wlenRe - wIm * wlenIm;
          wIm = wRe * wlenIm + wIm * wlenRe;
          wRe = tmpRe;
        }
      }
    }
  };

  const ifft = (re: Float32Array, im: Float32Array) => {
    // Conjugate
    for (let i = 0; i < fftSize; i++) im[i] = -im[i];
    fft(re, im);
    // Conjugate and scale
    for (let i = 0; i < fftSize; i++) {
      re[i] /= fftSize;
      im[i] = -im[i] / fftSize;
    }
  };

  // 1. Identify quietest 10% of frames to estimate noise floor
  const numFrames = Math.floor((length - fftSize) / hopSize) + 1;
  const frameEnergies: { index: number, energy: number }[] = [];
  
  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let energy = 0;
    for (let i = 0; i < fftSize; i++) {
      const val = channelData[start + i] * window[i];
      energy += val * val;
    }
    frameEnergies.push({ index: f, energy });
  }

  frameEnergies.sort((a, b) => a.energy - b.energy);
  const noiseFrameCount = Math.max(1, Math.floor(numFrames * 0.1));
  const noiseMagnitude = new Float32Array(fftSize / 2 + 1);

  for (let i = 0; i < noiseFrameCount; i++) {
    const fIdx = frameEnergies[i].index;
    const start = fIdx * hopSize;
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    for (let j = 0; j < fftSize; j++) re[j] = channelData[start + j] * window[j];
    fft(re, im);
    for (let j = 0; j <= fftSize / 2; j++) {
      noiseMagnitude[j] += Math.sqrt(re[j] * re[j] + im[j] * im[j]);
    }
  }

  for (let j = 0; j <= fftSize / 2; j++) {
    noiseMagnitude[j] /= noiseFrameCount;
  }

  // 2. Subtract noise and reconstruct
  const output = new Float32Array(length);
  const windowSum = new Float32Array(length);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    for (let j = 0; j < fftSize; j++) re[j] = channelData[start + j] * window[j];
    
    fft(re, im);

    for (let j = 0; j <= fftSize / 2; j++) {
      const mag = Math.sqrt(re[j] * re[j] + im[j] * im[j]);
      const newMag = Math.max(0, mag - noiseMagnitude[j] * 1.5); // Over-subtraction for better noise removal
      const scale = mag > 0 ? newMag / mag : 0;
      re[j] *= scale;
      im[j] *= scale;
      if (j > 0 && j < fftSize / 2) {
        re[fftSize - j] = re[j];
        im[fftSize - j] = -im[j];
      }
    }

    ifft(re, im);

    for (let j = 0; j < fftSize; j++) {
      if (start + j < length) {
        output[start + j] += re[j] * window[j];
        windowSum[start + j] += window[j] * window[j];
      }
    }
  }

  for (let i = 0; i < length; i++) {
    if (windowSum[i] > 0.01) {
      output[i] /= windowSum[i];
    }
  }

  return output;
};

const MORSE_TABLE: Record<string, string> = {
  ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
  "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
  "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
  ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
  "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
  "--..": "Z", "-----": "0", ".----": "1", "..---": "2", "...--": "3",
  "....-": "4", ".....": "5", "-....": "6", "--...": "7", "---..": "8",
  "----.": "9", ".-.-.-": ".", "--..--": ",", "---...": ":", "..--..": "?",
  ".----.": "'", "-....-": "-", "-..-.": "/", "-.--.": "(", "-.--.-": ")",
  "..--.-": "_", ".-..-.": "\"", ".--.-.": "@", "-...-": "="
};

export const detectMorse = (channelData: Float32Array, sampleRate: number): string | null => {
  const length = channelData.length;
  if (length < 1024) return null;

  // 1. Copy and normalize channel data so peak amplitude is 1.0 for scale-independent detection
  const normalizedData = new Float32Array(length);
  let peakAbs = 0;
  for (let i = 0; i < length; i++) {
    const val = Math.abs(channelData[i]);
    normalizedData[i] = channelData[i];
    if (val > peakAbs) peakAbs = val;
  }
  if (peakAbs > 0.001) {
    for (let i = 0; i < length; i++) {
      normalizedData[i] /= peakAbs;
    }
  }

  // Helper Goertzel function to find power at specific frequency
  const goertzelPower = (samples: Float32Array, targetFreq: number, sRate: number): number => {
    const N = samples.length;
    const k = Math.round((N * targetFreq) / sRate);
    const omega = (2 * Math.PI * k) / N;
    const coeff = 2 * Math.cos(omega);
    let q0 = 0, q1 = 0, q2 = 0;
    for (let i = 0; i < N; i++) {
      q0 = samples[i] + coeff * q1 - q2;
      q2 = q1;
      q1 = q0;
    }
    const real = q1 - q2 * Math.cos(omega);
    const imag = q2 * Math.sin(omega);
    return real * real + imag * imag;
  };

  // 2. Robust Carrier Detection
  const blockSize = 2048;
  const numBlocks = Math.floor(length / blockSize);
  let bestBlockIndex = 0;
  let maxRMS = 0;

  for (let b = 0; b < numBlocks; b++) {
    let sum = 0;
    const start = b * blockSize;
    for (let i = 0; i < blockSize; i++) {
      const val = normalizedData[start + i] || 0;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / blockSize);
    if (rms > maxRMS) {
      maxRMS = rms;
      bestBlockIndex = b;
    }
  }

  const loudestBlock = normalizedData.subarray(bestBlockIndex * blockSize, (bestBlockIndex + 1) * blockSize);

  // Sweep from 300 Hz to 2500 Hz with high resolution
  let bestCoarseFreq = 800;
  let maxCoarsePower = 0;
  let sumCoarsePowers = 0;
  const coarseStep = 15;
  let coarseCount = 0;

  for (let freq = 300; freq <= 2500; freq += coarseStep) {
    const p = goertzelPower(loudestBlock, freq, sampleRate);
    sumCoarsePowers += p;
    coarseCount++;
    if (p > maxCoarsePower) {
      maxCoarsePower = p;
      bestCoarseFreq = freq;
    }
  }

  const avgCoarsePower = sumCoarsePowers / coarseCount;
  let carrierFreq = bestCoarseFreq;
  let isTonal = false;

  // SNR check and Anti-Harmonic filtering
  if (maxCoarsePower > 4.0 * avgCoarsePower && maxCoarsePower > 0.005) {
    isTonal = true;
    
    // Check if peak is a harmonic of a lower frequency
    for (const divisor of [2, 3]) {
      const subFreq = bestCoarseFreq / divisor;
      if (subFreq >= 300) {
        const subPower = goertzelPower(loudestBlock, subFreq, sampleRate);
        if (subPower > maxCoarsePower * 0.4) {
          bestCoarseFreq = subFreq;
          break;
        }
      }
    }

    // Fine-tuning peak
    let maxFinePower = 0;
    for (let freq = bestCoarseFreq - 20; freq <= bestCoarseFreq + 20; freq += 2) {
      const p = goertzelPower(loudestBlock, freq, sampleRate);
      if (p > maxFinePower) {
        maxFinePower = p;
        carrierFreq = freq;
      }
    }
  }

  // 3. Envelope Extraction with Hysteresis Thresholding
  // Block size of ~12 ms for better temporal resolution
  const envBlockSize = Math.max(128, Math.floor(sampleRate * 0.012)) || 512;
  const envNumBlocks = Math.floor(length / envBlockSize);
  if (envNumBlocks < 10) return null;

  const envelope = new Float32Array(envNumBlocks);
  let maxEnvVal = 0;

  for (let b = 0; b < envNumBlocks; b++) {
    const chunk = normalizedData.subarray(b * envBlockSize, (b + 1) * envBlockSize);
    let val = 0;
    if (isTonal) {
      val = goertzelPower(chunk, carrierFreq, sampleRate);
    } else {
      let sum = 0;
      for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
      val = Math.sqrt(sum / (chunk.length || 1));
    }
    envelope[b] = val;
    if (val > maxEnvVal) maxEnvVal = val;
  }

  if (maxEnvVal < 0.0001) return null;

  // Find noise floor
  const sortedEnv = [...envelope].sort((a, b) => a - b);
  const noiseFloor = sortedEnv[Math.floor(sortedEnv.length * 0.15)] || 0;
  const signalRange = maxEnvVal - noiseFloor;

  // Hysteresis (Schmitt Trigger) levels
  const highThreshold = noiseFloor + signalRange * (isTonal ? 0.25 : 0.40);
  const lowThreshold = noiseFloor + signalRange * (isTonal ? 0.10 : 0.20);

  // 4. Binary State Conversion with Hysteresis to prevent chatter
  const smoothedStates = new Uint8Array(envNumBlocks);
  let currentState = 0;
  for (let i = 0; i < envNumBlocks; i++) {
    if (envelope[i] > highThreshold) currentState = 1;
    else if (envelope[i] < lowThreshold) currentState = 0;
    smoothedStates[i] = currentState;
  }

  // 5. Measure runs of alternating ON and OFF
  const runs: { type: "on" | "off"; duration: number }[] = [];
  let currentType: "on" | "off" = smoothedStates[0] === 1 ? "on" : "off";
  let currentLen = 1;

  for (let i = 1; i < envNumBlocks; i++) {
    const type: "on" | "off" = smoothedStates[i] === 1 ? "on" : "off";
    if (type === currentType) {
      currentLen++;
    } else {
      runs.push({ type: currentType, duration: currentLen });
      currentType = type;
      currentLen = 1;
    }
  }
  runs.push({ type: currentType, duration: currentLen });

  // Get all ON durations to estimate dot vs dash
  const onDurations = runs.filter(r => r.type === "on").map(r => r.duration).sort((a, b) => a - b);
  if (onDurations.length === 0) return null;

  // Adaptive thresholding based on clustering heuristic
  const dotEstimate = onDurations[Math.floor(onDurations.length * 0.25)] || 5;
  const dashEstimate = onDurations[Math.floor(onDurations.length * 0.75)] || 15;
  
  let dotDashThreshold = dotEstimate * 1.8;
  if (dashEstimate > 1.5 * dotEstimate) {
    dotDashThreshold = (dotEstimate + dashEstimate) / 2;
  }

  // Get middle OFF durations to estimate space between characters and words
  const middleOffRuns = runs.slice(1, -1).filter(r => r.type === "off");
  let charSpaceThreshold = dotDashThreshold * 1.5;
  let wordSpaceThreshold = dotDashThreshold * 3.5;

  if (middleOffRuns.length > 0) {
    const offDurations = middleOffRuns.map(r => r.duration).sort((a, b) => a - b);
    const spaceEstimate = offDurations[Math.floor(offDurations.length * 0.25)] || dotEstimate;
    charSpaceThreshold = Math.max(spaceEstimate * 1.8, dotDashThreshold * 1.2);
    wordSpaceThreshold = Math.max(spaceEstimate * 4.0, dotDashThreshold * 2.8);
  }

  // 6. Decode the runs into characters
  let decodedText = "";
  let currentMorseChar = "";

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (run.type === "on") {
      if (run.duration >= dotDashThreshold) {
        currentMorseChar += "-";
      } else {
        currentMorseChar += ".";
      }
    } else {
      // This is a space run
      if (run.duration >= wordSpaceThreshold) {
        if (currentMorseChar) {
          const char = MORSE_TABLE[currentMorseChar] || "";
          decodedText += char;
          currentMorseChar = "";
        }
        if (decodedText && !decodedText.endsWith(" ")) {
          decodedText += " ";
        }
      } else if (run.duration >= charSpaceThreshold) {
        if (currentMorseChar) {
          const char = MORSE_TABLE[currentMorseChar] || "";
          decodedText += char;
          currentMorseChar = "";
        }
      }
    }
  }

  // Append any trailing character
  if (currentMorseChar) {
    const char = MORSE_TABLE[currentMorseChar] || "";
    decodedText += char;
  }

  decodedText = decodedText.trim();
  const validChars = decodedText.replace(/\?/g, "").trim();
  
  if (validChars.length === 0) {
    return null;
  }

  return decodedText;
};

export const detectDTMF = (channelData: Float32Array, sampleRate: number): string | null => {
  const rowFreqs = [697, 770, 852, 941];
  const colFreqs = [1209, 1336, 1477, 1633];

  const DTMF_MAP: Record<string, string> = {
    "697,1209": "1", "697,1336": "2", "697,1477": "3", "697,1633": "A",
    "770,1209": "4", "770,1336": "5", "770,1477": "6", "770,1633": "B",
    "852,1209": "7", "852,1336": "8", "852,1477": "9", "852,1633": "C",
    "941,1209": "*", "941,1336": "0", "941,1477": "#", "941,1633": "D"
  };

  const getGoertzelPower = (samples: Float32Array, targetFreq: number, sRate: number): number => {
    const N = samples.length;
    const k = Math.round((N * targetFreq) / sRate);
    const omega = (2 * Math.PI * k) / N;
    const coeff = 2 * Math.cos(omega);
    
    let q0 = 0;
    let q1 = 0;
    let q2 = 0;
    
    for (let i = 0; i < N; i++) {
      q0 = samples[i] + coeff * q1 - q2;
      q2 = q1;
      q1 = q0;
    }
    
    const real = q1 - q2 * Math.cos(omega);
    const imag = q2 * Math.sin(omega);
    return real * real + imag * imag;
  };

  const windowSize = 1024;
  const stepSize = 512;
  const length = channelData.length;
  const numSteps = Math.floor((length - windowSize) / stepSize);

  if (numSteps <= 0) return null;

  const windowDigits: (string | null)[] = [];

  for (let s = 0; s < numSteps; s++) {
    const start = s * stepSize;
    const chunk = channelData.subarray(start, start + windowSize);

    const rPowers = rowFreqs.map(f => getGoertzelPower(chunk, f, sampleRate));
    const cPowers = colFreqs.map(f => getGoertzelPower(chunk, f, sampleRate));

    let maxRowIdx = 0;
    let maxRowPower = rPowers[0];
    for (let i = 1; i < rPowers.length; i++) {
      if (rPowers[i] > maxRowPower) {
        maxRowPower = rPowers[i];
        maxRowIdx = i;
      }
    }

    let maxColIdx = 0;
    let maxColPower = cPowers[0];
    for (let i = 1; i < cPowers.length; i++) {
      if (cPowers[i] > maxColPower) {
        maxColPower = cPowers[i];
        maxColIdx = i;
      }
    }

    const validatePeak = (powers: number[], peakIdx: number, threshold: number): boolean => {
      const peakPower = powers[peakIdx];
      if (peakPower < threshold) return false;
      for (let i = 0; i < powers.length; i++) {
        if (i !== peakIdx && peakPower < powers[i] * 2.0) {
          return false;
        }
      }
      return true;
    };

    const isValidRow = validatePeak(rPowers, maxRowIdx, 0.005);
    const isValidCol = validatePeak(cPowers, maxColIdx, 0.005);

    if (isValidRow && isValidCol) {
      const rowFreq = rowFreqs[maxRowIdx];
      const colFreq = colFreqs[maxColIdx];
      const digit = DTMF_MAP[`${rowFreq},${colFreq}`];
      windowDigits.push(digit || null);
    } else {
      windowDigits.push(null);
    }
  }

  let currentDigit: string | null = null;
  let digitCount = 0;
  const detectedTones: string[] = [];

  for (const digit of windowDigits) {
    if (digit === currentDigit) {
      if (digit !== null) {
        digitCount++;
      }
    } else {
      if (currentDigit !== null && digitCount >= 2) {
        detectedTones.push(currentDigit);
      }
      currentDigit = digit;
      digitCount = digit !== null ? 1 : 0;
    }
  }
  if (currentDigit !== null && digitCount >= 2) {
    detectedTones.push(currentDigit);
  }

  if (detectedTones.length === 0) return null;

  return detectedTones.join(" - ");
};
