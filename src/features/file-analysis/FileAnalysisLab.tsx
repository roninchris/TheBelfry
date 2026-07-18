import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Upload,
  Binary,
  FileText,
  AlertTriangle,
  Database,
  Search,
  Plus,
  Compass,
  Trash2,
  Check,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Terminal as TerminalIcon,
  HardDrive,
  Download
} from "lucide-react";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import DecryptText from "../../components/ui/DecryptText";
import CorrelationNetwork from "../../components/ui/CorrelationNetwork";
import DataStream from "../../components/react-bits/DataStream";
import TreeGrowth from "../../components/react-bits/TreeGrowth";
import BinaryRain from "../../components/react-bits/BinaryRain";
import {
  playSuccessChime,
  playPinClick,
  playHoverBlip,
  playHoverEvidence,
  playFileAnalysisComplete,
  playFileAnalysisScanner,
  playScanOpen,
  playBinaryScanLoop,
  playBakeFailure
} from "../../lib/soundEngine";
import { useAppStore } from "../../store/appStore";
import { carveEmbeddedFiles, CarvedFile } from "../../lib/tools/fileCarving";

interface BinaryPreset {
  id: string;
  name: string;
  extension: string;
  claimedType: string;
  detectedType: string;
  magicBytes: string;
  entropy: number;
  isMismatch: boolean;
  fileSize: string;
  date: string;
  badgeLabel: string;
  hexData: { offset: string; hex: string; ascii: string }[];
  detectedStrings: { offset: string; stringVal: string; category: "SYSTEM" | "PAYLOAD" | "SECURITY" }[];
  threatSummary: string;
}

const TACTICAL_BINARY_PRESETS: BinaryPreset[] = [];

/**
 * The dropzone has always advertised "MAX 10MB" but nothing enforced it. A
 * larger file walked the whole buffer byte-by-byte in extractStringsAsync,
 * which yields to the UI thread only every 100KB — a 500MB drop locked the tab
 * for minutes with no way to cancel and no indication anything was wrong.
 */
const MAX_CARRIER_BYTES = 10 * 1024 * 1024;

// Sector sweep geometry. Offsets read left-to-right, top-to-bottom, so the map
// is laid out the same way the hex dump below it is.
const SECTOR_COLS = 24;
const SECTOR_ROWS = 9;
const SECTOR_TOTAL = SECTOR_COLS * SECTOR_ROWS;

interface CarrierRejection {
  code: "OVERSIZE" | "EMPTY" | "UNREADABLE";
  headline: string;
  detail: string;
}

export default function FileAnalysisLab() {
  const cases = useAppStore((state) => state.cases);
  const activeCaseId = useAppStore((state) => state.activeCaseId);
  const addEvidenceNode = useAppStore((state) => state.addEvidenceNode);
  const addLog = useAppStore((state) => state.addLog);
  const setModule = useAppStore((state) => state.setModule);

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Scanning states
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("");
  const [scanComplete, setScanComplete] = useState(false); // Starts unparsed

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Custom dynamically loaded file analysis states
  const [customMetadata, setCustomMetadata] = useState<any | null>(null);
  const [carvedFiles, setCarvedFiles] = useState<CarvedFile[]>([]);
  const [rejection, setRejection] = useState<CarrierRejection | null>(null);
  // Real byte-frequency histogram of the loaded carrier, kept for the entropy
  // strip so that readout is driven by the file rather than decorated.
  const [byteHistogram, setByteHistogram] = useState<number[] | null>(null);
  // Live sector sweep. Each entry is one sector's normalised entropy, appended
  // as the inspector actually reaches and measures it.
  const [sectorMap, setSectorMap] = useState<number[]>([]);
  const carrierBytesRef = useRef<Uint8Array | null>(null);
  const scanSoundRef = useRef<{ stop: () => void } | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Current active data lookup
  const currentData = useMemo(() => {
    if (selectedPresetId) {
      return TACTICAL_BINARY_PRESETS.find(p => p.id === selectedPresetId) || null;
    }
    if (customMetadata) {
      return customMetadata;
    }
    if (activeFile) {
      // Return a temporary placeholder while reading
      return {
        id: "custom-upload-loading",
        name: activeFile.name,
        extension: "." + activeFile.name.split(".").pop()?.toLowerCase(),
        claimedType: activeFile.type || "Generic Binary Package",
        detectedType: "Analyzing...",
        magicBytes: "00 00 00 00",
        entropy: 0,
        isMismatch: false,
        fileSize: `${(activeFile.size / 1024).toFixed(1)} KB`,
        date: "Analyzing...",
        badgeLabel: "READING CARRIER STREAM...",
        hexData: [],
        detectedStrings: [],
        threatSummary: "Reading stream blocks..."
      };
    }
    return null;
  }, [selectedPresetId, customMetadata, activeFile]);

  // Handle Drag Events (page-wide: attached to lab root, not just the upload box)
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
      loadCustomFile(e.dataTransfer.files[0]);
    }
  };

  // Convert custom uploaded file into real binary sector simulation
  const rejectCarrier = (code: CarrierRejection["code"], headline: string, detail: string) => {
    playBakeFailure();
    setRejection({ code, headline, detail });
    setActiveFile(null);
    setCustomMetadata(null);
    setByteHistogram(null);
    setCarvedFiles([]);
    setSectorMap([]);
    carrierBytesRef.current = null;
    setScanComplete(false);
    addLog(`CARRIER REJECTED (${code}): ${headline}`, "warning", "SYS");
  };

  const loadCustomFile = (file: File) => {
    if (file.size === 0) {
      rejectCarrier(
        "EMPTY",
        "CARRIER HOLDS NO BYTES",
        `'${file.name}' reports a length of zero. There is no stream to parse — the container is empty or the source truncated it in transit.`,
      );
      return;
    }
    if (file.size > MAX_CARRIER_BYTES) {
      rejectCarrier(
        "OVERSIZE",
        "CARRIER EXCEEDS BUFFER CEILING",
        `'${file.name}' is ${(file.size / 1024 / 1024).toFixed(1)} MB. The buffer port accepts up to ${MAX_CARRIER_BYTES / 1024 / 1024} MB — string extraction walks every byte, and a stream this size would stall the console.`,
      );
      return;
    }

    playScanOpen();
    setRejection(null);
    setActiveFile(file);
    setSelectedPresetId(null);
    setScanComplete(false);
    setScanProgress(0);
    setByteHistogram(null);

    const reader = new FileReader();
    reader.onerror = () => {
      rejectCarrier(
        "UNREADABLE",
        "STREAM READ FAILED",
        `The host denied or aborted the read on '${file.name}'. The file may have been moved, locked by another process, or revoked mid-transfer.`,
      );
    };
    reader.onload = async (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const fullBytes = new Uint8Array(buffer);
      const bytes = new Uint8Array(buffer.slice(0, 256)); // Grab first 256 bytes

      // Format true magic bytes hex string
      const hexStrings: string[] = [];
      bytes.slice(0, 16).forEach(b => {
        hexStrings.push(b.toString(16).toUpperCase().padStart(2, "0"));
      });
      const formattedMagic = hexStrings.join(" ");

      // Detect magic file signature type
      let trueType = "Unknown Binary Data Stream";
      let isMismatchState = false;
      const extension = "." + file.name.split(".").pop()?.toLowerCase();

      // Expanded header sniffing
      const headerHex = formattedMagic.toUpperCase();
      
      if (headerHex.startsWith("89 50 4E 47")) {
        trueType = "PNG Image (Lossless compression)";
        if (extension !== ".png") isMismatchState = true;
      } else if (headerHex.startsWith("FF D8 FF")) {
        trueType = "JPEG Image (Lossy compression)";
        if (extension !== ".jpg" && extension !== ".jpeg") isMismatchState = true;
      } else if (headerHex.startsWith("47 49 46")) {
        trueType = "GIF Image (Graphics Interchange Format)";
        if (extension !== ".gif") isMismatchState = true;
      } else if (headerHex.startsWith("4D 5A")) {
        trueType = "Windows PE/EXE (Executable Binary payload)";
        if (extension !== ".exe" && extension !== ".dll") isMismatchState = true;
      } else if (headerHex.startsWith("25 50 44 46")) {
        trueType = "PDF Document (Acrobat Container)";
        if (extension !== ".pdf") isMismatchState = true;
      } else if (headerHex.startsWith("50 4B 03 04")) {
        trueType = "ZIP Archive / Office OpenXML Container";
        if (extension !== ".zip" && extension !== ".docx" && extension !== ".pptx" && extension !== ".xlsx") {
          isMismatchState = true;
        }
      } else if (headerHex.startsWith("42 4D")) {
        trueType = "BMP Image (Windows Bitmap)";
        if (extension !== ".bmp") isMismatchState = true;
      } else if (headerHex.startsWith("52 49 46 46") && headerHex.includes("57 41 56 45")) {
        trueType = "WAV Audio (Waveform Audio File)";
        if (extension !== ".wav") isMismatchState = true;
      } else if (headerHex.startsWith("52 61 72 21 1A 07")) {
        trueType = "RAR Archive (Roshal Archive)";
        if (extension !== ".rar") isMismatchState = true;
      } else if (headerHex.startsWith("37 7A BC AF 27 1C")) {
        trueType = "7z Archive (7-Zip compressed)";
        if (extension !== ".7z") isMismatchState = true;
      } else if (headerHex.startsWith("1F 8B")) {
        trueType = "GZIP Compressed (GNU Zip)";
        if (extension !== ".gz") isMismatchState = true;
      } else if (headerHex.startsWith("7F 45 4C 46")) {
        trueType = "ELF Binary (Executable and Linkable Format)";
        if (extension !== ".elf" && extension !== "") isMismatchState = true;
      } else {
        // Plain text scan check
        let isText = true;
        for (let i = 0; i < Math.min(bytes.length, 50); i++) {
          if (bytes[i] < 32 && bytes[i] !== 10 && bytes[i] !== 13 && bytes[i] !== 9) {
            isText = false;
            break;
          }
        }
        if (isText) {
          trueType = "ASCII Plaintext Characters";
        }
      }

      // Calculate real Shannon entropy of full file
      // Returns the histogram alongside the score — the entropy strip renders
      // the same distribution the number is derived from, so the visual can
      // never drift from the readout.
      const calculateFileEntropy = (arr: Uint8Array) => {
        const counts = new Uint32Array(256);
        const len = arr.length;
        if (len === 0) return { entropy: 0, counts };
        for (let i = 0; i < len; i++) {
          counts[arr[i]]++;
        }
        let entropy = 0;
        for (let j = 0; j < 256; j++) {
          if (counts[j] > 0) {
            const p = counts[j] / len;
            entropy -= p * Math.log2(p);
          }
        }
        return { entropy: +entropy.toFixed(2), counts };
      };
      const { entropy: realEntropy, counts: byteCounts } = calculateFileEntropy(fullBytes);
      setByteHistogram(Array.from(byteCounts));

      // Generate simulated hex dump rows from the actual loaded file bytes
      const generatedHexRows: any[] = [];
      for (let offsetIndex = 0; offsetIndex < bytes.length; offsetIndex += 16) {
        const chunk = bytes.slice(offsetIndex, offsetIndex + 16);
        const hexParts: string[] = [];
        let asciiStr = "";
        
        chunk.forEach(b => {
          hexParts.push(b.toString(16).toUpperCase().padStart(2, "0"));
          asciiStr += (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".";
        });

        // Padding if last row is incomplete
        while (hexParts.length < 16) {
          hexParts.push("  ");
        }

        const offsetStr = offsetIndex.toString(16).toUpperCase().padStart(8, "0");
        generatedHexRows.push({
          offset: offsetStr,
          hex: hexParts.slice(0, 8).join(" ") + "  " + hexParts.slice(8).join(" "),
          ascii: asciiStr
        });
      }

      // Async string extraction to avoid blocking UI for large files
      const extractStringsAsync = async (data: Uint8Array): Promise<any[]> => {
        const strings: any[] = [];
        let currentString = "";
        let stringStartOffset = 0;
        const chunkSize = 100000; // Process in 100KB chunks

        for (let i = 0; i < data.length; i++) {
          const b = data[i];
          if (b >= 32 && b <= 126) {
            if (currentString === "") stringStartOffset = i;
            currentString += String.fromCharCode(b);
          } else {
            if (currentString.length >= 4) {
              strings.push({
                offset: "0x" + stringStartOffset.toString(16).toUpperCase().padStart(8, "0"),
                stringVal: currentString,
                category: currentString.includes("SYSTEM") || currentString.includes("SYS") || currentString.includes("KERNEL") ? "SYSTEM" :
                          currentString.includes("KEY") || currentString.includes("PASSWORD") || currentString.includes("SECRET") ? "SECURITY" : "PAYLOAD"
              });
            }
            currentString = "";
          }

          // Yield to UI thread every chunkSize bytes
          if (i > 0 && i % chunkSize === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }

        if (currentString.length >= 4) {
          strings.push({
            offset: "0x" + stringStartOffset.toString(16).toUpperCase().padStart(8, "0"),
            stringVal: currentString,
            category: "PAYLOAD"
          });
        }
        
        return strings;
      };

      const foundStrings = await extractStringsAsync(fullBytes);

      // Add a fallback strings array if none found
      if (foundStrings.length === 0) {
        foundStrings.push({ offset: "0x00000000", stringVal: `RAW_FILE_STREAM_${file.name.toUpperCase()}`, category: "SYSTEM" });
      }

      setCustomMetadata({
        id: "custom-upload",
        name: file.name,
        extension,
        claimedType: file.type || "Generic Binary Package",
        detectedType: trueType,
        magicBytes: formattedMagic,
        entropy: realEntropy,
        isMismatch: isMismatchState,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        date: new Date().toISOString().replace("T", " ").slice(0, 19),
        badgeLabel: isMismatchState ? "HIGH RISK - SIGNATURE MISMATCH" : "VERIFIED - SEAL INTEGRITY OK",
        hexData: generatedHexRows,
        detectedStrings: foundStrings,
        threatSummary: isMismatchState 
          ? `WARNING MISMATCH DETECTED: File claims to be '${extension}', but the parsed binary signature points to '${trueType}'. This mismatch typically indicates intentional payload wrapping designed to mask executable codes or launch scripts inside an innocent file vessel.`
          : `FILE IS VALIDATED: Parsed character envelopes and hexadecimal structures match the claimed '${extension}' extension signature.`
      });

      // Kept so the inspector sweep has real bytes to walk — it computes
      // per-sector entropy live rather than animating a counter.
      carrierBytesRef.current = fullBytes;

      addLog(`PARSED HEX HEADERS FOR UPLOADED CARRIER: ${file.name.toUpperCase()}`, "info", "SYS");
      
      // Initial carving
      const carved = carveEmbeddedFiles(buffer);
      setCarvedFiles(carved);
    };
    reader.readAsArrayBuffer(file);
  };

  /**
   * Launch the inspector sweep.
   *
   * This used to tick a counter from 0 to 100 and then flip scanComplete — the
   * bar was pure theatre, unrelated to any work. It now walks the carrier in
   * SECTOR_TOTAL slices and computes each slice's Shannon entropy as it
   * arrives, so the head position, the progress figure and the sector map are
   * all the same real measurement. Every sector the sweep lights up is a
   * sector it actually just measured.
   */
  const triggerForensicScan = () => {
    const bytes = carrierBytesRef.current;
    if (!bytes) return;

    setIsScanning(true);
    setScanProgress(0);
    setScanComplete(false);
    setSectorMap([]);
    playFileAnalysisScanner();

    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const messages = [
      "SNIFFING header magic bytes...",
      "RECONSTRUCTING sector block offsets...",
      "PARSING printable ASCII character loops...",
      "COMPUTING Shannon byte entropy...",
      "MAPPING signature extension indices..."
    ];

    const sectorLen = Math.max(1, Math.ceil(bytes.length / SECTOR_TOTAL));

    /**
     * Ceiling to normalise each sector against.
     *
     * The naive choice is log2(256) = 8 bits, but a sector only holds a few
     * hundred bytes, and a few hundred samples spread over 256 bins cannot
     * reach 8 bits however random they are — measured, genuinely random
     * sectors topped out around 0.92 and the "packed" tier never fired at all.
     * Subtracting the finite-sample bias, (K-1)/(2N ln2), gives the entropy a
     * uniform stream of this size would actually be expected to show, so
     * saturation stays comparable across carriers of different sizes.
     */
    const bins = Math.min(256, sectorLen);
    const ceiling = Math.max(
      0.5,
      Math.log2(bins) - (bins - 1) / (2 * sectorLen * Math.LN2),
    );

    const sectorEntropy = (start: number) => {
      const end = Math.min(start + sectorLen, bytes.length);
      const counts = new Uint32Array(256);
      for (let i = start; i < end; i++) counts[bytes[i]]++;
      const len = end - start;
      if (len <= 0) return 0;
      let e = 0;
      for (let j = 0; j < 256; j++) {
        if (counts[j] > 0) {
          const p = counts[j] / len;
          e -= p * Math.log2(p);
        }
      }
      return Math.min(1, e / ceiling);
    };

    let sector = 0;
    const PER_TICK = 6;
    scanIntervalRef.current = setInterval(() => {
      const batch: number[] = [];
      for (let n = 0; n < PER_TICK && sector < SECTOR_TOTAL; n++, sector++) {
        batch.push(sectorEntropy(sector * sectorLen));
      }
      setSectorMap((prev) => [...prev, ...batch]);

      const progress = Math.round((sector / SECTOR_TOTAL) * 100);
      setScanProgress(progress);
      setScanMessage(messages[Math.min(messages.length - 1, Math.floor((progress / 100) * messages.length))]);

      if (sector >= SECTOR_TOTAL) {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setIsScanning(false);
        setScanComplete(true);
        playFileAnalysisComplete();
        // Read through the ref-free closure carefully: currentData is captured
        // at trigger time, and flushing the buffer mid-scan would null it.
        addLog(`COMPLETED DEEP BINARY INSPECTION ON ${currentData?.name ?? "CARRIER"}`, "success", "SYS");
      }
    }, 55);
  };

  // Add findings to dossier
  const handleAddToDossier = () => {
    const caseId = activeCaseId || (cases[0]?.id || "");
    if (!caseId) {
      addLog("CANNOT COMPLY: CHOOSE AN ACTIVE DOSSIER TARGET IN DATABASE FIRST", "warning", "SYS");
      return;
    }

    playPinClick();

    const noteContent = `### FILE SECTOR FORENSICS REPORT
**FILE CONTAINER**: ${currentData.name} (${currentData.fileSize})
**SIGNATURE VALIDATION**:
- Claimed extension: ${currentData.extension} (${currentData.claimedType})
- Real detected magic signature: ${currentData.detectedType}
- Magic Bytes: ${currentData.magicBytes}
- Mismatch status: ${currentData.isMismatch ? "ANOMALY RECOVERED" : "ALIGNED"}

**CARVED EMBEDDED FILES**:
${carvedFiles.length > 0 
  ? carvedFiles.map(f => `- ${f.type} at offset 0x${f.offset.toString(16).toUpperCase()}${f.length ? ` (${(f.length / 1024).toFixed(1)} KB)` : ""}`).join("\n")
  : "NONE DETECTED"}

**HEX DATA OFFSET CAPTURES**:
${currentData.hexData.slice(0, 5).map(h => `[${h.offset}]  ${h.hex}  |  ${h.ascii}`).join("\n")}

**EXTRACTED STRINGS PATTERNS**:
${currentData.detectedStrings.map(s => `- Offset ${s.offset}: "${s.stringVal}" (${s.category})`).join("\n")}

**ANALYSIS INTERPRETATION**:
${currentData.threatSummary}`;

    addEvidenceNode({
      type: "file",
      title: `HEX SECTOR DECRYPT: ${currentData.name}`,
      content: noteContent,
      x: 120 + Math.random() * 180,
      y: 120 + Math.random() * 180
    });

    addLog(`DUMPED HEX INSPECTOR FINDINGS TO CRIME SCENE EVIDENCE DATABASE`, "success", "SYS");
    setModule("detective-board");
  };

  // State-derived, not carrierBytesRef — a ref write does not re-render, so the
  // sector map would miss the transition out of its idle field. byteHistogram
  // is set and cleared at exactly the same points as the byte buffer.
  const carrierMounted = byteHistogram !== null;

  const clearFileBuffer = () => {
    playPinClick();
    setActiveFile(null);
    setSelectedPresetId(null);
    setScanComplete(false);
    setCustomMetadata(null);
    setRejection(null);
    setByteHistogram(null);
    setCarvedFiles([]);
    setSectorMap([]);
    carrierBytesRef.current = null;
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    setIsScanning(false);
  };

  return (
    <div
      className="h-full w-full p-4 grid grid-cols-12 gap-4 overflow-y-auto font-chakra select-none text-text-primary relative"
      id="file-analysis-root"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* Subtle global binary rain in background */}
      <BinaryRain density={15} color="rgb(var(--rgb-accent) / 0.05)" className="fixed inset-0 -z-10" />
      {dragActive && (
        <div className="fixed inset-0 z-[999] bg-bg-void/80 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="border-2 border-dashed border-cyan-primary bg-cyan-primary/5 px-12 py-10 flex flex-col items-center space-y-3">
            <span className="font-display text-sm font-black tracking-[0.2em] text-cyan-primary uppercase">
              RELEASE TO ANALYZE
            </span>
            <span className="font-share text-[13px] text-text-dim uppercase tracking-widest">
              Drop file anywhere on screen
            </span>
          </div>
        </div>
      )}
      
      {/* ================= LEFT COLUMN: BINARY UPLOADER ================= */}
      <div className="col-span-12 xl:col-span-3 flex flex-col space-y-4 min-h-0">
        
        {/* Header Block */}
        <GlassPanel className="p-4 flex flex-col justify-between" clipSize="sm" showCornerTicks={true}>
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-4 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_8px_var(--color-accent-primary)]" />
                <h1 className="font-display text-sm font-black tracking-widest text-cyan-text uppercase">
                  FILE SECTOR INTEGRITY LAB
                </h1>
              </div>
              <p className="text-[13px] text-text-dim uppercase tracking-wider font-share mt-1 leading-relaxed">
                Belfry Hexadecimal Diagnostics Engine. Parses file binary streams to isolate hidden extensions, cross-checks magic byte signatures, and extracts character strings.
              </p>
            </div>
            <Badge variant="cyan" size="xs">
              HEX DUMP CORE
            </Badge>
          </div>
        </GlassPanel>

        {/* Dropzone Container */}
        <GlassPanel 
          // Bounded. As flex-1 with only a floor this stretched to the column
          // height — measured 1124px with 874px of empty panel under its
          // content. A drop target wants to be generous, not unbounded.
          className={`p-4 flex-1 flex flex-col min-h-[320px] max-h-[560px] relative overflow-hidden transition-all duration-300 ${
            dragActive ? "border-cyan-primary/70 bg-cyan-primary/[0.04]" : "border-border-hairline/20"
          }`}
          // @ts-ignore
          onDragEnter={handleDrag}
          // @ts-ignore
          onDragOver={handleDrag}
          // @ts-ignore
          onDragLeave={handleDrag}
          // @ts-ignore
          onDrop={handleDrop}
          clipSize="md"
        >
          {/* Scanner Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-cyan-primary/[0.02] border border-cyan-primary/20 pointer-events-none overflow-hidden z-20">
              <div className="absolute inset-x-0 h-0.5 bg-cyan-primary/40 shadow-[0_0_8px_var(--color-accent-primary)] animate-scanline-vertical" />
            </div>
          )}

          <div className="border-b border-border-hairline/20 pb-2 mb-3 flex justify-between items-center">
            <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
              <Binary className="w-3.5 h-3.5 mr-2 text-cyan-primary animate-hex-pulse-flicker" />
              BINARY BUFFER PORT
            </h3>
            {activeFile && (
              <button
                onClick={clearFileBuffer}
                className="text-[12px] hover:text-red-threat text-text-dim uppercase transition-colors flex items-center"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Flush Buffer
              </button>
            )}
          </div>

          {rejection ? (
            /* Carrier refused at the port — an in-fiction alert, not a form error. */
            <div className="flex-1 flex flex-col items-center justify-center text-center border border-amber-alert/40 bg-amber-alert/[0.04] p-6 relative overflow-hidden animate-fade-in">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-alert/50 shadow-[0_0_8px_var(--color-alert)] animate-scanline-vertical pointer-events-none" />
              <div className="w-14 h-14 border border-amber-alert/40 flex items-center justify-center mb-3 bg-bg-void relative">
                <AlertTriangle className="w-6 h-6 text-amber-alert animate-hex-pulse-flicker" />
              </div>
              <span className="font-display text-xs font-black tracking-widest text-amber-alert uppercase">
                {rejection.headline}
              </span>
              <span className="font-mono text-[12px] text-amber-alert/60 uppercase tracking-widest mt-1">
                PORT CODE {rejection.code}
              </span>
              <p className="text-[13px] text-text-dim font-share tracking-wider mt-3 leading-relaxed max-w-xs">
                {rejection.detail}
              </p>
              <button
                onClick={() => {
                  playPinClick();
                  setRejection(null);
                }}
                className="hud-target mt-5 px-5 py-2 border border-amber-alert/40 text-amber-alert hover:bg-amber-alert hover:text-bg-void transition-all duration-200 text-[13px] font-black tracking-widest font-display uppercase"
                style={{ clipPath: "polygon(0 0, 100% 0, 94% 100%, 0 100%)" }}
              >
                CLEAR PORT
              </button>
            </div>
          ) : !activeFile && !selectedPresetId ? (
            // Upload Dropzone
            <div
              onClick={() => fileInputRef.current?.click()}
              className="hud-target flex-1 flex flex-col items-center justify-center border border-dashed border-cyan-primary/30 hover:border-cyan-primary/60 cursor-pointer bg-bg-void/40 hover:bg-cyan-primary/[0.02] p-6 transition-all duration-300 group"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    loadCustomFile(e.target.files[0]);
                  }
                }}
                className="hidden" 
              />
              <div className="w-14 h-14 rounded-full border border-cyan-primary/25 flex items-center justify-center mb-3 bg-bg-void relative group-hover:scale-105 group-hover:border-cyan-primary/55 transition-all duration-300">
                <Upload className="w-6 h-6 text-cyan-primary/70 group-hover:text-cyan-primary" />
              </div>
              <span className="font-display text-xs font-black tracking-widest text-cyan-text group-hover:text-white transition-colors">
                DROP ANY FILE VESSEL HERE
              </span>
              <span className="text-[13px] text-text-dim uppercase tracking-widest font-share mt-1">
                OR CLICK TO DISCOVER LOCAL SYSTEM BINARIES
              </span>
              <span className="text-[12px] text-cyan-primary/50 mt-4 font-mono">
                COMPATIBLE: .EXE, .LOG, .TXT, .PNG, .JPG, .ZIP, ETC. (MAX 10MB)
              </span>
            </div>
          ) : (
            // Loaded File State Panel
            <div className="flex-1 flex flex-col justify-between">
              
              {/* Retro HUD Drive Card representing file vessel storage */}
              <div className="bg-bg-void/50 border border-border-hairline/15 p-4 rounded-none flex items-center space-x-4 relative overflow-hidden mb-3">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-primary/[0.02] to-transparent pointer-events-none" />
                
                {/* Sector disk glyph */}
                <div className="w-14 h-14 border border-cyan-primary/30 rounded-none bg-bg-void relative flex items-center justify-center shrink-0">
                  <HardDrive className="w-7 h-7 text-cyan-primary/70" />
                  <div className="absolute top-1 left-1 w-1 h-1 bg-green-verified rounded-full" />
                  <div className="absolute top-1 right-1 w-1 h-1 bg-cyan-primary rounded-full animate-ping-cyan" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-mono text-cyan-primary uppercase tracking-widest block mb-0.5">
                    RECOVERED VESSEL
                  </span>
                  <h4 className="font-mono text-xs font-bold text-text-primary truncate uppercase">
                    {currentData.name}
                  </h4>
                  <p className="font-share text-[12px] text-text-dim uppercase tracking-wider mt-0.5">
                    CLAIMED: {currentData.extension} ({currentData.fileSize})
                  </p>
                </div>
              </div>

              {/* True signature vs claimed signature readout */}
              <div className="space-y-2.5">
                
                {/* Claims and Reality check */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="border border-border-hairline/10 bg-bg-void/30 p-2 text-[13px] font-mono">
                    <span className="text-text-dim block text-[12px] uppercase">Declared Envelope:</span>
                    <span className="text-text-primary font-bold uppercase">{currentData.extension}</span>
                    <span className="text-text-dim block text-[12px] truncate mt-1">{currentData.claimedType}</span>
                  </div>

                  <div className={`border p-2 text-[13px] font-mono ${
                    currentData.isMismatch 
                      ? "bg-red-threat/10 border-red-threat/30" 
                      : "bg-green-verified/10 border-green-verified/30"
                  }`}>
                    <span className="text-text-dim block text-[12px] uppercase">Detected Structure:</span>
                    <span className={`font-bold uppercase ${
                      currentData.isMismatch ? "text-red-threat" : "text-green-verified"
                    }`}>
                      {currentData.detectedType.split(" ")[0]}
                    </span>
                    <span className="text-text-dim block text-[12px] truncate mt-1">{currentData.detectedType}</span>
                  </div>
                </div>

                {/* Technical specifics */}
                <div className="bg-bg-void/40 border border-border-hairline/10 p-2.5 font-mono text-[13px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-text-dim">FIRST magic bytes:</span>
                    <span className="text-cyan-primary tracking-widest text-[12px] truncate max-w-[190px]">{currentData.magicBytes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-dim">BYTE ENTROPY SCALE:</span>
                    <span className={currentData.entropy > 7 ? "text-amber-alert" : "text-cyan-text"}>
                      {currentData.entropy} bits/byte
                    </span>
                  </div>

                  {/* Byte-distribution strip — the actual histogram the entropy
                      score above is computed from, bucketed to 64 bins and log
                      scaled so a flat encrypted/compressed stream reads as an
                      even wall while structured text stays visibly spiky. */}
                  {byteHistogram && (
                    <div className="pt-1.5">
                      <div className="flex items-end gap-px h-8 bg-bg-void/60 border border-border-hairline/10 px-1 pt-1">
                        {(() => {
                          const bins = Array.from({ length: 64 }, (_, b) =>
                            byteHistogram
                              .slice(b * 4, b * 4 + 4)
                              .reduce((sum, n) => sum + n, 0),
                          );
                          const peak = Math.max(...bins, 1);
                          return bins.map((count, b) => {
                            const ratio = count === 0 ? 0 : Math.log2(count + 1) / Math.log2(peak + 1);
                            return (
                              <div
                                key={b}
                                className={`flex-1 min-w-0 transition-all duration-500 ${
                                  count === 0 ? "bg-border-hairline/20" : "bg-cyan-primary"
                                }`}
                                style={{
                                  height: `${Math.max(ratio * 100, count === 0 ? 4 : 8)}%`,
                                  opacity: count === 0 ? 1 : 0.35 + ratio * 0.65,
                                }}
                                title={`0x${(b * 4).toString(16).toUpperCase().padStart(2, "0")}–0x${(b * 4 + 3).toString(16).toUpperCase().padStart(2, "0")}: ${count}`}
                              />
                            );
                          });
                        })()}
                      </div>
                      <div className="flex justify-between text-[12px] text-text-dim/60 tracking-widest mt-1">
                        <span>0x00</span>
                        <span>BYTE VALUE DISTRIBUTION</span>
                        <span>0xFF</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Inspection progress rail. The scan already tracked progress and
                  stage narration in state, but neither was ever rendered — the
                  only sign the console was working was the button label. */}
              {isScanning && (
                <div className="mt-3 border border-cyan-primary/25 bg-cyan-primary/[0.03] p-2.5 relative overflow-hidden">
                  <div className="flex justify-between items-center font-mono text-[12px] tracking-widest mb-1.5">
                    <span className="text-cyan-primary uppercase flex items-center">
                      <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                      INSPECTING SECTORS
                    </span>
                    <span className="text-cyan-text tabular-nums">{scanProgress}%</span>
                  </div>
                  <div className="h-1 bg-bg-void border border-border-hairline/10 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-cyan-primary shadow-[0_0_8px_var(--color-accent-primary)] transition-[width] duration-100 ease-linear"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                  <div className="font-share text-[12px] text-text-dim uppercase tracking-wider mt-1.5 truncate">
                    {scanMessage}
                  </div>
                </div>
              )}

              {/* Decrypter Action Trigger */}
              <div className="mt-auto pt-4 border-t border-border-hairline/10">
                <button
                  disabled={isScanning}
                  onClick={triggerForensicScan}
                  className="hud-target w-full py-3 bg-cyan-primary text-bg-void hover:bg-white hover:shadow-[0_0_20px_rgb(var(--rgb-accent) / 0.6)] active:scale-[0.98] transition-all duration-200 text-xs font-black tracking-widest font-display uppercase disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2 relative z-10"
                  style={{ clipPath: "polygon(0 0, 100% 0, 96% 100%, 0 100%)" }}
                >
                  <Cpu className={`w-4 h-4 text-bg-void ${isScanning ? 'animate-radar-sweep' : ''}`} />
                  <span>{isScanning ? 'INSPECTING...' : 'LAUNCH HEURISTIC FILE INSPECTOR'}</span>
                </button>
              </div>

            </div>
          )}
        </GlassPanel>

        {/* ================= CARRIER SECTOR MAP =================
            Fills the dead space under the buffer port, and doubles as the
            inspector's readout: during a sweep each cell lights as its sector
            is actually measured, so the animation is the work rather than a
            decoration laid over it. With no carrier mounted it idles as an
            ambient field. */}
        <GlassPanel className="p-4 flex flex-col" clipSize="sm">
          <div className="border-b border-border-hairline/20 pb-2 mb-3 flex justify-between items-center">
            <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
              <Compass className={`w-3.5 h-3.5 mr-2 text-cyan-primary ${isScanning ? "animate-radar-sweep" : ""}`} />
              CARRIER SECTOR MAP
            </h3>
            <span className="font-mono text-[12px] text-text-dim tracking-widest tabular-nums">
              {carrierMounted                ? `${sectorMap.length}/${SECTOR_TOTAL}`
                : "IDLE"}
            </span>
          </div>

          <div
            className="grid gap-px bg-bg-void/60 border border-border-hairline/10 p-1.5"
            style={{ gridTemplateColumns: `repeat(${SECTOR_COLS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: SECTOR_TOTAL }, (_, idx) => {
              const measured = idx < sectorMap.length;
              const isHead = isScanning && idx === sectorMap.length - 1;
              const entropy = measured ? sectorMap[idx] : 0;

              // No carrier: ambient field. The stagger runs on the diagonal so
              // the flicker drifts across the grid instead of pulsing as one
              // block.
              if (!carrierMounted) {
                const row = Math.floor(idx / SECTOR_COLS);
                const col = idx % SECTOR_COLS;
                return (
                  <div
                    key={idx}
                    className="aspect-square bg-cyan-primary/20 animate-hex-pulse-flicker"
                    style={{ animationDelay: `${((row + col) % 12) * 0.35}s` }}
                  />
                );
              }

              return (
                <div
                  key={idx}
                  title={
                    measured
                      ? `SECTOR ${idx} — ${(entropy * 100).toFixed(0)}% saturation`
                      : `SECTOR ${idx} — unmeasured`
                  }
                  className={`aspect-square transition-all duration-300 ${
                    isHead
                      ? "bg-white shadow-[0_0_8px_var(--color-accent-primary)] scale-125 relative z-10"
                      : measured
                        ? entropy > 0.92
                          ? "bg-amber-alert"
                          : "bg-cyan-primary"
                        : "bg-border-hairline/15"
                  }`}
                  style={
                    measured && !isHead
                      ? { opacity: 0.22 + entropy * 0.78 }
                      : undefined
                  }
                />
              );
            })}
          </div>

          <div className="flex justify-between items-center text-[12px] text-text-dim/60 font-mono tracking-widest mt-1.5">
            <span>0x00000000</span>
            <span className="uppercase">
              {isScanning
                ? "SWEEPING"
                : scanComplete
                  ? "SWEEP COMPLETE"
                  : carrierMounted
                    ? "AWAITING SWEEP"
                    : "NO CARRIER"}
            </span>
            <span>EOF</span>
          </div>

          {/* Legend only earns its space once there is something to read. */}
          {sectorMap.length > 0 && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border-hairline/10 text-[12px] font-mono text-text-dim/70 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-cyan-primary" style={{ opacity: 0.3 }} />
                Low
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-cyan-primary" />
                Dense
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-amber-alert" />
                Packed / encrypted
              </span>
            </div>
          )}
        </GlassPanel>

      </div>

      {/* ================= RIGHT COLUMN: HEX DUMP & DETECTED STRINGS ================= */}
      <div className="col-span-12 xl:col-span-9 flex flex-col space-y-4">
        
        {!currentData ? (
          /* Getting Started State */
          <GlassPanel className="p-8 flex-1 flex flex-col items-center justify-center text-center relative min-h-[460px]" clipSize="md">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-primary/[0.02] to-transparent pointer-events-none" />
            <div className="w-16 h-16 border border-dashed border-cyan-primary/25 rounded-full flex items-center justify-center relative animate-radar-sweep mb-4" style={{ animationDuration: "40s" }}>
              <Binary className="w-8 h-8 text-cyan-primary/40" />
              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-cyan-primary rounded-full animate-ping-cyan" />
            </div>
            <h2 className="font-display text-sm font-black tracking-widest text-cyan-text uppercase">
              AWAITING BINARY CARRIER TARGET
            </h2>
            <p className="text-xs text-text-dim font-share uppercase tracking-widest max-w-sm mt-1.5 leading-relaxed">
              Load an external file into the binary buffer port to parse byte alignments, verify magic-byte signatures, and extract hidden characters.
            </p>
            <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-cyan-primary/30 to-transparent mt-6" />
          </GlassPanel>
        ) : (
          /* Analysis Active Views */
          <>
            {/* Hex Dump Viewer Panel */}
            <GlassPanel className="p-4 flex flex-col min-h-[300px] flex-1" clipSize="md">
              <div className="border-b border-border-hairline/20 pb-2 mb-3.5 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-3.5 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                  <h3 className="font-display text-xs font-black tracking-widest text-cyan-text uppercase">
                    HEXADECIMAL SECTOR MAP (OFFSET / BYTES / CHARS)
                  </h3>
                </div>
                
                <Badge variant={currentData.isMismatch ? "red" : "green"}>
                  {scanComplete ? currentData.badgeLabel : "ANALYSIS INCOMPLETE"}
                </Badge>
              </div>

              {!scanComplete && !isScanning ? (
                /* Pre-Scan State Awaiting Trigger */
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 border border-dashed border-border-hairline/15 bg-bg-void/25">
                  <TerminalIcon className="w-10 h-10 text-cyan-primary/20 animate-hex-pulse-flicker mb-3" />
                  <span className="font-display text-xs font-bold text-text-dim uppercase tracking-wider">
                    FILE BUFFER MOUNTED - AWAITING INSPECTION
                  </span>
                  <p className="text-[13px] text-text-dim uppercase tracking-widest font-share max-w-xs mt-1 leading-relaxed">
                    Press "LAUNCH HEURISTIC FILE INSPECTOR" in the left panel to verify byte signatures and decrypt hexadecimal sectors.
                  </p>
                </div>
              ) : (
                // The Scrollable Hex Dump Viewport (shown during scanning or after completion)
                <div className="flex-1 flex flex-col justify-between font-share">
                  
                  {/* Header headers for offsets */}
                  <div className="bg-bg-void border-b border-border-hairline/20 p-2 font-share text-[12px] text-cyan-text/75 grid grid-cols-12 gap-1 tracking-widest select-none">
                    <div className="col-span-2">OFFSET</div>
                    <div className="col-span-7 text-center">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</div>
                    <div className="col-span-3 text-right">ASCII_DECODE</div>
                  </div>

                  {/* Actual rows using strict font-share alignment */}
                  <div className="flex-1 overflow-y-auto max-h-[220px] font-share text-[13px] text-text-dim bg-bg-void/70 border border-border-hairline/10 p-2 divide-y divide-border-hairline/5 space-y-1 select-text scrollbar-thin relative overflow-hidden">
                    {scanComplete && (
                      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent via-cyan-primary/20 to-cyan-primary/50 border-b border-cyan-primary animate-scanline-sweep pointer-events-none z-10 mix-blend-screen" />
                    )}
                    {isScanning && (
                      <div className="absolute inset-0 pointer-events-none z-10 mix-blend-screen bg-cyan-primary/[0.01]">
                        <div className="absolute inset-x-0 h-0.5 bg-cyan-primary/40 shadow-[0_0_8px_var(--color-accent-primary)] animate-scanline-vertical" />
                      </div>
                    )}
                    {currentData.hexData.map((row, idx) => {
                      const isRelevant = idx === 0; // First row contains the magic bytes signature
                      return (
                      <div key={idx} className={`grid grid-cols-12 gap-1 py-1 hover:bg-cyan-primary/[0.03] transition-colors leading-none relative z-20 ${scanComplete && isRelevant ? 'bg-cyan-primary/[0.05]' : ''}`}>
                        <div className="col-span-2 text-cyan-text font-bold tracking-wider">{row.offset}</div>
                        
                        {/* Strict monospace spacing with font-share */}
                        <div className={`col-span-7 text-text-primary text-center tracking-wider font-medium font-share ${scanComplete && isRelevant ? 'animate-byte-flicker text-cyan-primary text-shadow-[0_0_8px_var(--color-accent-primary)]' : ''}`}>
                          {row.hex}
                        </div>
                        
                        <div className={`col-span-3 text-right font-bold truncate font-share ${scanComplete && isRelevant ? 'animate-byte-flicker text-cyan-primary text-shadow-[0_0_8px_var(--color-accent-primary)]' : 'text-cyan-primary/80'}`}>
                          {row.ascii}
                        </div>
                      </div>
                    )})}
                  </div>

                  {/* Warning anomaly box if signature mismatch */}
                  {scanComplete && (
                    <div className={`power-sweep mt-3 p-3 border font-mono text-[13px] flex items-start space-x-2 relative overflow-hidden ${
                      currentData.isMismatch
                        ? "bg-red-threat/10 border-red-threat/30 text-red-threat"
                        : "bg-bg-void/40 border-border-hairline/10 text-text-dim"
                    }`}>
                      <div className="absolute inset-0 opacity-25 pointer-events-none z-0">
                        <CorrelationNetwork nodeCount={14} connectionDistance={50} />
                      </div>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 relative z-10" />
                      <div className="min-w-0 flex-1 leading-relaxed relative z-10">
                        <span className="font-bold uppercase tracking-wider block mb-0.5">
                          {currentData.isMismatch ? "SIGNATURE WARNING DETECTED:" : "INTEGRITY SEAL VERIFIED:"}
                        </span>
                        {currentData.threatSummary}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </GlassPanel>

            {/* Lower row: strings extraction and dossier integration */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* ASCII Strings Extraction list */}
              <div className="md:col-span-12 xl:col-span-4">
                <GlassPanel className="p-4 flex flex-col justify-between min-h-[180px]" clipSize="sm">
                  <div>
                    <div className="border-b border-border-hairline/15 pb-1.5 mb-2.5 flex items-center">
                      <Search className="w-3.5 h-3.5 text-cyan-primary mr-1.5" />
                      <h4 className="font-display text-[13px] font-black tracking-widest text-cyan-text uppercase">
                        EXTRACTABLE ASCII CHARACTER STRINGS (LENGTH &gt;= 4)
                      </h4>
                    </div>

                    {!scanComplete ? (
                      isScanning ? (
                        /**
                         * This used to stream a hardcoded string of invented
                         * malware findings ("KEYLOG_SYS_HOOK",
                         * "TROJAN_VESSEL_DETECTED") over whatever the user had
                         * actually loaded — fabricated results presented as if
                         * they came off their file. It now streams the real
                         * extracted strings, which is both honest and better
                         * atmosphere: the buffer genuinely scrolls past.
                         */
                        <div className="py-5 font-mono text-[12px] text-cyan-primary">
                          <DataStream
                            text={
                              currentData.detectedStrings.length > 0
                                ? currentData.detectedStrings
                                    .slice(0, 24)
                                    .map((s: any) => `${s.offset}  ${s.stringVal}`)
                                    .join("     ")
                                : "WALKING CARRIER STREAM FOR PRINTABLE SEQUENCES..."
                            }
                            speed={12}
                            active={true}
                          />
                        </div>
                      ) : (
                        <div className="py-6 text-center text-[13px] text-text-dim uppercase font-mono">
                          Strings index matrix locked...
                        </div>
                      )
                    ) : (
                      <div className="overflow-y-auto max-h-[110px] space-y-1.5 pr-1 scrollbar-thin font-mono text-[12px]">
                        {currentData.detectedStrings.map((str: any, index: number) => (
                          <div 
                            key={index} 
                            className="flex items-start justify-between p-1 border border-border-hairline/5 bg-bg-void/30 hover:border-cyan-primary/20 hover:bg-cyan-primary/[0.01] transition-all"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <span className="text-cyan-text font-bold shrink-0">{str.offset}</span>
                              <span className="text-text-primary font-medium truncate" title={str.stringVal}>
                                "{str.stringVal}"
                              </span>
                            </div>
                            <Badge 
                              variant={str.category === "SECURITY" ? "red" : str.category === "PAYLOAD" ? "amber" : "cyan"} 
                              size="xs"
                            >
                              {str.category}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </GlassPanel>
              </div>

              {/* EMBEDDED FILE CARVING PANEL */}
              <div className="md:col-span-12 xl:col-span-4">
                <GlassPanel className="p-4 flex flex-col justify-between min-h-[180px]" clipSize="sm">
                  <div>
                    <div className="border-b border-border-hairline/15 pb-1.5 mb-2.5 flex items-center justify-between">
                      <div className="flex items-center">
                        <Binary className="w-3.5 h-3.5 text-amber-alert mr-1.5" />
                        <h4 className="font-display text-[13px] font-black tracking-widest text-amber-alert uppercase">
                          EMBEDDED FILE CARVING
                        </h4>
                      </div>
                      {scanComplete && carvedFiles.length > 0 && (
                        <Badge variant="amber" size="xs">{carvedFiles.length} DETECTED</Badge>
                      )}
                    </div>

                    {!scanComplete ? (
                      <div className="py-6 text-center text-[13px] text-text-dim uppercase font-mono">
                        {isScanning ? "Carving byte stream..." : "Awaiting scanner trigger..."}
                      </div>
                    ) : carvedFiles.length === 0 ? (
                      <div className="py-6 text-center text-[13px] text-text-dim uppercase font-mono italic">
                        No embedded files carved
                      </div>
                    ) : (
                      <div className="overflow-y-auto max-h-[110px] space-y-1.5 pr-1 scrollbar-thin font-mono text-[12px]">
                        {carvedFiles.map((file, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-1.5 border border-border-hairline/10 bg-bg-void/40 hover:border-amber-alert/40 transition-all"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-text-primary font-bold uppercase">{file.type}</span>
                                <span className="text-text-dim/60">0x{file.offset.toString(16).toUpperCase()}</span>
                              </div>
                              {file.length && (
                                <div className="text-[12px] text-text-dim/40">{(file.length / 1024).toFixed(1)} KB</div>
                              )}
                            </div>
                            
                            {file.length && (
                              <button
                                onClick={async () => {
                                  playPinClick();
                                  if (!activeFile) return;
                                  const buffer = await activeFile.arrayBuffer();
                                  const slice = buffer.slice(file.offset, file.offset + file.length);
                                  const blob = new Blob([slice], { type: 'application/octet-stream' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `carved_${file.offset}.${file.extension}`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="p-1 bg-amber-alert/10 text-amber-alert border border-amber-alert/20 hover:bg-amber-alert/20 transition-colors rounded"
                                title="Extract"
                              >
                                <Download size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </GlassPanel>
              </div>

              {/* Dossier saving action card */}
              <div className="md:col-span-12 xl:col-span-4">
                <GlassPanel className="p-4 h-full flex flex-col justify-between relative overflow-hidden" clipSize="sm">
                  {scanComplete && (
                    <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                      <TreeGrowth active={true} className="w-40 h-40" />
                    </div>
                  )}
                  <div className="border-b border-border-hairline/15 pb-1.5 mb-2.5 flex items-center">
                    <Database className="w-3.5 h-3.5 text-cyan-primary mr-1.5" />
                    <h4 className="font-display text-[13px] font-black tracking-widest text-cyan-text uppercase">
                      RECORD INTEGRATION
                    </h4>
                  </div>

                  {!scanComplete ? (
                    <div className="text-center py-6 font-mono text-[12px] text-text-dim uppercase">
                      {isScanning ? "Aligning sector maps..." : "Awaiting sector alignment..."}
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 flex flex-col justify-between">
                      <p className="text-[13px] text-text-dim uppercase tracking-wider leading-relaxed">
                        Commit the hex offsets, ASCII strings map, signature validation data, and file metadata into the active crime dossier database nodes.
                      </p>

                      <button
                        onClick={handleAddToDossier}
                        className="w-full py-1.5 border border-cyan-primary/30 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-all duration-200 text-[13px] uppercase tracking-widest font-black flex items-center justify-center space-x-1.5"
                        style={{ clipPath: "polygon(0 0, 100% 0, 94% 100%, 0 100%)" }}
                      >
                        <Plus className="w-3 h-3" />
                        <span>DUMP DISK FINDINGS</span>
                      </button>
                    </div>
                  )}
                </GlassPanel>
              </div>

            </div>
          </>
        )}

      </div>

    </div>
  );
}

