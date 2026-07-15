let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let sampleBuffers: Record<string, AudioBuffer> = {};
let currentVolume = 0.4;
let currentMuted = false;
let currentAmbientEnabled = true;

let ambientActive = false;
let ambientSource: AudioBufferSourceNode | null = null;
let ambientGainNode: GainNode | null = null;
let ambientSynthNode: OscillatorNode | null = null;
let ambientSynthGainNode: GainNode | null = null;
let currentAmbientFileIndex = -1;
let pendingPlaySystemBoot = false;
let pendingPlaySystemBootLoop = false;

const activeInteractionLoops = new Set<{ stop: () => void }>();
let ambientTimeoutId: any = null;

function registerLoop(handle: { stop: () => void }): { stop: () => void } {
  const wrapped = {
    stop: () => {
      activeInteractionLoops.delete(wrapped);
      try {
        handle.stop();
      } catch (e) {}
    }
  };
  activeInteractionLoops.add(wrapped);
  return wrapped;
}

if (typeof document !== "undefined") {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('[SoundEngine] Tab became hidden. Hard-stopping all active interaction loops.');
      activeInteractionLoops.forEach(handle => {
        try {
          handle.stop();
        } catch (e) {}
      });
      activeInteractionLoops.clear();
      
      if (decypheringLoopSource) {
        try { decypheringLoopSource.stop(); } catch(e) {}
        decypheringLoopSource = null;
      }
      if (scanLoopSource) {
        try { scanLoopSource.stop(); } catch(e) {}
        scanLoopSource = null;
      }
    }
  });
}

const warnedFiles = new Set<string>();

function warnOnce(url: string, error: any) {
  if (!warnedFiles.has(url)) {
    warnedFiles.add(url);
    console.error(`[SoundEngine] Error: Could not load sound file from "${url}". Details:`, error?.message || error);
  }
}

const soundFiles: Record<string, string> = {
  navTick: '/sounds/CLICK_TAB.mp3',
  pinClick: '/sounds/CLICK_ELEMENT.mp3',
  hoverBlip: '/sounds/hover.mp3',
  typeKey: '/sounds/TYPING.mp3',
  successChime: '/sounds/DECYPHER_SUCCESS.mp3',
  unpinTear: '/sounds/DELETE_EVIDENCE.mp3',
  scanLoop: '/sounds/SCANNER.mp3',
  closeFile: '/sounds/CLOSEFILE.mp3',
  cypherTabOpen: '/sounds/CYPHER_TAB_OPEN.mp3',
  detectiveBoardLoad: '/sounds/DETECTIVE_BOARD_LOAD.mp3',
  fileAnalysisComplete: '/sounds/FILE_ANALYSIS_COMPLETE.mp3',
  hoverEvidence: '/sounds/HOVER_OVER_EVIDENCE.mp3',
  materialize: '/sounds/LOAD TAB.mp3',
  openAudioSteganography: '/sounds/OPEN_AUDIO_STEGANOGRAPHY.mp3',
  openFile: '/sounds/OPEN_FILE.mp3',
  scanOpen: '/sounds/SCAN_OPEN.mp3',
  unlinkConnection: '/sounds/UNLINKING.mp3',
  decyphering: '/sounds/DECYPHERING.mp3',
  systemBoot: '/sounds/loading.mp3',
  fileAnalysisScanner: '/sounds/FILE_ANALYSIS_SCANNER.mp3',
  audioForensicsScan: '/sounds/AUDIO_FORENSICS_SCAN.mp3',
  imageForensicsScan: '/sounds/IMAGE_FORENSICS_SCAN.mp3',
};

const ambientFiles: string[] = [
  '/sounds/BG_SOUND_1.mp3',
  '/sounds/BG_SOUND_2.mp3',
  '/sounds/BG_SOUND_3.mp3',
];
let ambientBuffers: AudioBuffer[] = [];

async function loadSamples(ctx: AudioContext) {
  // 1. Load systemBoot first so it is available ASAP
  try {
    const bootUrl = soundFiles.systemBoot;
    if (bootUrl) {
      const response = await fetch(encodeURI(bootUrl));
      if (!response.ok) {
        throw new Error(`Failed to fetch systemBoot: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      sampleBuffers.systemBoot = await ctx.decodeAudioData(arrayBuffer);
      console.log("[SoundEngine] systemBoot loaded successfully");
      
      if (pendingPlaySystemBoot) {
        pendingPlaySystemBoot = false;
        playSystemBoot(pendingPlaySystemBootLoop);
      }
    }
  } catch (e: any) {
    warnOnce(soundFiles.systemBoot || 'systemBoot', e);
  }

  
  for (const [key, rawUrl] of Object.entries(soundFiles)) {
    if (key === "systemBoot") continue;
    try {
      const url = encodeURI(rawUrl);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      sampleBuffers[key] = await ctx.decodeAudioData(arrayBuffer);
      console.log(`[SoundEngine] Loaded sample: ${key}`);
    } catch (e: any) {
      warnOnce(rawUrl, e);
    }
  }

  const ambientSlots: (AudioBuffer | undefined)[] = new Array(ambientFiles.length);
  for (let i = 0; i < ambientFiles.length; i++) {
    const rawUrl = ambientFiles[i];
    try {
      const url = encodeURI(rawUrl);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ambient: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      ambientSlots[i] = await ctx.decodeAudioData(arrayBuffer);
    } catch (e: any) {
      warnOnce(rawUrl, e);
    }
  }

  ambientBuffers = ambientSlots.filter((b): b is AudioBuffer => !!b);
  console.log(`[SoundEngine] Ambient tracks loaded: ${ambientBuffers.length}`);
  
  syncAmbientDrone();
}

export function setSoundVolume(v: number) {
  currentVolume = v;
  syncVolume();
}

export function setSoundMuted(m: boolean) {
  currentMuted = m;
  syncVolume();
}

export function setAmbientEnabled(enabled: boolean) {
  currentAmbientEnabled = enabled;
  syncAmbientDrone();
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainNode = audioCtx.createGain();
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
      compressor.knee.setValueAtTime(30, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);
      masterGainNode.connect(compressor);
      compressor.connect(audioCtx.destination);
      loadSamples(audioCtx);
      syncVolume();
    } catch (e) {
      console.warn("Failed to initialize Web Audio context:", e);
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function preloadSounds() {
  getAudioContext();
}

function playSample(key: string, loop: boolean = false, volumeModifier: number = 1.0): { stop: () => void } | void {
  try {
    const ctx = getAudioContext();
    if (!ctx || !masterGainNode || getVolume() === 0) return;
    
    if (sampleBuffers[key]) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = sampleBuffers[key];
        source.loop = loop;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.0 * volumeModifier, ctx.currentTime);
        source.connect(gain);
        gain.connect(masterGainNode);
        source.start();
        const rawHandle = { 
          stop: () => { 
            try { 
              source.stop(); 
            } catch (err) {
              // Silently ignore if already stopped
            } 
          } 
        };
        if (loop) {
          return registerLoop(rawHandle);
        }
        return rawHandle;
      } catch (e: any) {
        console.error(`[SoundEngine] Error playing sample ${key}:`, e);
      }
    } else {
      console.warn(`[SoundEngine] Sample "${key}" requested but not loaded. Skipping.`);
    }
  } catch (e: any) {
    console.error(`[SoundEngine] Error in playSample for ${key}:`, e);
  }
}

function getVolume(): number {
  if (currentMuted) return 0;
  return currentVolume;
}

export function syncVolume() {
  if (masterGainNode) {
    masterGainNode.gain.setValueAtTime(getVolume(), audioCtx!.currentTime);
  }
}

export function playNavTick() { playSample('navTick'); }
export function playPinClick() { playSample('pinClick'); }
let lastHoverTime = 0;
function playHover(key: string, volume: number) {
  const now = Date.now();
  if (now - lastHoverTime > 200) {
    playSample(key, false, volume);
    lastHoverTime = now;
  }
}
export function playHoverBlip() { playHover('hoverBlip', 0.8); }
export function playHoverEvidence() { playHover('hoverEvidence', 0.9); }

export function playDebouncedTypeKey() {
  const now = Date.now();
  if (now - lastTypeTime > 50) {
    playTypeKey();
    lastTypeTime = now;
  }
}
let lastTypeTime = 0;

export function playSuccessChime() { playSample('successChime'); }
export function playUnpinTear() { playSample('unpinTear'); }
export function playCloseFile() { playSample('closeFile'); }
export function playCypherTabOpen() { playSample('cypherTabOpen'); }
export function playDetectiveBoardLoad() { playSample('detectiveBoardLoad'); }
export function playFileAnalysisComplete() { playSample('fileAnalysisComplete'); }
export function playFileAnalysisScanner() { playSample('fileAnalysisScanner'); }
export function playAudioForensicsScan() { playSample('audioForensicsScan'); }
export function playImageForensicsScan() { playSample('imageForensicsScan'); }

export function playLoadTab(module: string) {
  if (module === 'crypto-lab' || module === 'encoding-lab') {
    playCypherTabOpen();
  }
}

export function playTypeKey() { playSample('typeKey'); }
export function playSystemBoot(loop: boolean = false): { stop: () => void } | void {
  if (!sampleBuffers['systemBoot']) {
    pendingPlaySystemBoot = true;
    pendingPlaySystemBootLoop = loop;
    return;
  }
  return playSample('systemBoot', loop);
}

export function playMaterialize() { playSample('materialize'); }
export function playOpenAudioSteganography() { playSample('openAudioSteganography'); }
export function playAddStep() { playSample('recipeAddStep'); }
export function playRemoveStep() { playSample('recipeRemoveStep'); }
export function playDragReorder() { playSample('recipeDragReorder'); }
export function playBakeSuccess() { playSample('recipeBakeSuccess'); }
export function playBakeFailure() { playSample('recipeBakeFailure'); }
export function playBruteForceMatch() { playSample('bruteForceMatch'); }
export function playOpenFile() { playSample('openFile'); }
export function playScanOpen() { playSample('scanOpen'); }
export function playUnlinkConnection() { playSample('unlinkConnection'); }

let scanLoopSource: { stop: () => void } | null = null;
export function playScanLoop() {
  stopScanLoop();
  const source = playSample('scanLoop', true);
  if (source) scanLoopSource = source;
  return scanLoopSource || { stop: () => {} };
}

export function stopScanLoop() {
  if (scanLoopSource) {
    scanLoopSource.stop();
    scanLoopSource = null;
  }
}

export function playImageScanLoop(): { stop: () => void } {
  console.warn("[SoundEngine] playImageScanLoop requested but synthesized audio disabled. Skipping.");
  return { stop: () => {} };
}

export function playAudioScanLoop(): { stop: () => void } {
  console.warn("[SoundEngine] playAudioScanLoop requested but synthesized audio disabled. Skipping.");
  return { stop: () => {} };
}

export function playBinaryScanLoop(): { stop: () => void } {
  console.warn("[SoundEngine] playBinaryScanLoop requested but synthesized audio disabled. Skipping.");
  return { stop: () => {} };
}

let decypheringLoopSource: { stop: () => void } | null = null;

export function playDecypheringLoop() {
  if (decypheringLoopSource) return;
  console.log('[SoundEngine] Starting decyphering loop');
  const source = playSample('decyphering', true);
  if (source) {
    decypheringLoopSource = source;
  }
}

export function stopDecypheringLoop() {
  if (decypheringLoopSource) {
    console.log('[SoundEngine] Stopping decyphering loop');
    decypheringLoopSource.stop();
    decypheringLoopSource = null;
  }
}

// Silent No-ops
export function playDecryptResolve() {}
export function playFailBuzz() {}
export function playGlitchBurst() {}
export function playCaseSolvedSwell() {}
export function playStringThrum() {}
export function playDragThrum() {}
export function stopDragThrum() {}
export function playReticleLock() {}
export function playCountTick() {}
export function playParticleAssembly() {}
export function playMenuToggle() {}


export function syncAmbientDrone() {
  const ctx = getAudioContext();
  if (!ctx || !masterGainNode) return;
  const shouldPlay = currentAmbientEnabled && !currentMuted && currentVolume > 0;
  
  if (shouldPlay && !ambientActive) {
    ambientActive = true;
    
    // Synth texture REMOVED as per requirement
    
    // Start random background samples
    if (ambientBuffers.length > 0) {
      playNextAmbient();
    }
  } else if (!shouldPlay && ambientActive) {
    ambientActive = false;
    if (ambientSource) {
      try { ambientSource.stop(); } catch(e) {}
      ambientSource = null;
    }
    if (ambientTimeoutId) {
      clearTimeout(ambientTimeoutId);
      ambientTimeoutId = null;
    }
  }
}

function playNextAmbient() {
  if (!ambientActive || ambientBuffers.length === 0) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGainNode) return;
  
  if (ambientTimeoutId) {
    clearTimeout(ambientTimeoutId);
    ambientTimeoutId = null;
  }
  
  let nextIndex;
  do {
    nextIndex = Math.floor(Math.random() * ambientBuffers.length);
  } while (nextIndex === currentAmbientFileIndex && ambientBuffers.length > 1);
  currentAmbientFileIndex = nextIndex;

  const source = ctx.createBufferSource();
  source.buffer = ambientBuffers[currentAmbientFileIndex];
  source.loop = true;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.0); // Low volume
  
  source.connect(gain);
  gain.connect(masterGainNode);
  source.start();
  
  if (ambientSource) {
    const oldSource = ambientSource;
    const oldGain = ambientGainNode;
    oldGain?.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);
    setTimeout(() => {
        try { oldSource.stop(); } catch(e) {}
    }, 2000);
  }
  
  ambientSource = source;
  ambientGainNode = gain;
  
  // Play next random sample in 30-90 seconds for more active background
  ambientTimeoutId = setTimeout(playNextAmbient, 30000 + Math.random() * 60000); 
}
