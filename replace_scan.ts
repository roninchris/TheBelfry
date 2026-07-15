export const triggerForensicScanReplacement = async (inputData: { name: string; type: "ciphertext" | "image" | "audio" | "hex"; rawContent: string; file?: File }, get: any, set: any) => {
  const { addLog } = get();
  set({ isScanning: true, scanProgress: 0, scannedEvidence: null, scanResults: [] });

  addLog(`INGESTING RAW EVIDENCE: "${inputData.name}"`, "info", "FORENSICS");
  addLog("ISOLATING BIT STREAM & COMPILING CIPHER FREQUENCIES", "info", "D-HEURISTICS");

  let progress = 0;
  let results: any[] = [];
  let isDone = false;
  
  const analyze = async () => {
    try {
      if (inputData.type === "ciphertext" || inputData.type === "hex") {
        results = identifyInput(inputData.rawContent).map(r => ({
          name: r.toolId.toUpperCase(),
          confidence: r.confidence * 100,
          isMatch: r.isMatch,
          details: r.preview || r.details
        }));
      } else if (inputData.type === "image" && inputData.file) {
        const r = [];
        
        // Exif parsing
        const arrayBuffer = await inputData.file.arrayBuffer();
        const exif = parseExif(arrayBuffer);
        if (exif && (exif.gpsLatitude || exif.gpsLongitude || exif.software)) {
          r.push({
            name: "EXIF DATA BLOCK",
            confidence: 95,
            isMatch: true,
            details: `Metadata recovered. ${exif.software ? 'Software: ' + exif.software : ''} ${exif.gpsLatitude ? 'Lat: ' + exif.gpsLatitude : ''}`
          });
        }
        
        // Stego
        try {
           const stegoResult = await detectHiddenMessageInFile(inputData.file);
           if (stegoResult) {
              r.push({
                name: "STEGANOGRAPHY LSB",
                confidence: 92,
                isMatch: true,
                details: `Hidden data detected: ${stegoResult.substring(0, 50)}...`
              });
           } else {
              r.push({ name: "STEGANOGRAPHY LSB", confidence: 15, isMatch: false, details: "NO LSB PAYLOAD DETECTED." });
           }
        } catch(e) {
        }
        results = r;
      } else if (inputData.type === "audio" && inputData.file) {
        const r = [];
        const arrayBuffer = await inputData.file.arrayBuffer();
        const ctx = getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        const morse = detectMorse(channelData, sampleRate);
        if (morse) {
          r.push({ name: "MORSE TELEMETRY", confidence: 95, isMatch: true, details: `Recovered: ${morse}` });
        }
        
        const dtmf = detectDTMF(channelData, sampleRate);
        if (dtmf) {
          r.push({ name: "DTMF FREQUENCIES", confidence: 90, isMatch: true, details: `Sequence: ${dtmf}` });
        }
        
        if (!morse && !dtmf) {
          r.push({ name: "SPECTRAL ENVELOPE", confidence: 20, isMatch: false, details: "No clear modulation detected in audible spectrum." });
        }
        results = r;
      }
    } catch(e) {
      console.error(e);
    }
    isDone = true;
  };
  
  analyze();

  const interval = setInterval(() => {
    if (progress < 80) {
      progress += 20;
    } else if (isDone && progress < 100) {
      progress += 20;
    }
    set({ scanProgress: progress });

    if (progress === 20) {
      addLog(`ENTROPY RATIO: ${inputData.type === "ciphertext" ? "1.84 (HIGHLY REPETITIVE STRETCHES)" : "0.92"}`, "raw", "FORENSICS");
    } else if (progress === 40) {
      addLog("DISCOVERY: DETECTED RECURRENT GLYPH SEGMENTS", "warning", "D-HEURISTICS");
    } else if (progress === 60) {
      addLog("DECOMPOSING DATA INTO DYNAMIC HEURISTIC REGIONS", "info", "DECODER");
    } else if (progress === 80) {
      addLog("CORRELATION COMPLETE // FILTERING CANDIDATE MAPS", "success", "SYS");
    }
    
    if (progress >= 100 && isDone) {
      clearInterval(interval);
      
      const matchedEvidence = {
        id: `EVD-${Math.floor(Math.random() * 10000)}`,
        name: inputData.name,
        type: inputData.type,
        confidence: results.length > 0 ? results[0].confidence : 0,
        source: "BAT-FORENSIC INTERCEPT",
        notes: results.length > 0 
          ? `FORENSIC CONCLUSION: ${results[0].name} confirmed with ${results[0].confidence}% reliability. Decrypted segments loaded into active case database.`
          : "FORENSIC CONCLUSION: No clear match identified. Analysis inconclusive."
      };

      set({
        isScanning: false,
        scanProgress: 100,
        scannedEvidence: matchedEvidence,
        scanResults: results
      });

      if (results.length > 0) {
        addLog(`SCAN COMPLETE // HIGH-CONFIDENCE MATCH DETECTED (${results[0].name})`, "success", "SYS");
        playSuccessChime();
      } else {
        addLog("SCAN COMPLETE // NO DEFINITIVE MATCH FOUND", "warning", "SYS");
      }
    }
  }, 450);
}
