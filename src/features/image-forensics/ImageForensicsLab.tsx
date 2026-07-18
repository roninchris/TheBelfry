import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Upload,
  Image as ImageIcon,
  Eye,
  Search,
  FileText,
  AlertTriangle,
  Database,
  Sparkles,
  Plus,
  Compass,
  Trash2,
  Download,
  ShieldCheck,
  QrCode,
  Layers,
  Lock,
  KeyRound
} from "lucide-react";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import BinaryRain from "../../components/react-bits/BinaryRain";
import {
  playSuccessChime,
  playPinClick,
  playFailBuzz,
  playFileAnalysisComplete,
  playImageForensicsScan,
  playScanOpen,
  playImageScanLoop
} from "../../lib/soundEngine";
import { useAppStore } from "../../store/appStore";
import {
  loadImageAsCanvas,
  detectHiddenMessageInFile,
  parseExif,
  detectInvisibleInk,
  StegoForensicResult
} from "../../lib/tools/image-stego";
import { carveEmbeddedFiles, CarvedFile } from "../../lib/tools/fileCarving";
import { scanQrCode } from "../../lib/tools/image-stego/barcodeScanner";
import { extractStereogramDepth } from "../../lib/tools/image-stego/stereogram";
import { readContentCredentials } from "../../lib/tools/image-stego/c2paViewer";
import { runStegdetect, StegdetectReport } from "../../lib/tools/image-stego/stegdetect";
import { extractSteghide, SteghideExtractResult } from "../../lib/tools/image-stego/steghide";
import { extractOutguess, OutguessExtractResult } from "../../lib/tools/image-stego/outguess";
import { extractOutguessWasm } from "../../lib/tools/image-stego/outguessWasm";

// Pre-configured static tactical feeds for image forensic demonstration
interface TacticalSample {
  id: string;
  name: string;
  type: "success" | "failure";
  imageUrl: string;
  dimensions: string;
  fileSize: string;
  format: string;
  colors: string;
  entropy: number;
  camera: string;
  software: string;
  gps: string;
  date: string;
  lens: string;
  badgeLabel: string;
}

const TACTICAL_SAMPLES: TacticalSample[] = [];

// Helper to calculate Shannon entropy of individual RGB channels and return their values and average
function calculateShannonEntropy(imageData: ImageData) {
  const data = imageData.data;
  const len = data.length;
  const rCounts = new Uint32Array(256);
  const gCounts = new Uint32Array(256);
  const bCounts = new Uint32Array(256);
  const pixelCount = len / 4;

  for (let i = 0; i < len; i += 4) {
    rCounts[data[i]]++;
    gCounts[data[i + 1]]++;
    bCounts[data[i + 2]]++;
  }

  let rEntropy = 0;
  let gEntropy = 0;
  let bEntropy = 0;

  for (let j = 0; j < 256; j++) {
    if (rCounts[j] > 0) {
      const p = rCounts[j] / pixelCount;
      rEntropy -= p * Math.log2(p);
    }
    if (gCounts[j] > 0) {
      const p = gCounts[j] / pixelCount;
      gEntropy -= p * Math.log2(p);
    }
    if (bCounts[j] > 0) {
      const p = bCounts[j] / pixelCount;
      bEntropy -= p * Math.log2(p);
    }
  }

  return {
    r: rEntropy,
    g: gEntropy,
    b: bEntropy,
    average: (rEntropy + gEntropy + bEntropy) / 3
  };
}

/**
 * Fills the dead space under the light table with the carrier's actual
 * signature: per-channel Shannon entropy plus the core envelope facts. The
 * channel bars are diagnostic — a channel sitting well clear of its siblings,
 * or all three pinned near the 8.0 ceiling, is the standard LSB-embedding
 * tell that the decode tab then goes looking for.
 */
function CarrierSignatureStrip({
  metadata,
  scanning,
}: {
  metadata: any | null;
  scanning: boolean;
}) {
  const channels: { key: "r" | "g" | "b"; label: string; tint: string }[] = [
    { key: "r", label: "R", tint: "var(--color-red-threat)" },
    { key: "g", label: "G", tint: "var(--color-green-verified)" },
    { key: "b", label: "B", tint: "var(--color-accent-primary)" },
  ];

  const ch = metadata?.channelEntropy;
  // 8.0 bits is the theoretical ceiling for an 8-bit channel.
  const pct = (v: number) => Math.max(0, Math.min(100, (v / 8) * 100));
  const spread = ch
    ? +(Math.max(ch.r, ch.g, ch.b) - Math.min(ch.r, ch.g, ch.b)).toFixed(2)
    : null;

  return (
    <div className="mt-3 border-t border-border-hairline/15 pt-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-display text-[12px] font-black tracking-widest text-cyan-text uppercase">
          Carrier Signature
        </span>
        <span className="font-share text-[12px] tracking-widest text-text-dim/60 uppercase">
          Shannon entropy · bits per channel
        </span>
      </div>

      {!ch ? (
        <p className="font-share text-[12px] tracking-widest text-text-dim/50 uppercase py-3">
          No carrier loaded — channel entropy unavailable.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {channels.map((c) => {
              const v = ch[c.key] as number;
              return (
                <div key={c.key} className="flex items-center gap-2">
                  <span
                    className="font-display text-[12px] font-black w-3 shrink-0"
                    style={{ color: c.tint }}
                  >
                    {c.label}
                  </span>
                  <div className="relative flex-1 h-[6px] bg-bg-void/80 border border-border-hairline/20 overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 transition-[width] duration-700 ease-out ${
                        scanning ? "animate-hex-pulse-flicker" : ""
                      }`}
                      style={{
                        width: `${pct(v)}%`,
                        backgroundColor: c.tint,
                        boxShadow: `0 0 8px ${c.tint}`,
                        opacity: 0.75,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[12px] text-cyan-text/80 w-10 text-right tabular-nums shrink-0">
                    {v.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3 pt-2 border-t border-border-hairline/10">
            {[
              ["Envelope", metadata.format ?? "—"],
              ["Raster", metadata.dimensions ?? "—"],
              ["Payload", metadata.fileSize ?? "—"],
              ["Δ Spread", spread !== null ? `${spread.toFixed(2)}` : "—"],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="font-share text-[12px] tracking-widest text-text-dim/50 uppercase">
                  {label}
                </div>
                <div className="font-mono text-[12px] text-cyan-text/90 truncate">{value}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type AnalysisTab = "overview" | "decode" | "extract" | "anomaly" | "exif" | "ink" | "qr" | "stereogram" | "c2pa";

export default function ImageForensicsLab() {
  const cases = useAppStore((state) => state.cases);
  const activeCaseId = useAppStore((state) => state.activeCaseId);
  const addEvidenceNode = useAppStore((state) => state.addEvidenceNode);
  const addLog = useAppStore((state) => state.addLog);
  const setModule = useAppStore((state) => state.setModule);

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [activeMetadata, setActiveMetadata] = useState<any | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [carvedFiles, setCarvedFiles] = useState<CarvedFile[]>([]);
  const [exifData, setExifData] = useState<Record<string, any> | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("overview");

  // Scanning state (light-table entrance scan)
  const [isScanningLocal, setIsScanningLocal] = useState(false);
  const [scanProgressLocal, setScanProgressLocal] = useState(0);
  const [scanningMessage, setScanningMessage] = useState("");
  const [scanComplete, setScanComplete] = useState(false);

  // Steganography Decode tab (LSB sweep / JSteg / trailing bytes)
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeResults, setDecodeResults] = useState<StegoForensicResult[]>([]);
  const [decodeAttempted, setDecodeAttempted] = useState(false);
  const [expandedDecodeIdx, setExpandedDecodeIdx] = useState<number>(0);

  // Passphrase Extract tab (Steghide / OutGuess)
  const [extractEngine, setExtractEngine] = useState<"steghide" | "outguess">("steghide");
  const [extractPassphrase, setExtractPassphrase] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [steghideResult, setSteghideResult] = useState<SteghideExtractResult | null>(null);
  const [outguessResult, setOutguessResult] = useState<OutguessExtractResult | null>(null);

  // Anomaly (stegdetect) tab
  const [isDetectingAnomaly, setIsDetectingAnomaly] = useState(false);
  const [stegdetectReport, setStegdetectReport] = useState<StegdetectReport | null>(null);

  // Invisible Ink tab
  const [isDetectingInk, setIsDetectingInk] = useState(false);
  const [inkEnhancedPreview, setInkEnhancedPreview] = useState<string | null>(null);
  const [inkConfidence, setInkConfidence] = useState(0);

  // QR tab
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [qrResult, setQrResult] = useState<{ data: string; location: any } | null>(null);
  const [qrScanAttempted, setQrScanAttempted] = useState(false);

  // Stereogram tab
  const [isSolvingStereogram, setIsSolvingStereogram] = useState(false);
  const [stereogramDepthPreview, setStereogramDepthPreview] = useState<string | null>(null);

  // C2PA tab
  const [isReadingC2pa, setIsReadingC2pa] = useState(false);
  const [c2paManifest, setC2paManifest] = useState<any>(null);
  const [c2paAttempted, setC2paAttempted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanSoundRef = useRef<{ stop: () => void } | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSampleData = useMemo(() => {
    if (selectedSampleId) return TACTICAL_SAMPLES.find(s => s.id === selectedSampleId) || null;
    return null;
  }, [selectedSampleId]);

  // Real byte-level analysis (decode/extract/anomaly/qr/stereogram/c2pa/exif) requires an actual
  // uploaded File — the tactical presets only carry demo metadata, not real matching image bytes.
  const hasRealFile = !!activeFile;

  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  useEffect(() => {
    if (isScanningLocal) {
      if (!scanSoundRef.current) {
        scanSoundRef.current = playImageScanLoop();
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
  }, [isScanningLocal]);

  const resetAnalysisState = () => {
    setDecodeResults([]);
    setDecodeAttempted(false);
    setSteghideResult(null);
    setOutguessResult(null);
    setExtractPassphrase("");
    setStegdetectReport(null);
    setInkEnhancedPreview(null);
    setInkConfidence(0);
    setQrResult(null);
    setQrScanAttempted(false);
    setStereogramDepthPreview(null);
    setC2paManifest(null);
    setC2paAttempted(false);
    setExifData(null);
  };

  const loadCustomFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      addLog("INVALID FILE TYPE: TARGET MUST BE AN RGB IMAGE CONTAINER", "warning", "SYS");
      return;
    }

    setActiveFile(file);
    setSelectedSampleId(null);
    setScanComplete(false);
    setScanProgressLocal(0);
    setIsScanningLocal(false);
    setActiveTab("overview");
    resetAnalysisState();

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setActivePreview(dataUrl);
      playScanOpen();
    };
    reader.readAsDataURL(file);

    const arrayBufferPromise = new Promise<ArrayBuffer | null>((resolve) => {
      const bufferReader = new FileReader();
      bufferReader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      bufferReader.onerror = () => resolve(null);
      bufferReader.readAsArrayBuffer(file);
    });

    loadImageAsCanvas(file)
      .then(async (canvas) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas 2D context");
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const entropyResult = calculateShannonEntropy(imgData);

        const buffer = await arrayBufferPromise;
        const carved = carveEmbeddedFiles(buffer);
        setCarvedFiles(carved);
        if (buffer) {
          const exif = parseExif(buffer);
          setExifData(exif);
        }

        const hasPayload = carved.length > 0;
        const badgeLabel = hasPayload
          ? "THREAT - EMBEDDED FILE CARRIERS RECOVERED"
          : "SECURE - CLEAN CHANNELS";

        const dateString = new Date(file.lastModified).toISOString().replace("T", " ").slice(0, 19);

        setActiveMetadata({
          name: file.name,
          dimensions: `${canvas.width} x ${canvas.height}`,
          fileSize: `${(file.size / 1024).toFixed(0)} KB`,
          format: file.type.replace("image/", "").toUpperCase(),
          colors: "RGB 24-bit",
          entropy: +entropyResult.average.toFixed(2),
          // Per-channel figures drive the carrier signature strip. A channel
          // sitting well above its siblings is a classic LSB-embedding tell,
          // so this is diagnostic rather than decorative.
          channelEntropy: {
            r: +entropyResult.r.toFixed(2),
            g: +entropyResult.g.toFixed(2),
            b: +entropyResult.b.toFixed(2),
          },
          date: dateString,
          badgeLabel
        });
      })
      .catch((err) => {
        addLog(`IMAGE ANALYSIS ERROR: ${err.message}`, "warning", "SYS");
      });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadCustomFile(e.dataTransfer.files[0]);
    }
  };

  const selectPresetSample = (sample: TacticalSample) => {
    playPinClick();
    setActiveFile(null);
    setSelectedSampleId(sample.id);
    setActivePreview(sample.imageUrl);
    setScanComplete(false);
    setScanProgressLocal(0);
    setIsScanningLocal(false);
    setActiveTab("overview");
    setCarvedFiles([]);
    resetAnalysisState();

    setActiveMetadata({
      name: sample.name,
      dimensions: sample.dimensions,
      fileSize: sample.fileSize,
      format: sample.format,
      colors: sample.colors,
      entropy: sample.entropy,
      camera: sample.camera,
      software: sample.software,
      gps: sample.gps,
      date: sample.date,
      lens: sample.lens,
      badgeLabel: sample.badgeLabel
    });
  };

  const triggerScan = () => {
    if (!activePreview) return;
    setIsScanningLocal(true);
    setScanProgressLocal(0);
    setScanComplete(false);
    playImageForensicsScan();

    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const messages = [
      "CALIBRATING SPECTRAL SENSORS...",
      "SCANNING BYTE-LEVEL ENTROPY...",
      "MAPPING COLOR DISTRIBUTION...",
      "ANALYZING BIT-DEPTH INTEGRITY...",
      "FINALIZING FORENSIC REPORT..."
    ];

    let currentStep = 0;
    let progress = 0;
    scanIntervalRef.current = setInterval(() => {
      progress += 5;
      if (progress % 20 === 0 && currentStep < messages.length - 1) {
        currentStep++;
      }
      setScanProgressLocal(progress);
      setScanningMessage(messages[currentStep]);

      if (progress >= 100) {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setIsScanningLocal(false);
        setScanComplete(true);
        playFileAnalysisComplete();
        addLog(`FORENSIC SCAN COMPLETED ON FILE ${activeMetadata?.name || "SOURCE"}`, "success", "SYS");
      }
    }, 100);
  };

  const handleDecode = async () => {
    if (!activeFile) return;
    setIsDecoding(true);
    setDecodeAttempted(false);
    try {
      const canvas = await loadImageAsCanvas(activeFile);
      const results = await detectHiddenMessageInFile(activeFile, canvas);
      setDecodeResults(results);
      setDecodeAttempted(true);
      setExpandedDecodeIdx(0);
      playFileAnalysisComplete();
      addLog(`STEGANOGRAPHY DECODE SWEEP COMPLETED ON ${activeFile.name} (${results.length} SIGNAL${results.length === 1 ? "" : "S"})`, results.length > 0 ? "success" : "info", "SYS");
    } catch (e: any) {
      addLog(`DECODE SWEEP FAILED: ${e.message}`, "warning", "SYS");
    } finally {
      setIsDecoding(false);
    }
  };

  const handlePassphraseExtract = async () => {
    if (!activeFile) return;
    setIsExtracting(true);
    setSteghideResult(null);
    setOutguessResult(null);
    try {
      if (extractEngine === "steghide") {
        const result = await extractSteghide(activeFile, extractPassphrase);
        setSteghideResult(result);
        if (result.success) {
          playSuccessChime();
          addLog(`STEGHIDE EXTRACTION SUCCEEDED: ${result.filename || "unnamed payload"}`, "success", "SYS");
        } else {
          playFailBuzz();
          addLog(`STEGHIDE EXTRACTION FAILED: ${result.error}`, "warning", "SYS");
        }
      } else {
        const result = (await extractOutguessWasm(activeFile, extractPassphrase)) ?? (await extractOutguess(activeFile, extractPassphrase));
        setOutguessResult(result);
        if (result.success) {
          playSuccessChime();
          addLog("OUTGUESS EXTRACTION SUCCEEDED", "success", "SYS");
        } else {
          playFailBuzz();
          addLog(`OUTGUESS EXTRACTION FAILED: ${result.error}`, "warning", "SYS");
        }
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnomalyDetection = async () => {
    if (!activeFile) return;
    setIsDetectingAnomaly(true);
    setStegdetectReport(null);
    try {
      const canvas = await loadImageAsCanvas(activeFile);
      const report = await runStegdetect(canvas, activeFile);
      setStegdetectReport(report);
      playFileAnalysisComplete();
      addLog(`STEGDETECT SCAN COMPLETED. OVERALL SUSPICION: ${report.overallSuspicion.toUpperCase()}`, "info", "SYS");
    } catch (e) {
      console.error(e);
      addLog("STEGDETECT SCAN FAILED", "warning", "SYS");
    } finally {
      setIsDetectingAnomaly(false);
    }
  };

  const handleInkDetection = async () => {
    if (!activeFile) return;
    setIsDetectingInk(true);
    try {
      const canvas = await loadImageAsCanvas(activeFile);
      const { enhancedCanvas, confidence } = detectInvisibleInk(canvas);
      setInkEnhancedPreview(enhancedCanvas.toDataURL("image/png"));
      setInkConfidence(confidence);
      playFileAnalysisComplete();
      addLog(`INVISIBLE INK SCAN COMPLETED: ${Math.round(confidence * 100)}% CONFIDENCE`, "info", "SYS");
    } catch (e) {
      console.error(e);
      addLog("INVISIBLE INK DETECTION FAILED", "warning", "SYS");
    } finally {
      setIsDetectingInk(false);
    }
  };

  const handleQrScan = async () => {
    if (!activeFile) return;
    setIsScanningQr(true);
    setQrScanAttempted(false);
    try {
      const canvas = await loadImageAsCanvas(activeFile);
      const result = scanQrCode(canvas);
      setQrResult(result);
      setQrScanAttempted(true);
      if (result) {
        playSuccessChime();
        addLog("QR CODE DECODED SUCCESSFULLY", "success", "SYS");
      } else {
        addLog("NO QR CODE DETECTED IN IMAGE", "warning", "SYS");
      }
    } catch (e) {
      console.error(e);
      addLog("QR SCAN FAILED", "warning", "SYS");
    } finally {
      setIsScanningQr(false);
    }
  };

  const handleStereogramSolver = async () => {
    if (!activeFile) return;
    setIsSolvingStereogram(true);
    try {
      const canvas = await loadImageAsCanvas(activeFile);
      const depthCanvas = extractStereogramDepth(canvas);
      setStereogramDepthPreview(depthCanvas.toDataURL("image/png"));
      playFileAnalysisComplete();
      addLog("STEREOGRAM DEPTH EXTRACTION COMPLETED", "success", "SYS");
    } catch (e) {
      console.error(e);
      addLog("STEREOGRAM ANALYSIS FAILED", "warning", "SYS");
    } finally {
      setIsSolvingStereogram(false);
    }
  };

  const handleC2paRead = async () => {
    if (!activeFile) return;
    setIsReadingC2pa(true);
    setC2paAttempted(false);
    try {
      const manifest = await readContentCredentials(activeFile);
      setC2paManifest(manifest);
      setC2paAttempted(true);
      if (manifest) {
        playSuccessChime();
        addLog("CONTENT CREDENTIALS RETRIEVED", "success", "SYS");
      } else {
        addLog("NO C2PA MANIFEST FOUND", "info", "SYS");
      }
    } catch (e) {
      console.error(e);
      addLog("C2PA VERIFICATION FAILED", "warning", "SYS");
    } finally {
      setIsReadingC2pa(false);
    }
  };

  // Attach every finding across every tab that has results into ONE evidence node.
  const handleAddToDossier = () => {
    if (!activeMetadata) return;

    const caseId = activeCaseId || (cases[0]?.id || "");
    if (!caseId) {
      addLog("CANNOT MOUNT EVIDENCE: NO CASE SELECTED IN BAT-DATABASE", "warning", "SYS");
      return;
    }

    playPinClick();

    const sections: string[] = [];
    sections.push(`### IMAGE FORENSIC SUMMARY
**SOURCE CONTAINER**: ${activeMetadata.name}
**ACQUISITION SPECIFICATIONS**:
- Resolution: ${activeMetadata.dimensions}
- Colorspace: ${activeMetadata.colors}
- Entropy Ratio: ${activeMetadata.entropy} bits/pixel
- Captured Date: ${activeMetadata.date}`);

    if (carvedFiles.length > 0) {
      sections.push(`**CARVED EMBEDDED FILES**:\n${carvedFiles.map(f =>
        `- ${f.type} at offset 0x${f.offset.toString(16).toUpperCase()}${f.length ? ` (${(f.length / 1024).toFixed(1)} KB)` : ""}`
      ).join("\n")}`);
    }

    if (exifData && Object.keys(exifData).length > 0) {
      sections.push(`**EXIF METADATA**:\n${Object.entries(exifData).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`);
    }

    if (decodeResults.length > 0) {
      sections.push(`**STEGANOGRAPHY DECODE HITS**:\n${decodeResults.map(r =>
        `- [${r.type}] ${(r.confidence * 100).toFixed(0)}%: ${r.decodedText.substring(0, 120)}`
      ).join("\n")}`);
    }

    if (steghideResult?.success) {
      sections.push(`**STEGHIDE EXTRACTION**:\n- Filename: ${steghideResult.filename || "unnamed"}\n- Content: ${(steghideResult.text || "<binary>").substring(0, 300)}`);
    }
    if (outguessResult?.success) {
      sections.push(`**OUTGUESS EXTRACTION**:\n- Content: ${(outguessResult.text || "<binary>").substring(0, 300)}`);
    }

    if (stegdetectReport) {
      sections.push(`**STEGDETECT ANOMALY REPORT**:\n- ${stegdetectReport.summary}`);
    }

    addEvidenceNode({
      type: "file",
      title: `IMAGE FORENSICS: ${activeMetadata.name}`,
      content: sections.join("\n\n"),
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200
    });

    addLog("RECORDED FORENSIC FINDINGS LINKED TO ACTIVE DOSSIER", "success", "SYS");
    setModule("detective-board");
  };

  const clearActiveFile = () => {
    playPinClick();
    setActiveFile(null);
    setActivePreview(null);
    setSelectedSampleId(null);
    setScanComplete(false);
    setScanProgressLocal(0);
    setIsScanningLocal(false);
    setActiveMetadata(null);
    setCarvedFiles([]);
    setActiveTab("overview");
    resetAnalysisState();
  };

  const ANALYSIS_TABS: { id: AnalysisTab; label: string }[] = [
    { id: "overview", label: "OVERVIEW" },
    { id: "decode", label: "STEG DECODE" },
    { id: "extract", label: "STEGHIDE/OUTGUESS" },
    { id: "anomaly", label: "ANOMALY" },
    { id: "exif", label: "EXIF" },
    { id: "ink", label: "INVISIBLE INK" },
    { id: "qr", label: "QR CODE" },
    { id: "stereogram", label: "MAGIC EYE" },
    { id: "c2pa", label: "C2PA" }
  ];

  return (
    <div className="h-full w-full p-4 grid grid-cols-12 gap-4 overflow-y-auto font-chakra select-none text-text-primary animate-fade-in" id="image-forensics-root">

      {/* ================= LEFT/CENTER COLUMN: LIGHT TABLE VISUALIZER ================= */}
      <div className="col-span-12 lg:col-span-7 flex flex-col space-y-4 min-h-0">

        <GlassPanel className="p-4 flex flex-col justify-between" clipSize="sm" showCornerTicks={true}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-4 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_8px_var(--color-accent-primary)]" />
                <h1 className="font-display text-sm font-black tracking-widest text-cyan-text uppercase">
                  IMAGE FORENSICS &amp; STEGANOGRAPHY LAB
                </h1>
              </div>
              <p className="text-[13px] text-text-dim uppercase tracking-wider font-share mt-1 leading-relaxed">
                Belfry Content Integrity Suite. Decode/extract-only — carves embedded files, decodes hidden LSB/DCT payloads, and analyzes entropy signatures.
              </p>
            </div>
            <Badge variant="cyan" size="xs">OFFLINE SECURE LAB</Badge>
          </div>
        </GlassPanel>

        <GlassPanel
          className={`p-4 flex-1 flex flex-col min-h-[420px] relative transition-all duration-300 ${
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
          <div className="absolute inset-0 image-forensic-grid pointer-events-none opacity-20" />
          <div className="absolute inset-0 lsb-noise-overlay pointer-events-none opacity-10" />

          <div className="border-b border-border-hairline/20 pb-2 mb-3 flex justify-between items-center z-10">
            <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
              <ImageIcon className="w-3.5 h-3.5 mr-2 text-cyan-primary animate-hex-pulse-flicker" />
              FORENSIC LIGHT TABLE INSPECTION PORT
            </h3>
            {activePreview && (
              <button
                onClick={clearActiveFile}
                className="text-[12px] hover:text-red-threat text-text-dim uppercase transition-colors flex items-center"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Purge Table Buffer
              </button>
            )}
          </div>

          {!activePreview ? (
            <div className="flex-1 flex flex-col justify-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-cyan-primary/20 hover:border-cyan-primary/50 cursor-pointer bg-bg-void/40 hover:bg-cyan-primary/[0.02] p-8 transition-all duration-300 group min-h-[320px] relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <BinaryRain density={15} color="rgb(var(--rgb-accent) / 0.4)" />
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) loadCustomFile(e.target.files[0]);
                  }}
                  className="hidden"
                  accept="image/*"
                />
                <div className="w-16 h-16 rounded-full border border-cyan-primary/25 flex items-center justify-center mb-4 bg-bg-void relative group-hover:scale-105 group-hover:border-cyan-primary/55 transition-all duration-300">
                  <Upload className="w-7 h-7 text-cyan-primary/70 group-hover:text-cyan-primary animate-hex-pulse-flicker" />
                </div>
                <span className="font-display text-xs font-black tracking-widest text-cyan-text group-hover:text-white transition-colors">
                  DRAG &amp; DROP IMAGE CARRIER HERE
                </span>
                <span className="text-[13px] text-text-dim uppercase tracking-widest font-share mt-1">
                  OR CLICK TO ACCESS LOCAL SECURE REPOSITORY
                </span>
                <span className="text-[12px] text-cyan-primary/40 mt-4 font-mono">
                  COMPATIBLE ENVELOPES: PNG, JPG, WEBP, BMP (MAX 10MB)
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between min-h-0 relative">
              <div className="flex-1 flex items-center justify-center bg-bg-void/70 border border-border-hairline/15 relative overflow-hidden min-h-[300px] max-h-[340px] p-4">
                <img
                  src={activePreview}
                  alt="Forensic Source Preview"
                  className={`max-h-[300px] max-w-full object-contain filter drop-shadow-[0_0_12px_rgb(var(--rgb-accent) / 0.25)] transition-all duration-300 ${
                    isScanningLocal ? "animate-carrier-unstable opacity-90 brightness-110 contrast-110" : ""
                  }`}
                />

                {isScanningLocal && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-bg-void/40 backdrop-blur-[1px] pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-primary/30 to-transparent w-full h-[15%] animate-scanline-vertical opacity-80 mix-blend-screen" />
                    {/* The carrier itself already carries animate-rgb-split; running it
                        on this overlay too doubled the flicker out of sync with it. */}
                    <div className="absolute inset-0 bg-cyan-primary/10 mix-blend-color-dodge" />
                    <div className="font-display text-base font-black text-cyan-primary animate-hex-pulse-flicker tracking-[0.4em] z-40 drop-shadow-[0_0_12px_rgb(var(--rgb-accent) / 0.9)] mix-blend-screen text-center">
                      {scanningMessage}
                    </div>
                  </div>
                )}

                <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-primary/45" />
                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-primary/45" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-cyan-primary/45" />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-primary/45" />

                {scanComplete && (
                  <div className="animate-data-assemble absolute bottom-4 left-4 z-30 font-mono text-[12px] text-cyan-primary/70 bg-bg-void/90 px-2 py-0.5 border border-cyan-primary/20 uppercase tracking-widest backdrop-blur-md">
                    CARRIER ANALYSIS COMPLETE
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2 border-t border-border-hairline/10 sticky bottom-0 bg-bg-void/80 z-10">
                <button
                  disabled={isScanningLocal}
                  onClick={triggerScan}
                  className="hud-target w-full py-3 bg-cyan-primary text-bg-void hover:bg-white hover:shadow-[0_0_20px_rgb(var(--rgb-accent) / 0.6)] active:scale-[0.98] transition-all duration-200 text-xs font-black tracking-widest font-display uppercase disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2 relative z-10"
                  style={{ clipPath: "polygon(0 0, 100% 0, 96% 100%, 0 100%)" }}
                >
                  <Search className="w-4 h-4" />
                  <span>PERFORM FORENSIC SPECTRAL SCAN</span>
                </button>
                {!hasRealFile && (
                  <p className="text-[12px] font-mono text-amber-alert/80 uppercase tracking-wider text-center mt-2">
                    Metadata only — upload a real file to run byte-level decode/extract/anomaly analysis.
                  </p>
                )}
              </div>

              <CarrierSignatureStrip metadata={activeMetadata} scanning={isScanningLocal} />
            </div>
          )}
        </GlassPanel>

      </div>

      {/* ================= RIGHT COLUMN: TABBED ANALYSIS SIDEBAR ================= */}
      <div className="col-span-12 lg:col-span-5 flex flex-col space-y-3 min-h-0">
        <div className="flex bg-bg-void/50 border border-border-hairline/20 p-1 overflow-x-auto no-scrollbar shrink-0">
          {ANALYSIS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                playPinClick();
                setActiveTab(tab.id);
              }}
              className={`px-3 py-1.5 font-display text-[12px] font-bold tracking-widest uppercase transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-cyan-primary text-bg-void shadow-[0_0_10px_var(--color-accent-primary)]"
                  : "text-text-dim hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <GlassPanel className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-thin" clipSize="sm">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-3.5 bg-amber-alert transform -skew-x-12 inline-block shadow-[0_0_6px_rgb(var(--rgb-amber) / 0.4)]" />
                    <h3 className="font-display text-[13px] font-black tracking-widest text-amber-alert uppercase">
                      EMBEDDED FILE CARVING
                    </h3>
                  </div>
                  {carvedFiles.length > 0 && <Badge variant="amber" size="xs">{carvedFiles.length} DETECTED</Badge>}
                </div>

                {!activePreview ? (
                  <div className="text-text-dim text-[13px] italic py-2 text-center">— NO ACTIVE CARRIER MOUNTED —</div>
                ) : !scanComplete ? (
                  <div className="text-text-dim text-[13px] italic py-2 text-center">
                    {isScanningLocal ? "SCANNING BYTE STREAM..." : "— AWAITING CARVING TRIGGER —"}
                  </div>
                ) : carvedFiles.length === 0 ? (
                  <div className="text-text-dim text-[13px] italic py-2 text-center">NO EMBEDDED FILES CARVED</div>
                ) : (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto scrollbar-thin pr-1">
                    {carvedFiles.map((file, idx) => (
                      <div key={idx} className="p-2 border border-border-hairline/10 bg-bg-void/60 flex items-center justify-between group hover:border-amber-alert/30 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-text-primary uppercase">{file.type}</span>
                            <span className="text-[12px] font-mono text-text-dim">@ 0x{file.offset.toString(16).toUpperCase()}</span>
                          </div>
                          {file.length && <div className="text-[12px] text-text-dim/60">Length: {(file.length / 1024).toFixed(1)} KB</div>}
                        </div>
                        {file.length && (
                          <button
                            onClick={async () => {
                              playPinClick();
                              if (!activeFile) return;
                              const buffer = await activeFile.arrayBuffer();
                              const slice = buffer.slice(file.offset, file.offset + file.length);
                              const blob = new Blob([slice], { type: "application/octet-stream" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `carved_offset_${file.offset}.${file.extension}`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="p-1.5 bg-amber-alert/10 text-amber-alert border border-amber-alert/20 hover:bg-amber-alert/20 transition-colors rounded"
                            title="Extract & Download"
                          >
                            <Download size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[12px] font-black text-cyan-primary/80 uppercase tracking-widest block border-b border-border-hairline/10 pb-0.5">
                  CONTAINER SPECIFICATIONS
                </span>
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between border-b border-border-hairline/5 pb-1">
                    <span className="text-text-dim">ENVELOPE FORMAT:</span>
                    <span className="text-cyan-text font-bold uppercase">{activeMetadata ? activeMetadata.format : "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-hairline/5 pb-1">
                    <span className="text-text-dim">PIXEL MATRIX:</span>
                    <span>{activeMetadata ? activeMetadata.dimensions : "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-hairline/5 pb-1">
                    <span className="text-text-dim">FILE WEIGHT:</span>
                    <span>{activeMetadata ? activeMetadata.fileSize : "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-hairline/5 pb-1">
                    <span className="text-text-dim">COLOR PROFILE:</span>
                    <span>{activeMetadata ? activeMetadata.colors : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-dim">SHANNON ENTROPY:</span>
                    <span className={activeMetadata ? "text-cyan-primary font-bold" : "text-text-primary"}>
                      {activeMetadata ? `${activeMetadata.entropy} bits/px` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-cyan-primary/30">
                <button
                  disabled={!scanComplete}
                  onClick={handleAddToDossier}
                  className="w-full py-2.5 border border-cyan-primary/40 text-cyan-primary hover:bg-cyan-primary hover:text-bg-void disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-cyan-primary/40 transition-all duration-300 text-[13px] font-black tracking-widest uppercase flex items-center justify-center space-x-2"
                  style={{ clipPath: "polygon(0 0, 100% 0, 94% 100%, 0 100%)" }}
                >
                  <Plus className="w-4 h-4" />
                  <span>ATTACH ALL FINDINGS TO DOSSIER</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "decode" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-primary uppercase mb-1">
                  STEGANOGRAPHY DECODE (LSB / JSTEG / TRAILING BYTES)
                </h3>
                <p className="font-share text-[12px] text-text-dim uppercase leading-relaxed">
                  Sweeps bit-plane/channel/direction permutations, JPEG DCT-coefficient LSBs, and appended trailing data. Decode-only.
                </p>
              </div>
              <button
                disabled={!hasRealFile || isDecoding}
                onClick={handleDecode}
                className="w-full py-3 bg-cyan-primary text-bg-void font-display font-black text-xs tracking-widest uppercase hover:bg-white transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <Search className="w-4 h-4" />
                <span>{isDecoding ? "SCANNING BIT-PLANES..." : "RUN DECODE SWEEP"}</span>
              </button>

              {!decodeAttempted ? (
                <div className="text-center py-8 text-text-dim italic">
                  <p className="font-share text-[13px] uppercase tracking-widest">AWAITING DECODE SWEEP</p>
                </div>
              ) : decodeResults.length === 0 ? (
                <div className="bg-bg-void/40 border border-red-threat/20 p-4 text-center">
                  <AlertTriangle className="w-6 h-6 text-red-threat mx-auto mb-2 opacity-50" />
                  <p className="font-share text-[13px] text-red-threat uppercase tracking-widest font-bold">NO SIGNATURES DETECTED</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                  {decodeResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={`border transition-all duration-200 ${
                        expandedDecodeIdx === idx ? "border-cyan-primary/40 bg-cyan-primary/5" : "border-border-hairline/10 bg-bg-void/40 hover:border-cyan-primary/20"
                      }`}
                    >
                      <button onClick={() => setExpandedDecodeIdx(idx)} className="w-full flex items-center justify-between p-3 text-left">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-black text-cyan-primary uppercase tracking-widest">
                            {result.type}{result.xorKey ? " + XOR" : ""}
                          </span>
                          {result.type === "LSB" && (
                            <span className="text-[13px] font-mono text-text-primary mt-0.5 truncate max-w-[180px]">
                              {result.channelOrder} P{result.bitPlane} {result.direction} {result.bitOrder === "msb-first" ? "MSB" : "LSB"}
                            </span>
                          )}
                        </div>
                        <Badge variant={result.confidence > 0.8 ? "cyan" : "dim"} size="xs">
                          {(result.confidence * 100).toFixed(0)}%
                        </Badge>
                      </button>
                      {expandedDecodeIdx === idx && (
                        <div className="p-3 pt-0">
                          <div className="p-2 bg-bg-void/80 border border-cyan-primary/20 font-mono text-[13px] leading-relaxed break-words select-text text-cyan-text">
                            {result.decodedText}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "extract" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-primary uppercase mb-1">
                  STEGHIDE / OUTGUESS EXTRACTION
                </h3>
                <p className="font-share text-[12px] text-text-dim uppercase leading-relaxed">
                  Extraction only, adapted from the public algorithms (see Belfry Advisory below for fidelity caveats). Steghide supports JPEG/BMP/WAV covers; OutGuess needs a JPEG.
                </p>
              </div>

              <div className="flex bg-bg-void border border-border-hairline/20 p-0.5">
                {(["steghide", "outguess"] as const).map((engine) => (
                  <button
                    key={engine}
                    onClick={() => setExtractEngine(engine)}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-display font-bold uppercase tracking-widest transition-all ${
                      extractEngine === engine ? "bg-cyan-primary text-bg-void" : "text-text-dim hover:text-text-primary"
                    }`}
                  >
                    {engine}
                  </button>
                ))}
              </div>

              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-text-dim/50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={extractPassphrase}
                  onChange={(e) => setExtractPassphrase(e.target.value)}
                  placeholder="PASSPHRASE (may be empty)"
                  className="w-full bg-bg-void/50 border border-border-hairline/20 focus:border-cyan-primary/60 pl-8 pr-2.5 py-2 text-[13px] font-mono text-text-primary placeholder:text-text-dim/40 outline-none"
                />
              </div>

              <button
                disabled={!hasRealFile || isExtracting}
                onClick={handlePassphraseExtract}
                className="w-full py-3 bg-cyan-primary text-bg-void font-display font-black text-xs tracking-widest uppercase hover:bg-white transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>{isExtracting ? "ATTEMPTING EXTRACTION..." : `EXTRACT VIA ${extractEngine.toUpperCase()}`}</span>
              </button>

              {extractEngine === "steghide" && steghideResult && (
                steghideResult.success ? (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <Badge variant="green" size="xs">EXTRACTION SUCCEEDED</Badge>
                      {steghideResult.checksumOk !== undefined && (
                        <span title="The exact byte range steghide's CRC32 covers isn't confirmed — a mismatch here doesn't necessarily mean the extraction is wrong.">
                          <Badge variant={steghideResult.checksumOk ? "green" : "dim"} size="xs">
                            CRC32: {steghideResult.checksumOk ? "OK" : "UNVERIFIED"}
                          </Badge>
                        </span>
                      )}
                    </div>
                    {steghideResult.filename && (
                      <div className="text-[13px] font-mono text-text-dim">FILENAME: <span className="text-cyan-text">{steghideResult.filename}</span></div>
                    )}
                    <div className="p-2 bg-bg-void/80 border border-cyan-primary/20 font-mono text-[13px] leading-relaxed break-words select-text text-cyan-text max-h-[220px] overflow-y-auto">
                      {steghideResult.text ?? `<${steghideResult.bytes?.length ?? 0} binary bytes>`}
                    </div>
                    {steghideResult.warning && (
                      <p className="text-[12px] font-mono text-amber-alert/90 uppercase leading-relaxed">{steghideResult.warning}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-bg-void/40 border border-red-threat/20 p-3 text-center">
                    <AlertTriangle className="w-5 h-5 text-red-threat mx-auto mb-1 opacity-60" />
                    <p className="font-share text-[12px] text-red-threat uppercase tracking-wide">{steghideResult.error}</p>
                  </div>
                )
              )}

              {extractEngine === "outguess" && outguessResult && (
                outguessResult.success ? (
                  <div className="space-y-2 animate-fade-in">
                    <Badge variant="green" size="xs">EXTRACTION SUCCEEDED</Badge>
                    <div className="p-2 bg-bg-void/80 border border-cyan-primary/20 font-mono text-[13px] leading-relaxed break-words select-text text-cyan-text max-h-[220px] overflow-y-auto">
                      {outguessResult.text ?? `<${outguessResult.bytes?.length ?? 0} binary bytes>`}
                    </div>
                    {outguessResult.warning && (
                      <p className="text-[12px] font-mono text-amber-alert/90 uppercase leading-relaxed">{outguessResult.warning}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-bg-void/40 border border-red-threat/20 p-3 text-center">
                    <AlertTriangle className="w-5 h-5 text-red-threat mx-auto mb-1 opacity-60" />
                    <p className="font-share text-[12px] text-red-threat uppercase tracking-wide">{outguessResult.error}</p>
                  </div>
                )
              )}
            </div>
          )}

          {activeTab === "anomaly" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-primary uppercase mb-1">
                  STEGDETECT-STYLE ANOMALY DETECTION
                </h3>
                <p className="font-share text-[12px] text-text-dim uppercase leading-relaxed">
                  Combines spatial-domain (RGB) and DCT-domain (JPEG coefficient) chi-square goodness-of-fit tests. Detection only — not extraction.
                </p>
              </div>
              <button
                disabled={!hasRealFile || isDetectingAnomaly}
                onClick={handleAnomalyDetection}
                className="w-full py-3 bg-cyan-primary text-bg-void font-display font-black text-xs tracking-widest uppercase hover:bg-white transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <Search className="w-4 h-4" />
                <span>{isDetectingAnomaly ? "COMPUTING STATS..." : "RUN STEGDETECT SCAN"}</span>
              </button>

              {!stegdetectReport ? (
                <div className="text-center py-8 text-text-dim italic">
                  <p className="font-share text-[13px] uppercase tracking-widest">AWAITING ANOMALY SCAN</p>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[13px] font-black text-cyan-primary uppercase tracking-widest">OVERALL SUSPICION</span>
                    <Badge
                      variant={
                        stegdetectReport.overallSuspicion === "high" ? "red"
                          : stegdetectReport.overallSuspicion === "medium" ? "amber"
                          : stegdetectReport.overallSuspicion === "low" ? "cyan" : "dim"
                      }
                      size="xs"
                    >
                      {stegdetectReport.overallSuspicion.toUpperCase()}
                    </Badge>
                  </div>
                  {stegdetectReport.spatial && (
                    <div className="p-2 bg-bg-void/80 border border-cyan-primary/20 font-mono text-[12px] leading-relaxed break-words text-cyan-text max-h-[180px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-mono">{stegdetectReport.spatial.details}</pre>
                    </div>
                  )}
                  {stegdetectReport.dct && (
                    <div className="p-2 bg-bg-void/80 border border-cyan-primary/20 font-mono text-[12px] leading-relaxed break-words text-cyan-text max-h-[180px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-mono">{stegdetectReport.dct.details}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "exif" && (
            <div className="space-y-4">
              <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-primary uppercase">EXIF METADATA DICTIONARY</h3>
              {!exifData || Object.keys(exifData).length === 0 ? (
                <div className="text-center py-8 text-text-dim italic">
                  <p className="font-share text-[13px] uppercase tracking-widest">NO EXIF METADATA DETECTED</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {Object.entries(exifData).map(([key, value]) => (
                    <div key={key} className="flex justify-between p-2 border-b border-border-hairline/10 font-mono text-[13px]">
                      <span className="text-text-dim uppercase">{key}</span>
                      <span className="text-text-primary text-right">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "ink" && (
            <div className="space-y-4">
              <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-primary uppercase">CONTRAST NORMALIZATION &amp; SPECTRAL ANALYSIS</h3>
              <button
                disabled={!hasRealFile || isDetectingInk}
                onClick={handleInkDetection}
                className="w-full py-3 bg-cyan-primary text-bg-void font-display font-black text-xs tracking-widest uppercase hover:bg-white transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>{isDetectingInk ? "ANALYZING CHANNELS..." : "RUN INVISIBLE INK SCAN"}</span>
              </button>
              {!inkEnhancedPreview ? (
                <div className="text-center py-8 text-text-dim italic">
                  <p className="font-share text-[13px] uppercase tracking-widest">AWAITING SPECTRAL SCAN</p>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[13px] font-black text-cyan-primary uppercase">ENHANCED CARRIER</span>
                    <Badge variant={inkConfidence > 0.6 ? "cyan" : "dim"} size="xs">CONFIDENCE: {(inkConfidence * 100).toFixed(0)}%</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="aspect-square bg-bg-void border border-border-hairline/10 overflow-hidden">
                      <img src={activePreview!} alt="Original" className="w-full h-full object-cover" />
                    </div>
                    <div className="aspect-square bg-bg-void border border-cyan-primary/20 overflow-hidden">
                      <img src={inkEnhancedPreview} alt="Enhanced" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <a
                    href={inkEnhancedPreview}
                    download="enhanced_ink_carrier.png"
                    className="w-full py-2 bg-bg-void border border-cyan-primary/40 text-cyan-primary font-display text-[13px] font-bold tracking-widest uppercase hover:bg-cyan-primary hover:text-bg-void transition-all flex items-center justify-center space-x-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT ENHANCED IMAGE</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === "qr" && (
            <div className="space-y-4">
              <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-primary uppercase">QR CODE DECODER</h3>
              <button
                disabled={!hasRealFile || isScanningQr}
                onClick={handleQrScan}
                className="w-full py-3 bg-cyan-primary text-bg-void font-display font-black text-xs tracking-widest uppercase hover:bg-white transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <QrCode className="w-4 h-4" />
                <span>{isScanningQr ? "SCANNING BUFFER..." : "DECODE QR SIGNATURE"}</span>
              </button>
              {!qrScanAttempted ? (
                <div className="text-center py-8 text-text-dim italic">
                  <p className="font-share text-[13px] uppercase tracking-widest">AWAITING QR SCAN</p>
                </div>
              ) : !qrResult ? (
                <div className="bg-bg-void/40 border border-red-threat/20 p-4 text-center">
                  <AlertTriangle className="w-6 h-6 text-red-threat mx-auto mb-2 opacity-50" />
                  <p className="font-share text-[13px] text-red-threat uppercase tracking-widest font-bold">NO QR SIGNATURE DETECTED</p>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <div className="p-2 bg-bg-void/80 border border-cyan-primary/20 font-mono text-[13px] leading-relaxed break-words select-text text-cyan-text min-h-[80px]">
                    {qrResult.data}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(qrResult.data);
                      addLog("QR DATA COPIED TO CLIPBOARD", "info", "SYS");
                    }}
                    className="w-full py-2 bg-bg-void border border-border-hairline/20 text-text-primary font-display text-[12px] font-bold tracking-widest uppercase hover:border-cyan-primary/50 transition-all flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-3 h-3" />
                    <span>COPY DECODED DATA</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "stereogram" && (
            <div className="space-y-4">
              <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-primary uppercase">AUTOSTEREOGRAM DEPTH RECONSTRUCTION</h3>
              <button
                disabled={!hasRealFile || isSolvingStereogram}
                onClick={handleStereogramSolver}
                className="w-full py-3 bg-cyan-primary text-bg-void font-display font-black text-xs tracking-widest uppercase hover:bg-white transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <Layers className="w-4 h-4" />
                <span>{isSolvingStereogram ? "ESTIMATING DEPTH..." : "RECONSTRUCT DEPTH MAP"}</span>
              </button>
              {!stereogramDepthPreview ? (
                <div className="text-center py-8 text-text-dim italic">
                  <p className="font-share text-[13px] uppercase tracking-widest">AWAITING DEPTH RECONSTRUCTION</p>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <div className="aspect-video bg-bg-void border border-cyan-primary/20 overflow-hidden">
                    <img src={stereogramDepthPreview} alt="Depth Map" className="w-full h-full object-contain" />
                  </div>
                  <a
                    href={stereogramDepthPreview}
                    download="stereogram_depth_map.png"
                    className="w-full py-2 bg-bg-void border border-cyan-primary/40 text-cyan-primary font-display text-[13px] font-bold tracking-widest uppercase hover:bg-cyan-primary hover:text-bg-void transition-all flex items-center justify-center space-x-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT DEPTH MAP</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === "c2pa" && (
            <div className="space-y-4">
              <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-primary uppercase">C2PA CONTENT CREDENTIALS</h3>
              <button
                disabled={!hasRealFile || isReadingC2pa}
                onClick={handleC2paRead}
                className="w-full py-3 bg-cyan-primary text-bg-void font-display font-black text-xs tracking-widest uppercase hover:bg-white transition-all disabled:opacity-40 flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isReadingC2pa ? "VERIFYING MANIFEST..." : "VERIFY CREDENTIALS"}</span>
              </button>
              {!c2paAttempted ? (
                <div className="text-center py-8 text-text-dim italic">
                  <p className="font-share text-[13px] uppercase tracking-widest">AWAITING PROVENANCE VERIFICATION</p>
                </div>
              ) : !c2paManifest ? (
                <div className="bg-bg-void/40 border border-red-threat/20 p-4 text-center">
                  <AlertTriangle className="w-6 h-6 text-red-threat mx-auto mb-2 opacity-50" />
                  <p className="font-share text-[13px] text-red-threat uppercase tracking-widest font-bold">NO CONTENT CREDENTIALS FOUND</p>
                </div>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <div className="p-3 bg-bg-void/40 border border-border-hairline/10 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-share text-[12px] text-text-dim uppercase">PRODUCER</span>
                      <span className="font-mono text-[12px] text-text-primary uppercase">{c2paManifest.activeManifest.producer?.name || "UNKNOWN"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-share text-[12px] text-text-dim uppercase">CLAIM GENERATOR</span>
                      <span className="font-mono text-[12px] text-text-primary uppercase">{c2paManifest.activeManifest.claimGenerator || "N/A"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="p-3 bg-red-threat/[0.02] border-red-threat/20" clipSize="sm">
          <div className="flex items-start space-x-3">
            <div className="w-7 h-7 rounded-full bg-red-threat/10 border border-red-threat/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-red-threat" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-[12px] font-black text-red-threat uppercase tracking-widest">BELFRY ADVISORY</h4>
              <p className="font-share text-[12px] text-text-dim leading-relaxed uppercase tracking-tighter">
                Treat results from unverified paths (BMP/WAV, other cipher modes, OutGuess) as best-effort. Analysis should be performed in an isolated sandbox; hidden payloads may contain malicious content.
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
