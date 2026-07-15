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
  playBinaryScanLoop
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

const TACTICAL_BINARY_PRESETS: BinaryPreset[] = [
  {
    id: "joker-scars-trojan",
    name: "batman_joker_scars.jpg",
    extension: ".jpg",
    claimedType: "JPEG Image (Lossy compressed)",
    detectedType: "PE32 Executable (Windows / Win32 Trojan Binary)",
    magicBytes: "4D 5A 90 00 03 00 00 00  04 00 00 00 FF FF 00 00",
    entropy: 7.91,
    isMismatch: true,
    fileSize: "1.42 MB",
    date: "2026-07-09 11:22:45",
    badgeLabel: "HIGH THREAT - EXTENSION MISMATCH",
    hexData: [
      { offset: "00000000", hex: "4D 5A 90 00 03 00 00 00  04 00 00 00 FF FF 00 00", ascii: "MZ.............." },
      { offset: "00000010", hex: "B8 00 00 00 00 00 00 00  40 00 00 00 00 00 00 00", ascii: "........@......." },
      { offset: "00000020", hex: "00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00", ascii: "................" },
      { offset: "00000030", hex: "00 00 00 00 00 00 00 00  00 00 00 00 80 00 00 00", ascii: "................" },
      { offset: "00000040", hex: "0E 1F BA 0E 00 B4 09 CD  21 B8 01 4C CD 21 54 68", ascii: "........!..L.!Th" },
      { offset: "00000050", hex: "69 73 20 70 72 6F 67 72  61 6D 20 63 61 6E 6E 6F", ascii: "is program canno" },
      { offset: "00000060", hex: "74 20 62 65 20 72 75 6E  20 69 6E 20 44 4F 53 20", ascii: "t be run in DOS " },
      { offset: "00000070", hex: "6D 6F 64 65 2E 0D 0D 0A  24 00 00 00 00 00 00 00", ascii: "mode....$......." },
      { offset: "000002A0", hex: "4B 45 52 4E 45 4C 33 32  2E 64 6C 6C 00 45 78 69", ascii: "KERNEL32.dll.Exi" },
      { offset: "000002B0", hex: "74 50 72 6F 63 65 73 73  00 00 57 72 69 74 65 46", ascii: "tProcess..WriteF" },
      { offset: "000003BC", hex: "47 4F 54 48 41 4D 5F 43  4F 4F 52 44 53 3A 20 34", ascii: "GOTHAM_COORDS: 4" },
      { offset: "000003CD", hex: "35 2E 31 30 39 2C 20 2D  37 33 2E 30 31 32 00 00", ascii: "5.109, -73.012.." },
      { offset: "00000E20", hex: "49 4E 49 54 49 41 54 45  5F 4F 56 45 52 52 49 44", ascii: "INITIATE_OVERRID" },
      { offset: "00000E30", hex: "45 5F 53 45 43 55 52 45  5F 47 52 49 44 5F 32 00", ascii: "E_SECURE_GRID_2." }
    ],
    detectedStrings: [
      { offset: "0x0000004F", stringVal: "This program cannot be run in DOS mode", category: "SYSTEM" },
      { offset: "0x000002A0", stringVal: "KERNEL32.dll", category: "SYSTEM" },
      { offset: "0x000002AB", stringVal: "ExitProcess", category: "SYSTEM" },
      { offset: "0x000002BA", stringVal: "WriteFile", category: "SYSTEM" },
      { offset: "0x000003BC", stringVal: "GOTHAM_COORDS: 45.109, -73.012", category: "PAYLOAD" },
      { offset: "0x00000E20", stringVal: "INITIATE_OVERRIDE_SECURE_GRID_2", category: "SECURITY" }
    ],
    threatSummary: "CRITICAL MISMATCH: Stated extension is a lossy .jpg image container, but binary header parses directly to magic-bytes '4D 5A' (Windows Portable Executable format). Includes Windows Kernel API system calls and suspicious coordinates. Highly indicative of a steganographic Trojan carrier bypass."
  },
  {
    id: "bank-floorplan-eof",
    name: "gotham_city_bank_floorplan.png",
    extension: ".png",
    claimedType: "PNG Image (Lossless compressed)",
    detectedType: "PNG Image (With Extraneous Data Appendages)",
    magicBytes: "89 50 4E 47 0D 0A 1A 0A  00 00 00 0D 49 48 44 52",
    entropy: 7.84,
    isMismatch: false,
    fileSize: "892 KB",
    date: "2026-07-10 09:14:02",
    badgeLabel: "ANOMALY - EXTRA DATA PAST EOF",
    hexData: [
      { offset: "00000000", hex: "89 50 4E 47 0D 0A 1A 0A  00 00 00 0D 49 48 44 52", ascii: ".PNG........IHDR" },
      { offset: "00000010", hex: "00 00 04 00 00 00 03 00  08 06 00 00 00 E1 C4 F9", ascii: "................" },
      { offset: "00000020", hex: "00 00 00 09 70 48 59 73  00 00 0B 13 00 00 0B 13", ascii: "....pHYs........" },
      { offset: "000004F0", hex: "49 44 41 54 78 9C EC BD  7B 7C D4 F5 1D FF FD 99", ascii: "IDATx...{|......" },
      { offset: "00001BF0", hex: "00 00 00 00 49 45 4E 44  AE 42 60 82 00 00 00 00", ascii: "....IEND.B`....." },
      { offset: "00001C00", hex: "53 45 43 52 45 54 5F 56  41 55 4C 54 5F 4B 45 59", ascii: "SECRET_VAULT_KEY" },
      { offset: "00001C10", hex: "5F 43 4F 4D 42 49 4E 41  54 49 4F 4E 3A 20 38 38", ascii: "_COMBINATION: 88" },
      { offset: "00001C20", hex: "34 2D 58 2D 39 39 00 00  00 00 00 00 00 00 00 00", ascii: "4-X-99.........." },
      { offset: "00001C30", hex: "54 55 4E 4E 45 4C 5F 41  43 43 45 53 53 5F 45 41", ascii: "TUNNEL_ACCESS_EA" },
      { offset: "00001C40", hex: "53 54 5F 56 45 4E 54 3D  54 52 55 45 00 00 00 00", ascii: "ST_VENT=TRUE...." }
    ],
    detectedStrings: [
      { offset: "0x0000000C", stringVal: "IHDR", category: "SYSTEM" },
      { offset: "0x000004F0", stringVal: "IDAT", category: "SYSTEM" },
      { offset: "0x00001BF4", stringVal: "IEND", category: "SYSTEM" },
      { offset: "0x00001C00", stringVal: "SECRET_VAULT_KEY_COMBINATION: 884-X-99", category: "PAYLOAD" },
      { offset: "0x00001C30", stringVal: "TUNNEL_ACCESS_EAST_VENT=TRUE", category: "SECURITY" }
    ],
    threatSummary: "CORRUPTED EOF: Stated extension matches PNG headers (true format validated). However, hexadecimal parsing identifies structured string content appended *after* the terminal IEND chunk offset. It reveals a physical vault passcode and security-bypassed ventilation shaft toggles."
  },
  {
    id: "arkham-mainframe-log",
    name: "arkham_mainframe_core.log",
    extension: ".log",
    claimedType: "Plaintext Log File (ASCII Text)",
    detectedType: "ASCII Plaintext Log Structure",
    magicBytes: "53 59 53 54 45 4D 20 49  4E 49 54 49 41 4C 49 5A",
    entropy: 4.12,
    isMismatch: false,
    fileSize: "12 KB",
    date: "2026-07-10 14:11:15",
    badgeLabel: "SECURE - ALIGNED BLOCK",
    hexData: [
      { offset: "00000000", hex: "53 59 53 54 45 4D 20 49  4E 49 54 49 41 4C 49 5A", ascii: "SYSTEM INITIALZ" },
      { offset: "00000010", hex: "41 54 49 4F 4E 20 4C 4F  47 20 54 45 4C 45 4D 45", ascii: "ATION LOG TELEME" },
      { offset: "00000020", hex: "54 52 59 0A 3D 3D 3D 3D  3D 3D 3D 3D 3D 3D 3D 3D", ascii: "TRY.====" },
      { offset: "00000040", hex: "0A 43 4F 52 45 5F 43 50  55 5F 54 45 4D 50 3A 20", ascii: ".CORE_CPU_TEMP: " },
      { offset: "00000050", hex: "34 32 43 0A 53 54 41 54  55 53 3A 20 4F 4E 4C 49", ascii: "42C.STATUS: ONLI" },
      { offset: "00000060", hex: "4E 45 0A 00 00 00 00 00  00 00 00 00 00 00 00 00", ascii: "NE.............." },
      { offset: "00000110", hex: "57 41 52 4E 3A 20 55 4E  49 44 45 4E 54 49 46 49", ascii: "WARN: UNIDENTIFI" },
      { offset: "00000120", hex: "45 44 20 4E 45 54 57 4F  52 4B 20 42 45 41 43 4F", ascii: "ED NETWORK BEACON" }
    ],
    detectedStrings: [
      { offset: "0x00000000", stringVal: "SYSTEM INITIALIZATION LOG TELEMETRY", category: "SYSTEM" },
      { offset: "0x00000041", stringVal: "CORE_CPU_TEMP: 42C", category: "SYSTEM" },
      { offset: "0x00000110", stringVal: "WARN: UNIDENTIFIED NETWORK BEACON ON PORT 443", category: "SECURITY" }
    ],
    threatSummary: "SECURE LOG CONTAINER: Stated log format aligns completely with the ASCII text stream parsed. Magic bytes match standard character sets. All strings represent benign, authentic mainframe telemetry diagnostics with no hidden binary offsets."
  }
];

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
  const loadCustomFile = (file: File) => {
    playScanOpen();
    setActiveFile(file);
    setSelectedPresetId(null);
    setScanComplete(false);
    setScanProgress(0);

    const reader = new FileReader();
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
      const calculateFileEntropy = (arr: Uint8Array) => {
        const counts = new Uint32Array(256);
        const len = arr.length;
        if (len === 0) return 0;
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
        return +entropy.toFixed(2);
      };
      const realEntropy = calculateFileEntropy(fullBytes);

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

      addLog(`PARSED HEX HEADERS FOR UPLOADED CARRIER: ${file.name.toUpperCase()}`, "info", "SYS");
      
      // Initial carving
      const carved = carveEmbeddedFiles(buffer);
      setCarvedFiles(carved);
    };
    reader.readAsArrayBuffer(file);
  };

  // Launch analysis scanning
  const triggerForensicScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setScanComplete(false);
    playFileAnalysisScanner();

    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const messages = [
      "SNIFFING header magic bytes...",
      "RECONSTRUCTING sector block offsets...",
      "PARSING printable ASCII character loops...",
      "COMPUTING Shannon Shannon Byte Entropy...",
      "MAPPING signature extension indices..."
    ];

    let step = 0;
    let progress = 0;
    scanIntervalRef.current = setInterval(() => {
      progress += 5;
      if (progress % 20 === 0 && step < messages.length - 1) {
        step++;
      }
      setScanProgress(progress);
      setScanMessage(messages[step]);

      if (progress >= 100) {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setIsScanning(false);
        setScanComplete(true);
        playFileAnalysisComplete();
        addLog(`COMPLETED DEEP BINARY INSPECTION ON ${currentData.name}`, "success", "SYS");
      }
    }, 100);
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

  const clearFileBuffer = () => {
    playPinClick();
    setActiveFile(null);
    setSelectedPresetId(TACTICAL_BINARY_PRESETS[0].id);
    setScanComplete(true);
    setCustomMetadata(null);
  };

  return (
    <div
      className="min-h-full w-full p-4 grid grid-cols-12 gap-4 overflow-y-auto font-chakra select-none text-text-primary relative"
      id="file-analysis-root"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {/* Subtle global binary rain in background */}
      <BinaryRain density={15} color="rgba(47, 241, 228, 0.05)" className="fixed inset-0 -z-10" />
      {dragActive && (
        <div className="fixed inset-0 z-[999] bg-bg-void/80 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="border-2 border-dashed border-cyan-primary bg-cyan-primary/5 px-12 py-10 flex flex-col items-center space-y-3">
            <span className="font-orbitron text-sm font-black tracking-[0.2em] text-cyan-primary uppercase">
              RELEASE TO ANALYZE
            </span>
            <span className="font-share text-[11.5px] text-text-dim uppercase tracking-widest">
              Drop file anywhere on screen
            </span>
          </div>
        </div>
      )}
      
      {/* ================= LEFT COLUMN: UPLOADER & PRESETS ================= */}
      <div className="col-span-12 xl:col-span-3 flex flex-col space-y-4 min-h-0">
        
        {/* Header Block */}
        <GlassPanel className="p-4 flex flex-col justify-between" clipSize="sm" showCornerTicks={true}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-4 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_8px_#2ff1e4]" />
                <h1 className="font-orbitron text-sm font-black tracking-widest text-cyan-text uppercase">
                  FILE SECTOR INTEGRITY LAB
                </h1>
              </div>
              <p className="text-[11px] text-text-dim uppercase tracking-wider font-share mt-1 leading-relaxed">
                WayneTech Hexadecimal Diagnostics Engine. Parses file binary streams to isolate hidden extensions, cross-checks magic byte signatures, and extracts character strings.
              </p>
            </div>
            <Badge variant="cyan" size="xs">
              HEX DUMP CORE
            </Badge>
          </div>
        </GlassPanel>

        {/* Dropzone Container */}
        <GlassPanel 
          className={`p-4 flex-1 flex flex-col min-h-[400px] relative transition-all duration-300 ${
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
              <div className="absolute inset-x-0 h-0.5 bg-cyan-primary/40 shadow-[0_0_8px_#2ff1e4] animate-scanline-vertical" />
            </div>
          )}

          <div className="border-b border-border-hairline/20 pb-2 mb-3 flex justify-between items-center">
            <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
              <Binary className="w-3.5 h-3.5 mr-2 text-cyan-primary animate-hex-pulse-flicker" />
              BINARY BUFFER PORT
            </h3>
            {activeFile && (
              <button
                onClick={clearFileBuffer}
                className="text-[10.5px] hover:text-red-threat text-text-dim uppercase transition-colors flex items-center"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Flush Buffer
              </button>
            )}
          </div>

          {!activeFile && !selectedPresetId ? (
            // Upload Dropzone
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center border border-dashed border-cyan-primary/30 hover:border-cyan-primary/60 cursor-pointer bg-bg-void/40 hover:bg-cyan-primary/[0.02] p-6 transition-all duration-300 group"
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
              <span className="font-orbitron text-xs font-black tracking-widest text-cyan-text group-hover:text-white transition-colors">
                DROP ANY FILE VESSEL HERE
              </span>
              <span className="text-[11px] text-text-dim uppercase tracking-widest font-share mt-1">
                OR CLICK TO DISCOVER LOCAL SYSTEM BINARIES
              </span>
              <span className="text-[10.5px] text-cyan-primary/50 mt-4 font-mono">
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
                  <span className="text-[10px] font-mono text-cyan-primary uppercase tracking-widest block mb-0.5">
                    RECOVERED VESSEL
                  </span>
                  <h4 className="font-mono text-xs font-bold text-text-primary truncate uppercase">
                    {currentData.name}
                  </h4>
                  <p className="font-share text-[10.5px] text-text-dim uppercase tracking-wider mt-0.5">
                    CLAIMED: {currentData.extension} ({currentData.fileSize})
                  </p>
                </div>
              </div>

              {/* True signature vs claimed signature readout */}
              <div className="space-y-2.5">
                
                {/* Claims and Reality check */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="border border-border-hairline/10 bg-bg-void/30 p-2 text-[11px] font-mono">
                    <span className="text-text-dim block text-[10px] uppercase">Declared Envelope:</span>
                    <span className="text-text-primary font-bold uppercase">{currentData.extension}</span>
                    <span className="text-text-dim block text-[10px] truncate mt-1">{currentData.claimedType}</span>
                  </div>

                  <div className={`border p-2 text-[11px] font-mono ${
                    currentData.isMismatch 
                      ? "bg-red-threat/10 border-red-threat/30" 
                      : "bg-green-verified/10 border-green-verified/30"
                  }`}>
                    <span className="text-text-dim block text-[10px] uppercase">Detected Structure:</span>
                    <span className={`font-bold uppercase ${
                      currentData.isMismatch ? "text-red-threat" : "text-green-verified"
                    }`}>
                      {currentData.detectedType.split(" ")[0]}
                    </span>
                    <span className="text-text-dim block text-[10px] truncate mt-1">{currentData.detectedType}</span>
                  </div>
                </div>

                {/* Technical specifics */}
                <div className="bg-bg-void/40 border border-border-hairline/10 p-2.5 font-mono text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-text-dim">FIRST magic bytes:</span>
                    <span className="text-cyan-primary tracking-widest text-[10.5px] truncate max-w-[190px]">{currentData.magicBytes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-dim">BYTE ENTROPY SCALE:</span>
                    <span className={currentData.entropy > 7 ? "text-amber-alert" : "text-cyan-text"}>
                      {currentData.entropy} bits/byte
                    </span>
                  </div>
                </div>

              </div>

              {/* Decrypter Action Trigger */}
              <div className="mt-auto pt-4 border-t border-border-hairline/10">
                <button
                  disabled={isScanning}
                  onClick={triggerForensicScan}
                  className="w-full py-3 bg-cyan-primary text-bg-void hover:bg-white hover:shadow-[0_0_20px_rgba(47,241,228,0.6)] active:scale-[0.98] transition-all duration-200 text-xs font-black tracking-widest font-orbitron uppercase disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2 relative z-10"
                  style={{ clipPath: "polygon(0 0, 100% 0, 96% 100%, 0 100%)" }}
                >
                  <Cpu className={`w-4 h-4 text-bg-void ${isScanning ? 'animate-radar-sweep' : ''}`} />
                  <span>{isScanning ? 'INSPECTING...' : 'LAUNCH HEURISTIC FILE INSPECTOR'}</span>
                </button>
              </div>

            </div>
          )}
        </GlassPanel>

        {/* Binary Presets Selector List */}
        <GlassPanel className="p-4" clipSize="sm">
          <div className="border-b border-border-hairline/20 pb-1.5 mb-2.5">
            <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
              <Compass className="w-3.5 h-3.5 mr-2 text-cyan-primary" />
              FORENSIC SECTOR ARCHIVES
            </h3>
            <p className="text-[10.5px] text-text-dim uppercase tracking-wider font-share">
              Cross-examine tactical files with known Trojan wrapping and appendage stego anomalies
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TACTICAL_BINARY_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  playPinClick();
                  setSelectedPresetId(p.id);
                  setActiveFile(null);
                  setScanComplete(false);
                  setCustomMetadata(null);
                  addLog(`MOUNTED FILE ARCHIVE CONTAINER: ${p.name}`, "info", "SYS");
                }}
                className={`text-left p-2 border transition-all duration-200 group flex items-start space-x-2 ${
                  selectedPresetId === p.id 
                    ? "bg-cyan-primary/[0.04] border-cyan-primary" 
                    : "bg-bg-void/30 border-border-hairline/15 hover:border-cyan-primary/40 hover:bg-cyan-primary/[0.01]"
                }`}
              >
                <div className="w-8 h-8 border border-border-hairline/25 shrink-0 flex items-center justify-center bg-bg-void">
                  <FileText className={`w-4 h-4 ${p.isMismatch ? "text-red-threat" : "text-cyan-primary/60"} group-hover:scale-105 transition-transform`} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-mono text-[10.5px] font-bold text-cyan-text truncate group-hover:text-white transition-colors uppercase">
                    {p.name}
                  </h4>
                  <p className={`font-share text-[10px] uppercase tracking-wider mt-0.5 ${
                    p.isMismatch ? "text-red-threat" : "text-text-dim"
                  }`}>
                    {p.isMismatch ? "Trojan Mismatch" : "Aligned Block"}
                  </p>
                </div>
              </button>
            ))}
          </div>
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
            <h2 className="font-orbitron text-sm font-black tracking-widest text-cyan-text uppercase">
              AWAITING BINARY CARRIER TARGET
            </h2>
            <p className="text-xs text-text-dim font-share uppercase tracking-widest max-w-sm mt-1.5 leading-relaxed">
              Load an external file from the binary buffer port or select a preset archive record from the registry to parse byte alignments and extract hidden characters.
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
                  <span className="w-1.5 h-3.5 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_6px_#2ff1e4]" />
                  <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text uppercase">
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
                  <span className="font-orbitron text-xs font-bold text-text-dim uppercase tracking-wider">
                    FILE BUFFER MOUNTED - AWAITING INSPECTION
                  </span>
                  <p className="text-[11px] text-text-dim uppercase tracking-widest font-share max-w-xs mt-1 leading-relaxed">
                    Press "LAUNCH HEURISTIC FILE INSPECTOR" in the left panel to verify byte signatures and decrypt hexadecimal sectors.
                  </p>
                </div>
              ) : (
                // The Scrollable Hex Dump Viewport (shown during scanning or after completion)
                <div className="flex-1 flex flex-col justify-between font-share">
                  
                  {/* Header headers for offsets */}
                  <div className="bg-bg-void border-b border-border-hairline/20 p-2 font-share text-[10.5px] text-cyan-text/75 grid grid-cols-12 gap-1 tracking-widest select-none">
                    <div className="col-span-2">OFFSET</div>
                    <div className="col-span-7 text-center">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</div>
                    <div className="col-span-3 text-right">ASCII_DECODE</div>
                  </div>

                  {/* Actual rows using strict font-share alignment */}
                  <div className="flex-1 overflow-y-auto max-h-[220px] font-share text-[11px] text-text-dim bg-bg-void/70 border border-border-hairline/10 p-2 divide-y divide-border-hairline/5 space-y-1 select-text scrollbar-thin relative overflow-hidden">
                    {scanComplete && (
                      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent via-cyan-primary/20 to-cyan-primary/50 border-b border-cyan-primary animate-scanline-sweep pointer-events-none z-10 mix-blend-screen" />
                    )}
                    {isScanning && (
                      <div className="absolute inset-0 pointer-events-none z-10 mix-blend-screen bg-cyan-primary/[0.01]">
                        <div className="absolute inset-x-0 h-0.5 bg-cyan-primary/40 shadow-[0_0_8px_#2ff1e4] animate-scanline-vertical" />
                      </div>
                    )}
                    {currentData.hexData.map((row, idx) => {
                      const isRelevant = idx === 0; // First row contains the magic bytes signature
                      return (
                      <div key={idx} className={`grid grid-cols-12 gap-1 py-1 hover:bg-cyan-primary/[0.03] transition-colors leading-none relative z-20 ${scanComplete && isRelevant ? 'bg-cyan-primary/[0.05]' : ''}`}>
                        <div className="col-span-2 text-cyan-text font-bold tracking-wider">{row.offset}</div>
                        
                        {/* Strict monospace spacing with font-share */}
                        <div className={`col-span-7 text-text-primary text-center tracking-wider font-medium font-share ${scanComplete && isRelevant ? 'animate-byte-flicker text-cyan-primary text-shadow-[0_0_8px_#2ff1e4]' : ''}`}>
                          {row.hex}
                        </div>
                        
                        <div className={`col-span-3 text-right font-bold truncate font-share ${scanComplete && isRelevant ? 'animate-byte-flicker text-cyan-primary text-shadow-[0_0_8px_#2ff1e4]' : 'text-cyan-primary/80'}`}>
                          {row.ascii}
                        </div>
                      </div>
                    )})}
                  </div>

                  {/* Warning anomaly box if signature mismatch */}
                  {scanComplete && (
                    <div className={`mt-3 p-3 border font-mono text-[11px] flex items-start space-x-2 relative overflow-hidden ${
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
                      <h4 className="font-orbitron text-[11px] font-black tracking-widest text-cyan-text uppercase">
                        EXTRACTABLE ASCII CHARACTER STRINGS (LENGTH &gt;= 4)
                      </h4>
                    </div>

                    {!scanComplete ? (
                      isScanning ? (
                        <div className="py-5 font-mono text-[10.5px] text-cyan-primary">
                          <DataStream text="STREAMING DETECTED STRINGS IN MEMORY BUFFER: 0x0A4F... KEYLOG_SYS_HOOK... SYSTEM_RECOVERY_DECRYPT... TROJAN_VESSEL_DETECTED... MEMORY_FLUSH_COMPLETE... INTERCEPT_SUCCESS" speed={12} active={true} />
                        </div>
                      ) : (
                        <div className="py-6 text-center text-[11px] text-text-dim uppercase font-mono">
                          Strings index matrix locked...
                        </div>
                      )
                    ) : (
                      <div className="overflow-y-auto max-h-[110px] space-y-1.5 pr-1 scrollbar-thin font-mono text-[10.5px]">
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
                        <h4 className="font-orbitron text-[11px] font-black tracking-widest text-amber-alert uppercase">
                          EMBEDDED FILE CARVING
                        </h4>
                      </div>
                      {scanComplete && carvedFiles.length > 0 && (
                        <Badge variant="amber" size="xs">{carvedFiles.length} DETECTED</Badge>
                      )}
                    </div>

                    {!scanComplete ? (
                      <div className="py-6 text-center text-[11px] text-text-dim uppercase font-mono">
                        {isScanning ? "Carving byte stream..." : "Awaiting scanner trigger..."}
                      </div>
                    ) : carvedFiles.length === 0 ? (
                      <div className="py-6 text-center text-[11px] text-text-dim uppercase font-mono italic">
                        No embedded files carved
                      </div>
                    ) : (
                      <div className="overflow-y-auto max-h-[110px] space-y-1.5 pr-1 scrollbar-thin font-mono text-[10.5px]">
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
                                <div className="text-[10px] text-text-dim/40">{(file.length / 1024).toFixed(1)} KB</div>
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
                    <h4 className="font-orbitron text-[11px] font-black tracking-widest text-cyan-text uppercase">
                      RECORD INTEGRATION
                    </h4>
                  </div>

                  {!scanComplete ? (
                    <div className="text-center py-6 font-mono text-[10.5px] text-text-dim uppercase">
                      {isScanning ? "Aligning sector maps..." : "Awaiting sector alignment..."}
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 flex flex-col justify-between">
                      <p className="text-[11px] text-text-dim uppercase tracking-wider leading-relaxed">
                        Commit the hex offsets, ASCII strings map, signature validation data, and file metadata into the active crime dossier database nodes.
                      </p>

                      <button
                        onClick={handleAddToDossier}
                        className="w-full py-1.5 border border-cyan-primary/30 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-all duration-200 text-[11px] uppercase tracking-widest font-black flex items-center justify-center space-x-1.5"
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
