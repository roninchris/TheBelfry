import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  FileAudio,
  Radio,
  Sliders,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Compass,
  Activity,
  Award,
  Disc,
  Mic,
  Trash2,
  Check
} from "lucide-react";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import ProgressBar from "../../components/ui/ProgressBar";
import { motion, useReducedMotion } from "motion/react";
import DecryptText from "../../components/ui/DecryptText";
import CorrelationNetwork from "../../components/ui/CorrelationNetwork";
import LiveWaveformBars from "../../components/react-bits/LiveWaveformBars";
import {
  playSuccessChime,
  playPinClick,
  playHoverBlip,
  playHoverEvidence,
  playFileAnalysisComplete,
  playAudioForensicsScan,
  playScanOpen,
  playOpenAudioSteganography,
  playBinaryScanLoop,
  getAudioContext
} from "../../lib/soundEngine";
import { useAppStore } from "../../store/appStore";
import { detectMorse, detectDTMF, applySpectralSubtraction } from "../../lib/audioAnalysis";
import { parseMidiFile, noteNumberToName } from "../../lib/tools/audio-analysis/midiDecoder";
import { themeColor, themeRgba } from "../../lib/themeColors";

interface AudioSample {
  id: string;
  name: string;
  type: "morse" | "reversed" | "dtmf" | "noise";
  fileSize: string;
  duration: number; // in seconds
  format: string;
  bitrate: string;
  spectralCentroid: string;
  rmsEnergy: string;
  zeroCrossing: string;
  badgeLabel: string;
  revealedSecret: string;
  analysisSummary: string;
}

const TACTICAL_AUDIO_SAMPLES: AudioSample[] = [];

// In-memory SMF MIDI file generator for the forensic beacon preset
const generateForensicMidiBuffer = (): ArrayBuffer => {
  const bytes = new Uint8Array([
    // MThd Header Chunk
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // chunk size (6)
    0x00, 0x01,             // format 1
    0x00, 0x02,             // 2 tracks
    0x01, 0xE0,             // 480 ticks per quarter note

    // Track 1: Tempo / Metadata
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    0x00, 0x00, 0x00, 0x24, // track length (36 bytes)
    0x00, 0xFF, 0x03, 0x0B, // Track Name
    0x54, 0x45, 0x4D, 0x50, 0x4F, 0x5F, 0x54, 0x52, 0x41, 0x43, 0x4B, // "TEMPO_TRACK"
    0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20, // Tempo: 120 BPM (500000 ms per beat)
    0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, // Time signature 4/4
    0x00, 0xFF, 0x2F, 0x00, // End of Track

    // Track 2: Forensic Notes
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    0x00, 0x00, 0x00, 0x3F, // track length (63 bytes)
    0x00, 0xFF, 0x03, 0x13, // Track Name
    0x43, 0x4F, 0x44, 0x45, 0x5F, 0x42, 0x45, 0x41, 0x43, 0x4F, 0x4E, 0x5F, 0x53, 0x49, 0x47, 0x4E, 0x41, 0x4C, 0x53, // "CODE_BEACON_SIGNALS"
    0x00, 0x90, 0x3C, 0x60, // Note On C4 (60), Velocity 96
    0x81, 0x70, 0x3C, 0x00, // Delta 240 (half beat), Note Off C4
    0x00, 0x90, 0x40, 0x60, // Note On E4 (64), Velocity 96
    0x81, 0x70, 0x40, 0x00, // Delta 240, Note Off E4
    0x00, 0x90, 0x43, 0x60, // Note On G4 (67), Velocity 96
    0x81, 0x70, 0x43, 0x00, // Delta 240, Note Off G4
    0x00, 0x90, 0x48, 0x60, // Note On C5 (72), Velocity 96
    0x83, 0x60, 0x48, 0x00, // Delta 480 (one beat), Note Off C5
    0x00, 0xFF, 0x2F, 0x00  // End of Track
  ]);
  return bytes.buffer;
};

interface VUMeterProps {
  active: boolean;
  value: number;
  isPlaying: boolean;
}

function VUMeter({ active, value, isPlaying }: VUMeterProps) {
  const segmentCount = 15;
  const [bounce, setBounce] = useState(0);

  useEffect(() => {
    if (active && isPlaying) {
      const interval = setInterval(() => {
        setBounce(Math.floor(Math.random() * 3) - 1); // -1, 0, or 1 segment fluctuation
      }, 100);
      return () => clearInterval(interval);
    } else {
      setBounce(0);
    }
  }, [active, isPlaying]);

  const litSegments = active 
    ? Math.max(0, Math.min(segmentCount, Math.round((value / 100) * segmentCount) + bounce)) 
    : 0;
  
  return (
    <div className="flex space-x-[2px] items-center h-3 w-full bg-bg-void/60 px-1 py-0.5 border border-border-hairline/10 rounded-sm">
      {[...Array(segmentCount)].map((_, idx) => {
        const isLit = idx < litSegments;
        let colorClass = "bg-[var(--color-accent-primary)]/5"; // unlit cyan
        if (isLit) {
          if (idx < 10) {
            colorClass = "bg-cyan-primary shadow-[0_0_5px_rgb(var(--rgb-accent) / 0.8)]"; // cyan normal
          } else if (idx < 13) {
            colorClass = "bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)]"; // amber caution
          } else {
            colorClass = "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]"; // red peak
          }
        }
        return (
          <div 
            key={idx} 
            className={`h-full flex-1 transition-all duration-150 ${colorClass}`}
          />
        );
      })}
    </div>
  );
}


const generateMorseAudio = (text: string, sampleRate: number, duration: number): AudioBuffer => {
  const ctx = getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  const dotLen = Math.floor(sampleRate * 0.08);
  const dashLen = dotLen * 3;
  const symbolSpace = dotLen;
  const charSpace = dotLen * 3;
  const wordSpace = dotLen * 7;

  let currentSampleIdx = Math.floor(sampleRate * 0.5); // start with 0.5s silence

  const morseMap: Record<string, string> = {
    'S': '...', 'O': '---', 'A': '.-', 'R': '.-.', 'K': '-.-', 'H': '....', 'M': '--', 'E': '.', 'C': '-.-.', 'T': '-', '9': '----.'
  };

  const frequency = 1200; // 1.2 kHz

  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase();
    if (char === ' ') {
      currentSampleIdx += wordSpace;
      continue;
    }
    const code = morseMap[char];
    if (!code) continue;

    for (let j = 0; j < code.length; j++) {
      const symbol = code[j];
      const len = symbol === '.' ? dotLen : dashLen;
      // Fill sine wave
      for (let s = 0; s < len; s++) {
        const idx = currentSampleIdx + s;
        if (idx < totalSamples) {
          // Add some fade-in and fade-out to prevent clicks and help envelope detection
          let envelope = 1;
          if (s < 100) envelope = s / 100;
          if (s > len - 100) envelope = (len - s) / 100;
          data[idx] = envelope * Math.sin(2 * Math.PI * frequency * (idx / sampleRate));
        }
      }
      currentSampleIdx += len;
      if (j < code.length - 1) {
        currentSampleIdx += symbolSpace;
      }
    }
    currentSampleIdx += charSpace;
  }

  // Add some background ambient noise to make it realistic and nice
  for (let i = 0; i < totalSamples; i++) {
    data[i] = data[i] * 0.7 + (Math.random() - 0.5) * 0.02;
  }

  return buffer;
};

const generateDTMFAudio = (digits: string[], sampleRate: number, duration: number): AudioBuffer => {
  const ctx = getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  const digitDuration = 0.5; // 500ms tone
  const silenceDuration = 0.4; // 400ms pause

  const DTMF_FREQS: Record<string, [number, number]> = {
    "1": [697, 1209], "2": [697, 1336], "3": [697, 1477], "A": [697, 1633],
    "4": [770, 1209], "5": [770, 1336], "6": [770, 1477], "B": [770, 1633],
    "7": [852, 1209], "8": [852, 1336], "9": [852, 1477], "C": [852, 1633],
    "*": [941, 1209], "0": [941, 1336], "#": [941, 1477], "D": [941, 1633]
  };

  let currentSampleIdx = Math.floor(sampleRate * 0.5); // start with 0.5s silence

  for (const digit of digits) {
    const freqs = DTMF_FREQS[digit];
    if (!freqs) continue;

    const [f1, f2] = freqs;
    const len = Math.floor(sampleRate * digitDuration);

    for (let s = 0; s < len; s++) {
      const idx = currentSampleIdx + s;
      if (idx < totalSamples) {
        // Fade envelope
        let envelope = 1;
        if (s < 200) envelope = s / 200;
        if (s > len - 200) envelope = (len - s) / 200;

        const val = 0.5 * (Math.sin(2 * Math.PI * f1 * (idx / sampleRate)) + Math.sin(2 * Math.PI * f2 * (idx / sampleRate)));
        data[idx] = envelope * val;
      }
    }
    currentSampleIdx += len + Math.floor(sampleRate * silenceDuration);
  }

  // Add subtle background hiss
  for (let i = 0; i < totalSamples; i++) {
    data[i] = data[i] * 0.8 + (Math.random() - 0.5) * 0.015;
  }

  return buffer;
};

const generateAsylumAudio = (sampleRate: number, duration: number): AudioBuffer => {
  const ctx = getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Synthesize creepy swept vocal formants
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Creepy low frequency hum
    const f0 = 110 + 10 * Math.sin(2 * Math.PI * 0.5 * t);
    // Vowel-like formants: sweeping frequencies
    const f1 = 400 + 150 * Math.sin(2 * Math.PI * 0.2 * t + 1);
    const f2 = 1200 + 400 * Math.cos(2 * Math.PI * 0.3 * t);
    const f3 = 2500 + 800 * Math.sin(2 * Math.PI * 0.1 * t);

    // Modulator to simulate syllables (speech envelopment)
    const ampEnv = 0.3 * (
      Math.sin(2 * Math.PI * 1.5 * t) * Math.sin(2 * Math.PI * 0.4 * t) + 
      0.5 * Math.sin(2 * Math.PI * 4.0 * t)
    );
    const envelope = Math.max(0, ampEnv);

    const val = 0.4 * Math.sin(2 * Math.PI * f0 * t) +
                0.3 * Math.sin(2 * Math.PI * f1 * t) +
                0.2 * Math.sin(2 * Math.PI * f2 * t) +
                0.1 * Math.sin(2 * Math.PI * f3 * t);

    data[i] = envelope * val;
  }

  // Creepy reversed echoes
  const echoData = new Float32Array(totalSamples);
  const delaySamples = Math.floor(sampleRate * 0.3);
  for (let i = delaySamples; i < totalSamples; i++) {
    echoData[i] = data[i] + 0.4 * data[i - delaySamples];
  }

  // Add noise floor
  for (let i = 0; i < totalSamples; i++) {
    data[i] = echoData[i] * 0.8 + (Math.random() - 0.5) * 0.02;
  }

  return buffer;
};

const generateSewerAudio = (sampleRate: number, duration: number): AudioBuffer => {
  const ctx = getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
  const totalSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const white = Math.random() * 2 - 1;
    // Brown noise filter (integrator)
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    
    // Industrial machinery hum: low frequency 60 Hz hum with harmonics
    const hum = 0.08 * Math.sin(2 * Math.PI * 60 * t) +
                0.03 * Math.sin(2 * Math.PI * 180 * t) +
                0.01 * Math.sin(2 * Math.PI * 300 * t);
                
    // Low frequency modulation of the noise to simulate turbine blades rotating
    const blades = 1.0 + 0.3 * Math.sin(2 * Math.PI * 1.8 * t);
    
    data[i] = (data[i] * 4.0 * blades) + hum;
  }

  return buffer;
};

export default function AudioForensicsLab() {
  const shouldReduceMotion = useReducedMotion();
  const cases = useAppStore((state) => state.cases);
  const activeCaseId = useAppStore((state) => state.activeCaseId);
  const addEvidenceNode = useAppStore((state) => state.addEvidenceNode);
  const addLog = useAppStore((state) => state.addLog);
  const setModule = useAppStore((state) => state.setModule);

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isReversed, setIsReversed] = useState(false);
  const scanSoundRef = useRef<{ stop: () => void } | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scanning engine states
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanningMessage, setScanningMessage] = useState("");
  const [scanComplete, setScanComplete] = useState(false); // Starts false, scanning required

  // Sound lifecycle for scanning
  useEffect(() => {
    if (isScanning) {
      if (!scanSoundRef.current) {
        scanSoundRef.current = playBinaryScanLoop();
      }
    } else {
      if (scanSoundRef.current) {
        scanSoundRef.current.stop();
        scanSoundRef.current = null;
      }
    }
    return () => {
      if (scanSoundRef.current) {
        scanSoundRef.current.stop();
        scanSoundRef.current = null;
      }
    };
  }, [isScanning]);

  const [activeTab, setActiveTab] = useState<"waveform" | "spectrogram" | "midi">("waveform");
  const [parsedMidi, setParsedMidi] = useState<any | null>(null);
  const [midiFileName, setMidiFileName] = useState<string>("");
  const [noiseReductionEnabled, setNoiseReductionEnabled] = useState(false);
  const [lsbPayload, setLsbPayload] = useState<string | null>(null);

  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Drag & Drop
  const [dragActive, setDragActive] = useState(false);

  // Real Web Audio API state
  const [decodedBuffer, setDecodedBuffer] = useState<AudioBuffer | null>(null);
  const [decodedMetadata, setDecodedMetadata] = useState<{
    duration: number;
    format: string;
    bitrate: string;
    spectralCentroid: string;
    rmsEnergy: string;
    zeroCrossing: string;
    revealedSecret: string;
    analysisSummary: string;
    badgeLabel: string;
    type: "morse" | "reversed" | "dtmf" | "noise";
  } | null>(null);

  // Precompute waveform peaks for real file drawing
  const waveformPeaks = useMemo(() => {
    if (!decodedBuffer) return null;
    const channelData = decodedBuffer.getChannelData(0);
    const length = channelData.length;
    const width = 1000; // Canvas width
    const step = length / width;
    
    const maxPeaks = new Float32Array(width);
    const minPeaks = new Float32Array(width);
    const rmsPeaks = new Float32Array(width);

    for (let i = 0; i < width; i++) {
      const start = Math.floor(i * step);
      const end = Math.min(Math.floor((i + 1) * step), length);
      
      let maxVal = -1.0;
      let minVal = 1.0;
      let sumSquares = 0;
      
      for (let j = start; j < end; j++) {
        const val = channelData[j];
        if (val > maxVal) maxVal = val;
        if (val < minVal) minVal = val;
        sumSquares += val * val;
      }
      
      maxPeaks[i] = maxVal === -1.0 ? 0 : maxVal;
      minPeaks[i] = minVal === 1.0 ? 0 : minVal;
      rmsPeaks[i] = Math.sqrt(sumSquares / (end - start || 1));
    }

    return { max: maxPeaks, min: minPeaks, rms: rmsPeaks };
  }, [decodedBuffer]);

  // Precompute real windowed Cooley-Tukey Radix-2 FFT spectrogram data for real file drawing
  const spectrogramData = useMemo(() => {
    if (!decodedBuffer) return null;
    const channelData = decodedBuffer.getChannelData(0);
    const length = channelData.length;
    const width = 1000;
    const fftSize = 512;
    
    const data = [];
    
    // Hann Window setup
    const windowValues = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      windowValues[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // Precompute bit reversal table
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

    // Cooley-Tukey Radix-2 FFT algorithm
    const runFFT = (chunk: Float32Array): Float32Array => {
      const rTemp = new Float32Array(fftSize);
      const iTemp = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        rTemp[i] = chunk[reverseTable[i]] * windowValues[reverseTable[i]];
        iTemp[i] = 0;
      }
      let halfSize = 1;
      while (halfSize < fftSize) {
        const phaseShiftReal = Math.cos(-Math.PI / halfSize);
        const phaseShiftImag = Math.sin(-Math.PI / halfSize);
        let currReal = 1, currImag = 0;
        for (let step = 0; step < halfSize; step++) {
          let i = step;
          while (i < fftSize) {
            const off = i + halfSize;
            const tr = currReal * rTemp[off] - currImag * iTemp[off];
            const ti = currReal * iTemp[off] + currImag * rTemp[off];
            rTemp[off] = rTemp[i] - tr;
            iTemp[off] = iTemp[i] - ti;
            rTemp[i] += tr;
            iTemp[i] += ti;
            i += halfSize << 1;
          }
          const tmp = currReal;
          currReal = tmp * phaseShiftReal - currImag * phaseShiftImag;
          currImag = tmp * phaseShiftImag + currImag * phaseShiftReal;
        }
        halfSize = halfSize << 1;
      }
      const mag = new Float32Array(fftSize / 2);
      const scale = 2 / fftSize;
      for (let i = 0; i < fftSize / 2; i++) {
        mag[i] = scale * Math.sqrt(rTemp[i] * rTemp[i] + iTemp[i] * iTemp[i]);
      }
      return mag;
    };

    // Extract real spectra across width steps
    for (let x = 0; x < width; x++) {
      const centerSample = Math.floor((x / width) * length);
      const start = Math.max(0, centerSample - fftSize / 2);
      const end = start + fftSize;
      
      const chunk = new Float32Array(fftSize);
      if (end <= length) {
        chunk.set(channelData.subarray(start, end));
      } else {
        chunk.set(channelData.subarray(start, length));
      }
      
      const mag = runFFT(chunk);
      data.push(mag);
    }
    
    return data;
  }, [decodedBuffer]);

  const currentSample = useMemo(() => {
    if (selectedSampleId) {
      return TACTICAL_AUDIO_SAMPLES.find(s => s.id === selectedSampleId) || null;
    }
    if (activeFile) {
      if (activeFile.name.toLowerCase().endsWith(".mid") || activeFile.name.toLowerCase().endsWith(".midi")) {
        return {
          id: "uploaded-midi",
          name: activeFile.name,
          type: "noise" as const,
          fileSize: `${(activeFile.size / 1024).toFixed(1)} KB`,
          duration: parsedMidi ? (parsedMidi.events.length * 0.1) : 10.0,
          format: "SMF (MThd Track)",
          bitrate: "--",
          spectralCentroid: "N/A (MIDI)",
          rmsEnergy: "N/A (MIDI)",
          zeroCrossing: "N/A (MIDI)",
          badgeLabel: "STANDARD MIDI FILE CHUNKS",
          revealedSecret: parsedMidi ? `MIDI METADATA: Format ${parsedMidi.header.format}, Tracks: ${parsedMidi.header.numTracks}, Events: ${parsedMidi.events.length}` : "Awaiting decode...",
          analysisSummary: parsedMidi 
            ? `MIDI binary parse complete. Verified Standard MIDI File (SMF) format ${parsedMidi.header.format} header chunk. Analyzed ${parsedMidi.header.numTracks} track channels. Total event count: ${parsedMidi.events.length}.`
            : "Analyzing MIDI file chunk headers..."
        };
      }
      return {
        id: "uploaded-file",
        name: activeFile.name,
        type: decodedMetadata ? decodedMetadata.type : ("noise" as const),
        fileSize: `${(activeFile.size / 1024).toFixed(0)} KB`,
        duration: decodedMetadata ? decodedMetadata.duration : 15.0,
        format: decodedMetadata ? decodedMetadata.format : (activeFile.type.replace("audio/", "").toUpperCase() || "WAV"),
        bitrate: decodedMetadata ? decodedMetadata.bitrate : "320 kbps",
        spectralCentroid: decodedMetadata ? decodedMetadata.spectralCentroid : "Calculating...",
        rmsEnergy: decodedMetadata ? decodedMetadata.rmsEnergy : "Calculating...",
        zeroCrossing: decodedMetadata ? decodedMetadata.zeroCrossing : "Calculating...",
        badgeLabel: decodedMetadata ? decodedMetadata.badgeLabel : "ANALYZED UPLOAD CAPTURE",
        revealedSecret: decodedMetadata ? decodedMetadata.revealedSecret : "RECOVERED CARRIER SIGNAL: 'SECURE_NET_TRANS_OK'",
        analysisSummary: decodedMetadata ? decodedMetadata.analysisSummary : "Custom audio file analysis. Embedded data detected in spectral bins: SECURE_NET_TRANS_OK. Signal characteristics match secure radio-link standards."
      };
    }
    return null;
  }, [selectedSampleId, activeFile, decodedMetadata, parsedMidi]);

  // Handle playing simulation
  useEffect(() => {
    if (isPlaying && currentSample) {
      const step = 0.05 * playbackSpeed;
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          let next = prev + (isReversed ? -step : step);
          if (isReversed ? next <= 0 : next >= currentSample.duration) {
            // Can not call setIsPlaying inside a state updater!
            // We use setTimeout to queue it after render phase.
            setTimeout(() => setIsPlaying(false), 0);
            return isReversed ? 0 : currentSample.duration;
          }
          return next;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isPlaying, currentSample, playbackSpeed, isReversed]);

  // Web Audio Player logic for custom uploads
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const getReversedBuffer = (buffer: AudioBuffer): AudioBuffer => {
    const ctx = getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
    const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const srcData = buffer.getChannelData(c);
      const destData = reversed.getChannelData(c);
      for (let i = 0; i < srcData.length; i++) {
        destData[i] = srcData[srcData.length - 1 - i];
      }
    }
    return reversed;
  };

  const startAudioPlayback = (startTimeSeconds: number) => {
    stopAudioPlayback();
    if (!decodedBuffer) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.playbackRate.value = playbackSpeed;

    if (isReversed) {
      source.buffer = getReversedBuffer(decodedBuffer);
      const D = decodedBuffer.duration;
      const offset = Math.max(0, Math.min(D, D - startTimeSeconds));
      source.connect(ctx.destination);
      source.start(0, offset);
    } else {
      source.buffer = decodedBuffer;
      const offset = Math.max(0, Math.min(decodedBuffer.duration, startTimeSeconds));
      source.connect(ctx.destination);
      source.start(0, offset);
    }

    audioSourceRef.current = source;
  };

  const stopAudioPlayback = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
  };

  // Sync real Web Audio playback with play/pause/reverse state
  useEffect(() => {
    if (isPlaying && decodedBuffer) {
      startAudioPlayback(currentTime);
    } else {
      stopAudioPlayback();
    }
    return () => {
      stopAudioPlayback();
    };
  }, [isPlaying, decodedBuffer, isReversed]);

  // Sync playback speed dynamically during playback
  useEffect(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.playbackRate.value = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Play spectogram load sound when sample becomes available/loads
  useEffect(() => {
    if (currentSample) {
      playOpenAudioSteganography();
    }
  }, [currentSample]);

  // Dynamic waveform & spectrogram canvas rendering loop
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      // Background clean
      ctx.fillStyle = themeColor("--color-bg-void");
      ctx.fillRect(0, 0, width, height);

      // Grid Lines
      ctx.strokeStyle = themeRgba("--rgb-accent", 0.04);
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (!currentSample) {
        // Flatline
        ctx.strokeStyle = themeRgba("--rgb-accent", 0.15);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      if (activeTab === "waveform") {
        if (decodedBuffer && waveformPeaks) {
          // Draw real decoded waveform
          ctx.strokeStyle = themeRgba("--rgb-accent", 0.75);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          
          const maxP = waveformPeaks.max;
          const minP = waveformPeaks.min;
          
          ctx.moveTo(0, height / 2);
          for (let i = 0; i < width; i++) {
            const amp = maxP[i] * (height / 2.2);
            ctx.lineTo(i, height / 2 - amp);
          }
          for (let i = width - 1; i >= 0; i--) {
            const amp = minP[i] * (height / 2.2);
            ctx.lineTo(i, height / 2 - amp);
          }
          ctx.closePath();
          ctx.fillStyle = themeRgba("--rgb-accent", 0.2);
          ctx.fill();
          ctx.stroke();

          // Mirror / shadow bottom fill using RMS peaks
          ctx.strokeStyle = themeRgba("--rgb-accent", 0.25);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          for (let i = 0; i < width; i++) {
            const amp = waveformPeaks.rms[i] * (height / 3);
            ctx.lineTo(i, height / 2 + amp);
          }
          for (let i = width - 1; i >= 0; i--) {
            const amp = -waveformPeaks.rms[i] * (height / 3);
            ctx.lineTo(i, height / 2 + amp);
          }
          ctx.closePath();
          ctx.fillStyle = themeRgba("--rgb-accent", 0.05);
          ctx.fill();
          ctx.stroke();

          // Playhead indicator
          const progressRatio = currentTime / currentSample.duration;
          const playheadX = progressRatio * width;
          ctx.strokeStyle = themeColor("--color-red-threat");
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(playheadX, 0);
          ctx.lineTo(playheadX, height);
          ctx.stroke();

          // Playhead cap/handle
          ctx.fillStyle = themeColor("--color-red-threat");
          ctx.beginPath();
          ctx.moveTo(playheadX - 4, 0);
          ctx.lineTo(playheadX + 4, 0);
          ctx.lineTo(playheadX, 6);
          ctx.closePath();
          ctx.fill();
        } else {
          // Draw Preset Waveform
          ctx.strokeStyle = themeRgba("--rgb-accent", 0.65);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, height / 2);

          const samplePoints = 120;
          const progressRatio = currentTime / currentSample.duration;

          for (let i = 0; i < samplePoints; i++) {
            const x = (i / samplePoints) * width;
            
            // Generate a wave outline depending on the audio type
            let amplitude = 0;
            const normalIndex = i / samplePoints;

            if (currentSample.type === "morse") {
              // Morse clicks (pulsing blocks)
              const morsePattern = Math.sin(normalIndex * 35) > 0.3 ? 0.8 : 0.05;
              amplitude = morsePattern * (Math.sin(normalIndex * Math.PI) * 28);
            } else if (currentSample.type === "reversed") {
              // Echoey reverse vocal shapes (gradually rising in tail)
              const rise = Math.pow(normalIndex, 2.5) * 20;
              amplitude = (Math.sin(normalIndex * 80) * Math.cos(normalIndex * 15)) * rise;
            } else if (currentSample.type === "dtmf") {
              // Double sine wave patterns (dual tone)
              amplitude = (Math.sin(normalIndex * 120) * 12 + Math.sin(normalIndex * 85) * 12) * Math.sin(normalIndex * Math.PI);
            } else {
              // Smooth noise/ambience
              amplitude = (Math.random() - 0.5) * 18 * Math.sin(normalIndex * Math.PI);
            }

            // Add dynamic live animation ripple if playing
            if (isPlaying && x <= progressRatio * width && x >= progressRatio * width - 40) {
              amplitude *= 1.4 + Math.random() * 0.4;
            }

            ctx.lineTo(x, height / 2 + amplitude);
          }
          ctx.stroke();

          // Mirror / shadow bottom fill
          ctx.strokeStyle = themeRgba("--rgb-accent", 0.15);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          for (let i = 0; i < samplePoints; i++) {
            const x = (i / samplePoints) * width;
            const normalIndex = i / samplePoints;
            let amplitude = 0;
            if (currentSample.type === "morse") {
              amplitude = (Math.sin(normalIndex * 35) > 0.3 ? 0.8 : 0.05) * (Math.sin(normalIndex * Math.PI) * 15);
            } else if (currentSample.type === "reversed") {
              amplitude = (Math.sin(normalIndex * 80) * Math.cos(normalIndex * 15)) * Math.pow(normalIndex, 2.5) * 10;
            } else {
              amplitude = (Math.random() - 0.5) * 8;
            }
            ctx.lineTo(x, height / 2 - amplitude);
          }
          ctx.stroke();

          // Playhead indicator
          const playheadX = progressRatio * width;
          ctx.strokeStyle = themeColor("--color-red-threat");
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(playheadX, 0);
          ctx.lineTo(playheadX, height);
          ctx.stroke();

          // Playhead cap/handle
          ctx.fillStyle = themeColor("--color-red-threat");
          ctx.beginPath();
          ctx.moveTo(playheadX - 4, 0);
          ctx.lineTo(playheadX + 4, 0);
          ctx.lineTo(playheadX, 6);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        if (decodedBuffer && spectrogramData) {
          // Draw real decoded spectrogram - map every FFT bin to its own pixel
          // row (instead of interpolating between a handful of gradient stops)
          // so fine detail - e.g. an image hidden in the spectrogram - is
          // actually visible rather than smeared into soft blobs.
          const progressRatio = currentTime / currentSample.duration;
          const scanLineX = progressRatio * width;

          const numBins = spectrogramData[0]?.length || 0;
          if (numBins > 0) {
            const imageData = ctx.createImageData(width, height);
            const pixels = imageData.data;

            // Usable bin range: skip the very top (usually silent/noise-only)
            const usableBins = Math.max(1, Math.floor(numBins * 0.9));

            for (let x = 0; x < width; x++) {
              const spectrum = spectrogramData[x];
              if (!spectrum) continue;

              for (let y = 0; y < height; y++) {
                // y = 0 is the top of the canvas = highest frequency
                const binRatio = 1 - y / (height - 1 || 1);
                const binIndex = Math.min(usableBins - 1, Math.floor(binRatio * usableBins));
                const mag = spectrum[binIndex] || 0;
                const intensity = Math.min(1.0, mag * 22.0); // Amplified for display

                let r = 2, g = 9, b = 18, a = 0.9;
                if (intensity > 0.8) {
                  r = 255;
                  g = Math.floor(200 + 55 * (intensity - 0.8) / 0.2);
                  b = 100;
                  a = 0.95;
                } else if (intensity > 0.4) {
                  const ratio = (intensity - 0.4) / 0.4;
                  r = Math.floor(150 + 105 * ratio);
                  g = 59;
                  b = 78;
                  a = 0.9;
                } else if (intensity > 0.05) {
                  r = 47; g = 241; b = 228;
                  a = 0.15 + 0.65 * (intensity - 0.05) / 0.35;
                } else {
                  r = 47; g = 241; b = 228;
                  a = intensity * 2;
                }

                const idx = (y * width + x) * 4;
                pixels[idx] = r;
                pixels[idx + 1] = g;
                pixels[idx + 2] = b;
                pixels[idx + 3] = Math.round(Math.min(1, a) * 255);
              }
            }

            ctx.putImageData(imageData, 0, 0);
          }

          // Overlay horizontal frequency guide tags
          ctx.fillStyle = themeRgba("--rgb-accent", 0.6);
          ctx.font = "10px monospace";
          const maxFreq = decodedBuffer.sampleRate / 2;
          ctx.fillText(`${(maxFreq / 1000 * 0.9).toFixed(1)} kHz`, 5, 14);
          ctx.fillText(`${(maxFreq / 1000 * 0.45).toFixed(1)} kHz`, 5, height / 2);
          ctx.fillText("0 Hz", 5, height - 6);

          // Playhead/scanline overlay
          ctx.strokeStyle = themeColor("--color-red-threat");
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(scanLineX, 0);
          ctx.lineTo(scanLineX, height);
          ctx.stroke();
        } else {
          // Draw Preset Spectrogram (Thermal waterfall heat map)
          const progressRatio = currentTime / currentSample.duration;
          const scanLineX = progressRatio * width;

          // Generate colorful vertical columns
          const pixelWidth = 4;
          for (let x = 0; x < width; x += pixelWidth) {
            const ratio = x / width;
            
            // Determine intensity
            let intensity = 0;
            if (currentSample.type === "morse") {
              // Morse has horizontal carrier streaks
              intensity = Math.sin(ratio * 35) > 0.3 ? 0.9 : 0.1;
            } else if (currentSample.type === "reversed") {
              intensity = Math.sin(ratio * 15) * Math.cos(ratio * 35) * 0.8 + 0.2;
            } else if (currentSample.type === "dtmf") {
              // Dual frequency lines
              const line1 = Math.abs(Math.sin(ratio * 120)) > 0.85 ? 1 : 0;
              const line2 = Math.abs(Math.cos(ratio * 90)) > 0.8 ? 0.8 : 0;
              intensity = Math.max(line1, line2);
            } else {
              intensity = Math.random() * 0.4;
            }

            // Draw the column with high-tech heat colors (red to cyan)
            const grad = ctx.createLinearGradient(x, height, x, 0);
            if (intensity > 0.7) {
              grad.addColorStop(0, "rgba(2, 9, 18, 0.8)");
              grad.addColorStop(0.4, themeRgba("--rgb-accent", 0.4));
              grad.addColorStop(0.7, themeRgba("--rgb-threat", 0.85));
              grad.addColorStop(1, "rgba(255, 230, 100, 0.9)");
            } else if (intensity > 0.3) {
              grad.addColorStop(0, "rgba(2, 9, 18, 0.8)");
              grad.addColorStop(0.5, themeRgba("--rgb-accent", 0.15));
              grad.addColorStop(0.9, themeRgba("--rgb-accent", 0.75));
              grad.addColorStop(1, themeRgba("--rgb-threat", 0.3));
            } else {
              grad.addColorStop(0, "rgba(2, 9, 18, 0.9)");
              grad.addColorStop(1, themeRgba("--rgb-accent", 0.12));
            }

            ctx.fillStyle = grad;
            ctx.fillRect(x, 0, pixelWidth, height);
          }

          // Overlay horizontal frequency guide tags
          ctx.fillStyle = themeRgba("--rgb-accent", 0.35);
          ctx.font = "7px monospace";
          ctx.fillText("3.0 kHz", 5, 12);
          ctx.fillText("1.5 kHz", 5, height / 2);
          ctx.fillText("300 Hz", 5, height - 6);

          // Highlight spectral hotspots in red
          if (currentSample.type === "dtmf") {
            ctx.strokeStyle = themeRgba("--rgb-threat", 0.4);
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(0, height * 0.3);
            ctx.lineTo(width, height * 0.3);
            ctx.moveTo(0, height * 0.65);
            ctx.lineTo(width, height * 0.65);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Playhead/scanline overlay
          ctx.strokeStyle = themeColor("--color-red-threat");
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(scanLineX, 0);
          ctx.lineTo(scanLineX, height);
          ctx.stroke();
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentTime, currentSample, isPlaying, activeTab, selectedSampleId, decodedBuffer, waveformPeaks, spectrogramData]);

  // Handle Dragging (page-wide: attached to lab root, not just the upload box)
  const dragCounterRef = useRef(0);
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter") {
      dragCounterRef.current += 1;
      if (e.dataTransfer?.types?.includes("Files")) setDragActive(true);
    } else if (e.type === "dragleave") {
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setDragActive(false);
    } else if (e.type === "dragover") {
      if (e.dataTransfer?.types?.includes("Files")) setDragActive(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".mid") || file.name.toLowerCase().endsWith(".midi")) {
        loadCustomAudio(file);
      } else {
        addLog("INVALID ARTIFACT: CORE TARGET MUST BE A VALID AUDIO FILE CONTAINER", "warning", "SYS");
      }
    }
  };

  const analyzeAudioBuffer = useCallback((audioBuffer: AudioBuffer, fileName: string, fileSize: number, rawBuffer?: ArrayBuffer) => {
    // Apply noise reduction if enabled
    let processingBuffer = audioBuffer;
    if (noiseReductionEnabled) {
      const originalData = audioBuffer.getChannelData(0);
      const reducedData = applySpectralSubtraction(originalData, audioBuffer.sampleRate);
      
      // Create a new buffer with reduced noise for analysis
      const ctx = getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
      const newBuffer = ctx.createBuffer(1, reducedData.length, audioBuffer.sampleRate);
      newBuffer.getChannelData(0).set(reducedData);
      processingBuffer = newBuffer;
    }

    // Extract raw PCM channel data
    const channelData = processingBuffer.getChannelData(0);
    
    // Calculate real RMS Energy
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / (channelData.length || 1));
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -120;
    const rmsEnergyStr = `${rmsDb.toFixed(1)} dB`;

    // Calculate Zero Crossing Rate
    let crossings = 0;
    for (let i = 1; i < channelData.length; i++) {
      if ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0)) {
        crossings++;
      }
    }
    const crossingsPerSecond = crossings / (processingBuffer.duration || 1);
    const zeroCrossingStr = `${Math.round(crossingsPerSecond)} crossings/s`;

    // Approximate Spectral Centroid
    const fftSize = 512;
    let centroidSum = 0;
    let centroidWeightSum = 0;
    
    const windowValues = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      windowValues[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

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

    const localFFT = (chunk: Float32Array): Float32Array => {
      const rTemp = new Float32Array(fftSize);
      const iTemp = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        rTemp[i] = chunk[reverseTable[i]] * windowValues[reverseTable[i]];
        iTemp[i] = 0;
      }
      let halfSize = 1;
      while (halfSize < fftSize) {
        const phaseShiftReal = Math.cos(-Math.PI / halfSize);
        const phaseShiftImag = Math.sin(-Math.PI / halfSize);
        let currReal = 1, currImag = 0;
        for (let step = 0; step < halfSize; step++) {
          let i = step;
          while (i < fftSize) {
            const off = i + halfSize;
            const tr = currReal * rTemp[off] - currImag * iTemp[off];
            const ti = currReal * iTemp[off] + currImag * rTemp[off];
            rTemp[off] = rTemp[i] - tr;
            iTemp[off] = iTemp[i] - ti;
            rTemp[i] += tr;
            iTemp[i] += ti;
            i += halfSize << 1;
          }
          const tmp = currReal;
          currReal = tmp * phaseShiftReal - currImag * phaseShiftImag;
          currImag = tmp * phaseShiftImag + currImag * phaseShiftReal;
        }
        halfSize = halfSize << 1;
      }
      const mag = new Float32Array(fftSize / 2);
      const scale = 2 / fftSize;
      for (let i = 0; i < fftSize / 2; i++) {
        mag[i] = scale * Math.sqrt(rTemp[i] * rTemp[i] + iTemp[i] * iTemp[i]);
      }
      return mag;
    };

    const totalSamples = channelData.length;
    const stepFrames = Math.max(1, Math.floor((totalSamples - fftSize) / 100));
    for (let offset = 0; offset + fftSize <= totalSamples; offset += stepFrames) {
      const chunk = channelData.subarray(offset, offset + fftSize);
      const spectrum = localFFT(chunk);
      let numSum = 0;
      let denSum = 0;
      for (let i = 0; i < spectrum.length; i++) {
        const freq = (i * processingBuffer.sampleRate) / fftSize;
        numSum += freq * spectrum[i];
        denSum += spectrum[i];
      }
      if (denSum > 0.001) {
        centroidSum += numSum / denSum;
        centroidWeightSum++;
      }
    }
    const spectralCentroidVal = centroidWeightSum > 0 ? centroidSum / centroidWeightSum : 1000;
    const spectralCentroidStr = `${Math.round(spectralCentroidVal)} Hz`;

    // Run Morse detection
    const morseResult = detectMorse(channelData, processingBuffer.sampleRate);
    
    // Run DTMF detection
    const dtmfResult = detectDTMF(channelData, processingBuffer.sampleRate);

    // Audio LSB detection (WAV only)
    let lsbResult: string | null = null;
    if (rawBuffer && fileName.toLowerCase().endsWith(".wav")) {
      lsbResult = detectAudioLSB(rawBuffer);
    }

    let revealedSecret = "";
    let badgeLabel = "";
    let type: "morse" | "reversed" | "dtmf" | "noise" = "noise";
    let analysisSummary = "";

    if (morseResult) {
      revealedSecret = `RECOVERED MORSE TELEMETRY: '${morseResult}'`;
      badgeLabel = "HIGH FREQUENCY AUDIO INTERCEPT";
      type = "morse";
      analysisSummary = `Forensic-grade acoustic envelope pulse modulation analysis completed. Hysteresis-based thresholding isolated the Morse sequence with high precision. Decoded value: ${morseResult}.`;
    } else if (dtmfResult) {
      revealedSecret = `DTMF FREQUENCY MAP DETECTED: '${dtmfResult}'`;
      badgeLabel = "DTMF TELEPHONY HARMONICS";
      type = "dtmf";
      analysisSummary = `Dual-Tone Multi-Frequency (DTMF) tones detected via Goertzel's spectral algorithm. Core keypad digit sequence decoded: ${dtmfResult}.`;
    } else if (lsbResult) {
      revealedSecret = `STEGANOGRAPHIC LSB PAYLOAD: "${lsbResult}"`;
      badgeLabel = "AUDIO STEGANOGRAPHY DETECTED";
      type = "noise";
      analysisSummary = `LSB analysis of 16-bit PCM samples revealed a hidden ASCII payload. This confirms the file was used as a steganographic carrier.`;
    } else if (fileName.includes("echo_rev") || fileName.includes("asylum")) {
      revealedSecret = "REVERSED SPEECH DEMODULATION: 'THE PASSWORD IS REDISTRIBUTE'";
      badgeLabel = "REVERSED VOCAL FREQUENCY";
      type = "reversed";
      analysisSummary = `Vocal tract acoustic resonance envelopes detected backward in time. Reversing playback reveals a whispered passphrase: 'THE PASSWORD IS REDISTRIBUTE'.`;
    } else {
      revealedSecret = "NO MORSE PATTERN DETECTED / NO DTMF TONES DETECTED";
      badgeLabel = "LOW FREQUENCY AMBIENCE";
      type = "noise";
      analysisSummary = `Acoustic spectrometry completed. Analysis of amplitude envelope and DTMF spectral bins confirmed no active Morse carrier or dual-tone multi-frequency signals.`;
    }

    setDecodedMetadata({
      duration: audioBuffer.duration,
      format: fileName.endsWith(".wav") ? "WAV (Uncompressed)" : fileName.endsWith(".ogg") ? "OGG (Vorbis)" : "MP3 (LAME High)",
      bitrate: `${Math.round((fileSize * 8) / (audioBuffer.duration * 1000))} kbps`,
      spectralCentroid: spectralCentroidStr,
      rmsEnergy: rmsEnergyStr,
      zeroCrossing: zeroCrossingStr,
      revealedSecret,
      analysisSummary,
      badgeLabel,
      type
    });

    if (lsbResult) setLsbPayload(lsbResult);
    else setLsbPayload(null);

    addLog(`DECODED ACOUSTIC ENVELOPE: ${audioBuffer.numberOfChannels} ch, ${audioBuffer.sampleRate} Hz, ${audioBuffer.duration.toFixed(2)}s`, "success", "SYS");
  }, [addLog, noiseReductionEnabled]);

  const detectAudioLSB = (arrayBuffer: ArrayBuffer): string | null => {
    const view = new DataView(arrayBuffer);
    if (arrayBuffer.byteLength < 44) return null;
    
    // Simple WAV check
    const isWav = view.getUint32(0, false) === 0x52494646 && // RIFF
                  view.getUint32(8, false) === 0x57415645;   // WAVE
    
    if (!isWav) return null;

    // Find 'data' chunk
    let offset = 12;
    let dataOffset = -1;
    let dataSize = 0;
    
    while (offset < arrayBuffer.byteLength - 8) {
      try {
        const chunkId = String.fromCharCode(
          view.getUint8(offset),
          view.getUint8(offset + 1),
          view.getUint8(offset + 2),
          view.getUint8(offset + 3)
        );
        const chunkSize = view.getUint32(offset + 4, true);
        if (chunkId === "data") {
          dataOffset = offset + 8;
          dataSize = chunkSize;
          break;
        }
        offset += 8 + chunkSize;
      } catch (e) {
        break;
      }
    }

    if (dataOffset === -1) return null;

    // Extract LSBs from 16-bit PCM
    const bits: number[] = [];
    const maxSamplesToScan = 500000;
    const end = Math.min(dataOffset + dataSize, dataOffset + maxSamplesToScan * 2);
    
    for (let i = dataOffset; i < end; i += 2) {
      const lowByte = view.getUint8(i);
      bits.push(lowByte & 1);
    }

    // Convert bits to bytes
    const bytes: number[] = [];
    for (let i = 0; i < bits.length - 8; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        byte = (byte << 1) | bits[i + b];
      }
      bytes.push(byte);
    }

    // Find longest printable string
    let currentString = "";
    let longestString = "";
    
    for (const b of bytes) {
      if (b >= 32 && b <= 126) {
        currentString += String.fromCharCode(b);
      } else {
        if (currentString.length > longestString.length) {
          longestString = currentString;
        }
        currentString = "";
      }
    }
    if (currentString.length > longestString.length) {
      longestString = currentString;
    }

    return longestString.length >= 4 ? longestString : null;
  };

  const loadCustomAudio = async (file: File) => {
    playScanOpen();
    setActiveFile(file);
    setSelectedSampleId(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setScanComplete(false);
    setScanProgress(0);
    setDecodedBuffer(null);
    setDecodedMetadata(null);

    addLog(`LOADED EXTERNAL SIGNAL CONTAINER: ${file.name.toUpperCase()}`, "info", "SYS");

    if (file.name.toLowerCase().endsWith(".mid") || file.name.toLowerCase().endsWith(".midi")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const parsed = parseMidiFile(arrayBuffer);
        setParsedMidi(parsed);
        setMidiFileName(file.name);
        setActiveTab("midi");
        setScanComplete(true);
        addLog(`MIDI BINARY DECODE SUCCESSFUL: ${file.name.toUpperCase()} (${parsed.header.numTracks} TRACKS)`, "success", "SYS");
      } catch (err: any) {
        console.error(err);
        addLog(`MIDI DECODE FAILED: ${err.message}`, "warning", "SYS");
      }
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API not supported in this browser environment");
      }
      const audioCtx = new AudioContextClass();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0)); // Clone arrayBuffer as decodeAudioData consumes it
      setDecodedBuffer(audioBuffer);

      analyzeAudioBuffer(audioBuffer, file.name, file.size, arrayBuffer);
      await audioCtx.close();
      setParsedMidi(null);
    } catch (err: any) {
      console.error(err);
      addLog(`DECODE FAILED: INVALID COHERENT WAVEFORM STREAM (${err.message})`, "warning", "SYS");
    }
  };

  // Run audio telemetry scan (0 to 100%)
  const triggerSpectralScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setScanComplete(false);
    playAudioForensicsScan();

    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const messages = [
      "INJECTING acoustic pass filters...",
      "SAMPLING Fourier transforms (FFT)...",
      "CORRELATING Dual-Tone harmonics...",
      "REVERSING vocal wave vectors...",
      "INTERPOLATING spectral centroid thresholds..."
    ];

    let currentStep = 0;
    let progress = 0;
    scanIntervalRef.current = setInterval(() => {
      progress += 5;
      if (progress % 20 === 0 && currentStep < messages.length - 1) {
        currentStep++;
      }
      setScanProgress(progress);
      setScanningMessage(messages[currentStep]);

      if (progress >= 100) {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setIsScanning(false);
        setScanComplete(true);
        playFileAnalysisComplete();
        addLog(`SPECTROMETRY SCAN SUCCESSFUL ON FILE ${currentSample.name}`, "success", "SYS");
      }
    }, 100);
  };

  // Preset Selector
  const loadPreset = (sampleId: string) => {
    playPinClick();
    setSelectedSampleId(sampleId);
    setActiveFile(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setScanComplete(false); // Changed to false so user runs scan!
    setScanProgress(0);
    setIsScanning(false);
    setDecodedBuffer(null);
    setDecodedMetadata(null);

    if (sampleId === "forensic-midi-carrier") {
      setScanComplete(true);
      const midiBuffer = generateForensicMidiBuffer();
      const parsed = parseMidiFile(midiBuffer);
      setParsedMidi(parsed);
      setMidiFileName("bell_tower_beacon.mid");
      setActiveTab("midi");
      addLog("ACQUIRED RECORD: BELL TOWER BEACON (FORENSIC MIDI)", "info", "SYS");
      return;
    }

    addLog(`ACQUIRED TELEMETRY RECORD: ${TACTICAL_AUDIO_SAMPLES.find(s => s.id === sampleId)?.name}`, "info", "SYS");
  };

  // Synchronize preset audio buffer generation
  useEffect(() => {
    if (selectedSampleId) {
      let buffer: AudioBuffer | null = null;
      const sampleRate = 44100;
      let name = "";
      let size = 1000000; // dummy size for preset
      if (selectedSampleId === "morse-intercept") {
        buffer = generateMorseAudio("SOS SECTOR NINE", sampleRate, 12.4);
        name = "sector_ridge_morse.wav";
        size = 1800000;
      } else if (selectedSampleId === "keypad-dtmf") {
        buffer = generateDTMFAudio(["3", "5", "2", "9", "*"], sampleRate, 6.2);
        name = "dial_pad_feedback.ogg";
        size = 612000;
      } else if (selectedSampleId === "asylum-reversal") {
        buffer = generateAsylumAudio(sampleRate, 8.5);
        name = "asylum_corridor_echo_rev.mp3";
        size = 920000;
      } else if (selectedSampleId === "ambient-sewer") {
        buffer = generateSewerAudio(sampleRate, 24.0);
        name = "sewer_grate_vent_fan.wav";
        size = 3400000;
      }
      
      if (buffer) {
        setDecodedBuffer(buffer);
        analyzeAudioBuffer(buffer, name, size);
      }
    }
  }, [selectedSampleId, analyzeAudioBuffer]);

  // Push findings to the dossier detective board
  const pushFindingsToDossier = () => {
    const caseId = activeCaseId || (cases[0]?.id || "");
    if (!caseId) {
      addLog("CANNOT COMPLY: NO ACTIVE CASE RECORD REGISTERED", "warning", "SYS");
      return;
    }

    playPinClick();

    const noteContent = `### AUDIO FORENSICS SPECTROMETRY SUMMARY
**ACQUISITION SOURCE**: ${currentSample.name}
**METRICS & TECHNICALS**:
- Container format: ${currentSample.format} (${currentSample.bitrate})
- Spectral Centroid Index: ${currentSample.spectralCentroid}
- Amplitude RMS Energy: ${currentSample.rmsEnergy}
- Zero-Crossing density: ${currentSample.zeroCrossing}

**RECOVERED AUDIO SECRET DATA**:
"${currentSample.revealedSecret}"

**DETECTOR INTERPOLATION**:
${currentSample.analysisSummary}`;

    addEvidenceNode({
      type: "file",
      title: `AUDIO DECIPHER: ${currentSample.name}`,
      content: noteContent,
      x: 150 + Math.random() * 150,
      y: 150 + Math.random() * 150
    });

    addLog(`COMMITTED SPECTRAL CRACK EVIDENCE CARD TO DOSSIER BOARD`, "success", "SYS");
    setModule("detective-board");
  };

  return (
    <div
      className="h-full w-full p-4 flex flex-col space-y-4 overflow-y-auto font-chakra select-none text-text-primary relative"
      id="audio-forensics-root"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="fixed inset-0 z-[999] bg-bg-void/80 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="border-2 border-dashed border-cyan-primary bg-cyan-primary/5 px-12 py-10 flex flex-col items-center space-y-3">
            <span className="font-display text-sm font-black tracking-[0.2em] text-cyan-primary uppercase">
              RELEASE TO ANALYZE
            </span>
            <span className="font-share text-[13px] text-text-dim uppercase tracking-widest">
              Drop audio file anywhere on screen
            </span>
          </div>
        </div>
      )}
      
      {/* 1. MODULE HEADER PANEL (Full Width) */}
      <GlassPanel className="p-4" clipSize="sm" showCornerTicks={true}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-4 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_8px_var(--color-accent-primary)]" />
              <h1 className="font-display text-sm font-black tracking-widest text-cyan-text uppercase">
                AUDIO SPECTRAL FORENSICS
              </h1>
            </div>
            <p className="text-[13px] text-text-dim uppercase tracking-wider font-share mt-1 leading-relaxed">
              Belfry Acoustic Analysis Lab. Isolates audio frequencies, deciphers Morse radio intercepts, maps DTMF dial codes, and reconstructs reversed vocal echoes.
            </p>
          </div>
          <Badge variant="cyan" size="xs" className="shrink-0">
            SECURE DECRYPTOR
          </Badge>
        </div>
      </GlassPanel>

      {/* 2. MAIN WAVEFORM CONSOLE (Full Width) */}
      <GlassPanel className="p-4 flex flex-col" clipSize="md">
        <div className="border-b border-border-hairline/20 pb-2 mb-3.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-3.5 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
            <h3 className="font-display text-xs font-black tracking-widest text-cyan-text uppercase">
              {!currentSample ? "AWAITING ACOUSTIC CARRIER" : activeTab === "waveform" ? "TIME-DOMAIN WAVEFORM DISPLAY" : "FREQUENCY-DOMAIN SPECTROGRAM"}
            </h3>
          </div>

          <div className="flex space-x-1">
            {(["waveform", "spectrogram", "midi"] as const).map((tab) => (
              <button
                key={tab}
                disabled={tab !== "midi" ? !currentSample : false}
                onClick={() => {
                  playPinClick();
                  setActiveTab(tab);
                }}
                className={`px-3 py-1 font-mono text-[12px] uppercase border transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none ${
                  activeTab === tab
                    ? "bg-cyan-primary border-cyan-primary text-bg-void font-bold shadow-[0_0_6px_var(--color-accent-primary)]"
                    : "bg-bg-void/40 border-border-hairline/25 text-text-dim hover:text-text-primary hover:border-cyan-primary/30"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Core Canvas Viewport */}
        <div className="flex-1 bg-bg-void/90 border border-cyan-primary/10 p-3 relative min-h-[220px] overflow-hidden group">
          <div className="absolute inset-0 border-[3px] border-cyan-primary animate-signal-lock pointer-events-none z-10 opacity-0 shadow-[inset_0_0_20px_rgb(var(--rgb-accent) / 0.5)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-primary/20 to-transparent w-full h-[10%] animate-scanline-vertical opacity-30 mix-blend-screen pointer-events-none" />
          
          {activeTab === "midi" ? (
            <div className="w-full h-[220px] flex flex-col font-mono text-[13px] text-cyan-dim overflow-y-auto scrollbar-thin select-text space-y-1 pr-1">
              <div className="border-b border-cyan-primary/20 pb-1 flex justify-between items-center text-[12px] font-bold tracking-widest text-text-primary uppercase mb-1.5 shrink-0">
                <span>MIDI BINARY STREAM PARSER // CHUNK TYPE MThd & MTrk</span>
                <span className="text-cyan-primary animate-pulse">STATUS: ACTIVE</span>
              </div>
              
              {parsedMidi ? (
                <>
                  {/* File Metadata Headers */}
                  <div className="grid grid-cols-3 gap-2 bg-cyan-primary/5 p-1.5 border border-cyan-primary/15 mb-2 rounded-sm text-text-primary shrink-0">
                    <div>
                      <span className="text-text-dim text-[12px] uppercase block">MIDI FORMAT:</span>
                      <span className="text-cyan-text font-bold">Format {parsedMidi.header.format}</span>
                    </div>
                    <div>
                      <span className="text-text-dim text-[12px] uppercase block">TRACKS COUNT:</span>
                      <span className="text-cyan-text font-bold">{parsedMidi.header.numTracks} Track(s)</span>
                    </div>
                    <div>
                      <span className="text-text-dim text-[12px] uppercase block">TIMING DIVISION:</span>
                      <span className="text-cyan-text font-bold">{parsedMidi.header.division} ticks/quarter</span>
                    </div>
                  </div>

                  {parsedMidi.warnings.length > 0 && (
                    <div className="bg-red-threat/10 border border-red-threat/25 p-1.5 text-red-threat text-[12px] mb-2 rounded-sm shrink-0">
                      <span className="font-bold">PARSER WARNINGS:</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {parsedMidi.warnings.map((w: string, idx: number) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Render parsed events scrollbox */}
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[140px]">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-border-hairline/15 text-text-dim uppercase font-bold text-[12px]">
                          <th className="pb-1">ABS TIME</th>
                          <th className="pb-1">TRACK</th>
                          <th className="pb-1">EVENT TYPE</th>
                          <th className="pb-1">CH</th>
                          <th className="pb-1">DETAILS / NOTE DATA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedMidi.events.slice(0, 150).map((event: any, idx: number) => {
                          const isNote = event.type.startsWith("Note");
                          const isMeta = event.type.includes("Meta") || ["Tempo Change", "Track Name", "Time Signature", "Key Signature", "End of Track"].includes(event.type);
                          
                          let detailStr = "";
                          if (isNote) {
                            detailStr = `Note: ${event.param1} (${noteNumberToName(event.param1)}) | Vel: ${event.param2}`;
                          } else if (event.text) {
                            detailStr = event.text;
                          } else if (event.param1 !== undefined) {
                            detailStr = `Value: ${event.param1}`;
                          }

                          return (
                            <tr key={idx} className="hover:bg-cyan-primary/5 transition-colors border-b border-border-hairline/5">
                              <td className="py-0.5 font-bold text-text-dim">{event.absoluteTime}</td>
                              <td className="py-0.5 text-amber-alert font-bold">TR.{event.trackIndex + 1}</td>
                              <td className={`py-0.5 font-semibold ${isNote ? "text-cyan-text" : isMeta ? "text-green-verified" : "text-text-dim"}`}>
                                {event.type.toUpperCase()}
                              </td>
                              <td className="py-0.5">{event.channel !== undefined ? `CH.${event.channel + 1}` : "--"}</td>
                              <td className="py-0.5 truncate max-w-[200px] text-text-primary italic">
                                {detailStr}
                              </td>
                            </tr>
                          );
                        })}
                        {parsedMidi.events.length > 150 && (
                          <tr>
                            <td colSpan={5} className="py-1 text-center text-text-dim italic text-[12px]">
                              -- showing first 150 events of {parsedMidi.events.length} total events --
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-8 text-center h-[140px]">
                  <span className="text-text-dim uppercase text-[12px] tracking-widest">Awaiting MIDI telemetry stream decoder — upload a .mid file to begin...</span>
                </div>
              )}
            </div>
          ) : (
            <canvas 
              ref={waveformCanvasRef} 
              width={1000} 
              height={220} 
              className={`w-full h-full object-cover border border-cyan-primary/5 shadow-[inset_0_0_12px_rgb(var(--rgb-accent) / 0.05)] ${currentSample ? "cursor-pointer" : "cursor-not-allowed"}`}
              onClick={(e) => {
                if (!currentSample) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                const newTime = percent * currentSample.duration;
                setCurrentTime(newTime);
                playHoverBlip();
                if (isPlaying && decodedBuffer) {
                  startAudioPlayback(newTime);
                }
              }}
            />
          )}

          {/* If scanning, overlay scanning label */}
          {isScanning && (
            <div className="absolute bottom-4 right-4 flex items-center space-x-2 font-share text-[13px] text-cyan-primary tracking-widest bg-bg-void/90 px-2.5 py-1 border border-cyan-primary/30 shadow-[0_0_10px_rgb(var(--rgb-accent) / 0.2)]">
              <span className="w-2 h-2 rounded-full bg-cyan-primary animate-ping-cyan" />
              <span className="font-bold">{scanningMessage}</span>
            </div>
          )}

          {/* Corner retro tech crosshairs */}
          <div className="absolute top-4 left-4 w-3 h-3 border-t border-l border-cyan-primary/20" />
          <div className="absolute top-4 right-4 w-3 h-3 border-t border-r border-cyan-primary/20" />
          <div className="absolute bottom-4 left-4 w-3 h-3 border-b border-l border-cyan-primary/20" />
          <div className="absolute bottom-4 right-4 w-3 h-3 border-b border-r border-cyan-primary/20" />
        </div>

        <div className="mt-2.5 flex justify-between font-mono text-[12px] text-text-dim uppercase tracking-widest">
          <span>COHERENT ACOUSTIC FREQUENCY FEED</span>
          <span>FILTER PROFILE: HIGH-PASS CHEBYSHEV ENVELOPE</span>
        </div>

        {/* Timeline Scrub Bar (Scrubbing enabled only if currentSample exists) */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between font-mono text-[12px] text-text-dim">
            <span>{currentSample ? `${currentTime.toFixed(1)}s` : "0.0s"}</span>
            <span>{currentSample ? `${currentSample.duration.toFixed(1)}s` : "0.0s"}</span>
          </div>
          <div 
            className={`w-full h-1.5 bg-bg-void border border-border-hairline/15 relative ${currentSample ? "cursor-pointer" : "cursor-not-allowed opacity-30"}`}
            onClick={(e) => {
              if (!currentSample) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percent = x / rect.width;
              const newTime = percent * currentSample.duration;
              setCurrentTime(newTime);
              playHoverBlip();
              if (isPlaying && decodedBuffer) {
                startAudioPlayback(newTime);
              }
            }}
          >
            {currentSample && (
              <div 
                className="absolute top-0 bottom-0 left-0 bg-cyan-primary shadow-[0_0_8px_var(--color-accent-primary)]" 
                style={{ width: `${(currentTime / currentSample.duration) * 100}%` }}
              />
            )}
          </div>
        </div>

        {/* Playback controls docked directly below as a continuous unit */}
        <div className="mt-4 flex flex-col md:flex-row items-center justify-between border-t border-border-hairline/10 pt-3.5 gap-3">
          <div className="flex items-center space-x-2">
            <button
              disabled={!currentSample}
              onClick={() => {
                playPinClick();
                setIsPlaying(!isPlaying);
              }}
              className={`p-2 border transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none ${
                isPlaying 
                  ? "bg-red-threat/25 border-red-threat text-white" 
                  : "bg-cyan-primary/10 border-cyan-primary/30 text-cyan-text hover:bg-cyan-primary hover:text-bg-void"
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              disabled={!currentSample}
              onClick={() => {
                playPinClick();
                setCurrentTime(0);
                if (isPlaying && decodedBuffer) {
                  startAudioPlayback(0);
                }
              }}
              className="p-2 border border-border-hairline/25 text-text-dim hover:text-text-primary hover:bg-bg-void/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              disabled={!currentSample}
              onClick={() => {
                playPinClick();
                setIsReversed(!isReversed);
                addLog(`REVERSED ACOUSTIC MODULATION: ${!isReversed ? "ENABLED" : "DISABLED"}`, "info", "SYS");
              }}
              className={`px-3 py-2 border font-mono text-[12px] font-black transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none ${
                isReversed
                  ? "bg-amber-alert/25 border-amber-alert text-white"
                  : "border-border-hairline/25 text-text-dim hover:text-text-primary hover:bg-bg-void/40"
              }`}
            >
              REVERSE
            </button>
          </div>

          {/* Launcher inside transport controls panel */}
          <div className="flex-1 max-w-md mx-4">
            <button
              disabled={!currentSample || isScanning}
              onClick={triggerSpectralScan}
              className="hud-target w-full py-2 bg-cyan-primary text-bg-void hover:bg-white hover:shadow-[0_0_20px_rgb(var(--rgb-accent) / 0.6)] active:scale-[0.98] transition-all duration-200 text-[13px] font-black tracking-widest font-display uppercase disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center space-x-2"
              style={{ clipPath: "polygon(0 0, 100% 0, 96% 100%, 0 100%)" }}
            >
              <Radio className={`w-3.5 h-3.5 text-bg-void ${isScanning ? 'animate-radar-sweep' : 'animate-hex-pulse-flicker'}`} />
              <span>{isScanning ? 'ANALYZING SPECTRUM...' : scanComplete ? 'SPECTRUM ANALYSIS STABLE' : 'LAUNCH FOURIER SPECTRAL MATRIX ANALYZER'}</span>
            </button>
          </div>

          {/* Speed Adjust */}
          <div className="flex items-center space-x-1 font-mono text-[12px]">
            <span className="text-text-dim mr-1">NOISE REDUCTION:</span>
            <button
              disabled={!currentSample}
              onClick={() => {
                playPinClick();
                setNoiseReductionEnabled(!noiseReductionEnabled);
                addLog(`NOISE FLOOR SUBTRACTION: ${!noiseReductionEnabled ? "ENABLED" : "DISABLED"}`, "info", "SYS");
                if (decodedBuffer && currentSample) {
                  analyzeAudioBuffer(decodedBuffer, currentSample.name, 1000000);
                }
              }}
              className={`px-3 py-1 border transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none mr-2 ${
                noiseReductionEnabled
                  ? "bg-cyan-primary border-cyan-primary text-bg-void font-bold shadow-[0_0_6px_var(--color-accent-primary)]"
                  : "bg-bg-void/40 border-border-hairline/25 text-text-dim hover:text-text-primary hover:border-cyan-primary/30"
              }`}
            >
              {noiseReductionEnabled ? "ON" : "OFF"}
            </button>
            <span className="text-text-dim mr-1">SPEED:</span>
            {[0.5, 1.0, 1.5, 2.0].map((speed) => (
              <button
                key={speed}
                disabled={!currentSample}
                onClick={() => {
                  playPinClick();
                  setPlaybackSpeed(speed);
                }}
                className={`px-2 py-0.5 border disabled:opacity-30 disabled:pointer-events-none ${
                  playbackSpeed === speed && currentSample
                    ? "bg-cyan-primary border-cyan-primary text-bg-void font-bold"
                    : "border-border-hairline/15 text-text-dim hover:text-text-primary"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </GlassPanel>

      {/* 3. HORIZONTAL METER-BRIDGE STRIP (Full Width) */}
      <GlassPanel className="p-3" clipSize="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Centroid Metric */}
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between font-mono text-[12px] tracking-wider">
              <span className="text-text-dim">SPECTRAL CENTROID</span>
              <span className="text-cyan-text font-black">{scanComplete && currentSample ? currentSample.spectralCentroid : "0 Hz"}</span>
            </div>
            <VUMeter 
              active={scanComplete && !!currentSample} 
              value={
                !currentSample ? 0 :
                currentSample.type === "morse" ? 65 :
                currentSample.type === "reversed" ? 45 :
                currentSample.type === "dtmf" ? 75 : 25
              } 
              isPlaying={isPlaying} 
            />
          </div>

          {/* RMS Metric */}
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between font-mono text-[12px] tracking-wider">
              <span className="text-text-dim">RMS ENVELOPE ENERGY</span>
              <span className="text-cyan-text font-black">{scanComplete && currentSample ? currentSample.rmsEnergy : "-∞ dB"}</span>
            </div>
            <VUMeter 
              active={scanComplete && !!currentSample} 
              value={
                !currentSample ? 0 :
                currentSample.type === "morse" ? 70 :
                currentSample.type === "reversed" ? 40 :
                currentSample.type === "dtmf" ? 85 : 20
              } 
              isPlaying={isPlaying} 
            />
          </div>

          {/* Zero Crossing Metric */}
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between font-mono text-[12px] tracking-wider">
              <span className="text-text-dim">ZERO CROSSING DENSITY</span>
              <span className="text-cyan-text font-black">{scanComplete && currentSample ? currentSample.zeroCrossing : "0 cps"}</span>
            </div>
            <VUMeter 
              active={scanComplete && !!currentSample} 
              value={
                !currentSample ? 0 :
                currentSample.type === "morse" ? 50 :
                currentSample.type === "reversed" ? 75 :
                currentSample.type === "dtmf" ? 90 : 20
              } 
              isPlaying={isPlaying} 
            />
          </div>

          {/* Coherence Confidence Metric */}
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between font-mono text-[12px] tracking-wider">
              <span className="text-text-dim">COHERENCE CONFIDENCE</span>
              <span className="text-green-verified font-black">{scanComplete && currentSample ? "99.8%" : "0.0%"}</span>
            </div>
            <VUMeter 
              active={scanComplete && !!currentSample} 
              value={scanComplete ? 95 : 0} 
              isPlaying={isPlaying} 
            />
          </div>

        </div>
      </GlassPanel>

      {/* 4. LOWER WORKSPACE ROW (Split 7 / 5 Grid) */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Signal Controls Left Block */}
        <div className="col-span-12 lg:col-span-7 flex flex-col space-y-4">
          <GlassPanel className="p-4 h-full flex flex-col justify-between" clipSize="sm">
            <div className="border-b border-border-hairline/20 pb-1.5 mb-3">
              <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                <Compass className="w-3.5 h-3.5 mr-2 text-cyan-primary animate-hex-pulse-flicker" />
                SIGNAL ARCHIVE & INPUT PORT
              </h3>
              <p className="text-[12px] text-text-dim uppercase tracking-wider font-share">
                Upload local raw audio or MIDI to execute forensic spectral sweeps
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 flex-1 items-stretch">
              
              {/* Dashed Drag/Drop Box */}
              <div 
                className={`flex flex-col items-center justify-center border border-dashed hover:bg-cyan-primary/[0.02] p-4 transition-all duration-300 group cursor-pointer ${
                  dragActive ? "border-cyan-primary bg-cyan-primary/[0.04]" : "border-cyan-primary/30 hover:border-cyan-primary/60"
                }`}
                // @ts-ignore
                onDragEnter={handleDrag}
                // @ts-ignore
                onDragOver={handleDrag}
                // @ts-ignore
                onDragLeave={handleDrag}
                // @ts-ignore
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      loadCustomAudio(e.target.files[0]);
                    }
                  }}
                  className="hidden" 
                  accept="audio/*,.mid,.midi"
                />
                <div className="w-10 h-10 rounded-full border border-cyan-primary/25 flex items-center justify-center mb-2 bg-bg-void group-hover:scale-105 group-hover:border-cyan-primary/55 transition-all duration-300">
                  <Upload className="w-4 h-4 text-cyan-primary/70 group-hover:text-cyan-primary" />
                </div>
                <span className="font-display text-[13px] font-black tracking-widest text-cyan-text text-center">
                  UPLOAD AUDIO STREAM
                </span>
                <span className="text-[12px] text-text-dim uppercase text-center mt-0.5">
                  DRAG & DROP OR CLICK TO BROWSE
                </span>
              </div>

            </div>

            {/* Current Active Info Bar */}
            {currentSample && (
              <div className="mt-3 bg-bg-void/40 border border-border-hairline/10 p-2 font-mono text-[12px] flex justify-between items-center">
                <div className="flex space-x-4">
                  <div>
                    <span className="text-text-dim mr-1">SOURCE:</span>
                    <span className="text-cyan-text font-bold truncate max-w-[130px] inline-block align-bottom">{currentSample.name}</span>
                  </div>
                  <div>
                    <span className="text-text-dim mr-1">FORMAT:</span>
                    <span>{currentSample.format} ({currentSample.bitrate})</span>
                  </div>
                </div>
                {activeFile && (
                  <button
                    onClick={() => {
                      playPinClick();
                      setActiveFile(null);
                      setSelectedSampleId(null);
                      setScanComplete(false);
                    }}
                    className="hover:text-red-threat text-text-dim uppercase transition-colors flex items-center font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    FLUSH BUFFER
                  </button>
                )}
              </div>
            )}
          </GlassPanel>
        </div>

        {/* Demodulated Output Right Block */}
        <div className="col-span-12 lg:col-span-5 flex flex-col">
          <GlassPanel className="p-4 flex flex-col justify-between h-full" clipSize="sm">
            <div className="border-b border-border-hairline/15 pb-1.5 mb-3 flex justify-between items-center">
              <div className="flex items-center">
                <Award className="w-3.5 h-3.5 text-cyan-primary mr-1.5" />
                <h4 className="font-display text-[13px] font-black tracking-widest text-cyan-text uppercase">
                  EXTRACTED FREQUENCY HARMONIC SIGNAL
                </h4>
              </div>
              {scanComplete && currentSample && (
                <Badge variant={currentSample.type !== "noise" ? "red" : "green"} size="xs">
                  {currentSample.badgeLabel}
                </Badge>
              )}
            </div>

            {!currentSample ? (
              <div className="py-12 text-center text-[13px] text-text-dim uppercase font-mono">
                No active carrier wave loaded...
              </div>
            ) : !scanComplete ? (
              <div className="py-12 text-center text-[13px] text-text-dim uppercase font-mono">
                {isScanning ? "Aligning carrier phases..." : "Demodulator feed offline. Run scan sweep."}
              </div>
            ) : (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="bg-bg-void/70 border border-border-hairline/25 p-3 font-mono text-xs text-cyan-text leading-relaxed h-[100px] overflow-y-auto relative">
                  <div className="absolute inset-0 opacity-40 pointer-events-none z-0">
                    <CorrelationNetwork nodeCount={14} connectionDistance={50} />
                  </div>
                  <div className="relative z-10 flex flex-col space-y-2">
                    <DecryptText text={currentSample.revealedSecret} duration={1000} />
                    {lsbPayload && (
                      <div className="mt-2 pt-2 border-t border-border-hairline/10">
                        <span className="text-[12px] text-text-dim uppercase block mb-1">LSB Decoded Stream:</span>
                        <span className="text-[13px] text-green-verified break-all">{lsbPayload}</span>
                      </div>
                    )}
                    {currentSample.name.toLowerCase().endsWith(".wav") ? null : activeFile && (
                      <div className="mt-2 text-[12px] text-amber-alert/60 italic uppercase">
                        * LSB analysis bypassed (non-WAV/lossy format detected)
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={pushFindingsToDossier}
                    className="px-4 py-2 border border-cyan-primary/30 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-all duration-200 text-[13px] uppercase tracking-widest font-black flex items-center space-x-1.5"
                    style={{ clipPath: "polygon(0 0, 100% 0, 94% 100%, 0 100%)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Dossier Storage</span>
                  </button>
                </div>
              </div>
            )}
          </GlassPanel>
        </div>

      </div>

    </div>
  );
}
