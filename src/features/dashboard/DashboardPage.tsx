import React, { useState } from "react";
import { useAppStore, Case, EvidenceItem } from "../../store/appStore";
import GlassPanel from "../../components/ui/GlassPanel";
import DecryptText from "../../components/ui/DecryptText";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import ProgressBar from "../../components/ui/ProgressBar";
import ScannerAnimation from "../../components/ui/ScannerAnimation";
import Terminal from "../../components/ui/Terminal";
import NeuralActivity from "../../components/ui/NeuralActivity";
import HexCluster from "../../components/ui/HexCluster";
import AnimatedCounter from "../../components/ui/AnimatedCounter";
import CorrelationNetwork from "../../components/ui/CorrelationNetwork";
import HeroStat from "../../components/ui/HeroStat";
import RegistrationFrame from "../../components/ui/RegistrationFrame";
import DatabaseTag from "../../components/ui/DatabaseTag";
import VignetteBackdrop from "../../components/ui/VignetteBackdrop";
import ShinyText from "../../components/react-bits/ShinyText";
import BlurText from "../../components/react-bits/BlurText";
import SplitText from "../../components/react-bits/SplitText";
import { playHoverBlip } from "../../lib/soundEngine";
import { 
  FileText, 
  Upload, 
  Search, 
  Trash2, 
  Database, 
  ShieldAlert, 
  ChevronRight, 
  User, 
  Fingerprint, 
  MapPin, 
  Scale, 
  CheckCircle,
  Hash,
  Shield,
  Lock,
  Cpu,
  Network
} from "lucide-react";

export default function DashboardPage() {
  const { 
    cases, 
    activeCaseId, 
    selectCase, 
    addEvidenceNode,
    logs, 
    addLog, 
    isScanning, 
    scanProgress, 
    scanResults, 
    scannedEvidence, 
    triggerForensicScan,
    setModule,
    evidenceNodes,
    evidenceConnections
  } = useAppStore();

  const [textInput, setTextInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [targetCaseId, setTargetCaseId] = useState(activeCaseId || "");
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [scanAlert, setScanAlert] = useState<string | null>(null);

  React.useEffect(() => {
    if (!scanAlert) return;
    const t = setTimeout(() => setScanAlert(null), 3200);
    return () => clearTimeout(t);
  }, [scanAlert]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setUptimeSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, "0");
    const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, "0");
    const secs = (totalSecs % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };
  // The dashboard dossier list is a working list: only cases still open.
  // Solved and archived records live in Case Files.
  const activeCases = React.useMemo(
    () => cases.filter((c) => c.status === "ACTIVE" || c.status === "STALLED"),
    [cases],
  );


  // Get active case file details
  // Fall back to an open case, not just the first record in storage — with
  // nothing selected this surfaced whichever case happened to be stored first,
  // which could be archived.
  const activeCase =
    cases.find((c) => c.id === activeCaseId) || activeCases[0] || cases[0];

  const handleScanTrigger = () => {
    if (!textInput.trim()) {
      addLog("SCAN ABORTED: Input buffer is completely empty", "warning", "SYS");
      setScanAlert("NO SIGNAL // ANALYSIS BUFFER EMPTY — PASTE INTERCEPT DATA");
      return;
    }
    setScanAlert(null);

    triggerForensicScan({
      name: `PASTED_INPUT_${Date.now()}`,
      type: "ciphertext",
      rawContent: textInput
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setTextInput(`[Raw binary stream from File: ${file.name}] size: ${file.size} bytes`);
      addLog(`EXTERNAL FILE DROP: "${file.name}" loaded into buffer`, "info", "DEPOSITION");
      
      // Auto trigger scan
      triggerForensicScan({
        name: file.name,
        type: file.type.includes("image") ? "image" : file.type.includes("audio") ? "audio" : "ciphertext",
        rawContent: `custom dropped stream of ${file.name}`, file
      });
    }
  };

  const getStatusBadgeVariant = (status: Case["status"]) => {
    switch (status) {
      case "ACTIVE": return "cyan";
      case "SOLVED": return "green";
      case "ARCHIVED": return "dim";
      case "STALLED": return "amber";
      default: return "cyan";
    }
  };

  return (
    <div className="h-full w-full p-4 grid grid-cols-12 gap-4 overflow-y-auto overflow-x-hidden select-none relative pb-20">
      
      {/* Immersive background idle data-flow/grid pulse treatment scoped to Dashboard */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--rgb-accent) / 0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--rgb-accent) / 0.03)_1px,transparent_1px)] bg-[size:32px_32px] animate-[pulse_8s_infinite]" />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-primary/5 rounded-full blur-[120px] animate-[pulse_4s_infinite_alternate]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-threat/[0.02] rounded-full blur-[150px] animate-[pulse_6s_infinite_alternate]" />
      </div>

      {/* ================= HIGH-TECH DENSE HUD READOUT STRIP ================= */}
      <RegistrationFrame className="col-span-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-bg-void/60 border border-cyan-primary/20 p-2.5 relative overflow-hidden z-10"
             style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}>
          {/* Subtle grid pattern overlay */}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
          {/* Glowing laser line scanning the strip */}
          <div className="absolute inset-x-0 h-[1px] bg-cyan-primary/25 top-0 animate-[scanline-vertical_4s_infinite] pointer-events-none" />
          
          {/* Telemetry Item 1: Active Cases */}
          <div className="bg-bg-void/40 border border-border-hairline/10 p-2 flex flex-col justify-center relative">
            <DatabaseTag text="ACTIVE DOSSIERS" className="mb-1.5 self-start" />
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="font-display font-extrabold text-2xl text-white leading-none tracking-tight">{cases.filter(c => c.status === "ACTIVE").length}</span>
              <span className="text-[13px] text-text-dim font-share">/ {cases.length} TOTAL</span>
            </div>
          </div>

          {/* Telemetry Item 2: Connected Nodes */}
          <div className="bg-bg-void/40 border border-border-hairline/10 p-2 flex flex-col justify-center relative">
            <DatabaseTag text="SECURED EVIDENCE" className="mb-1.5 self-start" />
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="font-display font-extrabold text-2xl text-white leading-none tracking-tight">{evidenceNodes.length}</span>
              <span className="text-[13px] text-text-dim font-share">CLUES RECORDED</span>
            </div>
          </div>

          {/* Telemetry Item 3: Core Uptime */}
          <div className="bg-bg-void/40 border border-border-hairline/10 p-2 flex flex-col justify-center relative">
            <DatabaseTag text="SECURE UPLINK" className="mb-1.5 self-start" />
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="font-mono text-[13px] text-green-verified leading-none font-bold uppercase animate-pulse">● ONLINE</span>
              <span className="font-mono text-[13px] text-cyan-dim/80">{formatUptime(uptimeSeconds)}</span>
            </div>
          </div>

          {/* Telemetry Item 4: Encryption Solved Ratio */}
          <div className="bg-bg-void/40 border border-border-hairline/10 p-2 flex flex-col justify-center relative">
            <DatabaseTag text="INTEGRITY MATRIX" className="mb-1.5 self-start" />
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="font-display font-extrabold text-2xl text-white leading-none tracking-tight">
                {Math.round(((cases.filter(c => c.status === "SOLVED").length) / (cases.length || 1)) * 100)}%
              </span>
              <span className="text-[13px] text-text-dim font-share">SOLVED RATIO</span>
            </div>
          </div>

          {/* Telemetry Item 5: Buffer Size */}
          <div className="bg-bg-void/40 border border-border-hairline/10 p-2 flex flex-col justify-center relative">
            <DatabaseTag text="ANALYZER BUFFER" className="mb-1.5 self-start" />
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="font-display font-extrabold text-2xl text-white leading-none tracking-tight">{textInput.length}</span>
              <span className="text-[13px] text-text-dim font-share">CHARS LOADED</span>
            </div>
          </div>

          {/* Telemetry Item 6: Active Location */}
          <div className="bg-bg-void/40 border border-border-hairline/10 p-2 flex flex-col justify-center relative">
            <DatabaseTag text="NETWORK SECTOR" className="mb-1.5 self-start" />
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="font-mono text-[13px] text-amber-alert font-bold uppercase leading-none truncate">SECTOR_NORTH_09</span>
            </div>
          </div>
        </div>
      </RegistrationFrame>

      {/* ================= LEFT SECTION: DOSSIERS & TERMINAL ================= */}
      <div className="col-span-12 xl:col-span-2 flex flex-col space-y-4 min-h-[500px] xl:h-full xl:min-h-0">
        
        {/* Case File Selector / Dossier Panel */}
        <GlassPanel className="p-4 flex flex-col flex-1" clipSize="md">
          <div className="border-b border-border-hairline/25 pb-2 mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-extrabold tracking-[0.18em] text-white uppercase flex items-center">
              <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
              <ShinyText text="CASE DOSSIER LIST" speed={5} />
            </h3>
            {/* Uplink diagnostics */}
            <div className="flex items-center space-x-1.5 font-mono text-[12px] text-cyan-primary/50">
              <span className="animate-[pulse_3s_infinite] text-[12px] tracking-widest">[UPLINK_SECURE]</span>
              <span className="w-1.5 h-1.5 bg-cyan-primary/40 rounded-full animate-[pulse_3s_infinite]" />
            </div>
          </div>
          <p className="text-xs font-share text-text-dim tracking-wide uppercase mt-0.5 mb-3">
            Select subject record for target synchronization
          </p>

          {/* List of Dossiers */}
          <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[180px] xl:max-h-none scrollbar-thin scrollbar-thumb-cyan-dim/20 pr-1">
            {activeCases.length === 0 ? (
              <button
                onClick={() => setModule("case-files")}
                onMouseEnter={() => playHoverBlip()}
                className="hud-target w-full p-5 flex flex-col items-center justify-center text-center gap-2.5 border border-dashed border-border-hairline/25 bg-bg-void/30 relative overflow-hidden group"
                style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
              >
                {/* Idle radar sweep — the archive is listening, just empty */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
                  <div className="w-40 h-40 border border-cyan-primary/40 rounded-full animate-radar-sweep">
                    <div className="w-full h-[1px] bg-cyan-primary/30 mt-[80px]" />
                  </div>
                </div>
                <Database className="w-6 h-6 text-cyan-dim/60 group-hover:text-cyan-primary transition-colors relative z-10" />
                <span className="font-display text-[13px] font-black tracking-widest text-text-dim uppercase relative z-10">
                  NO ACTIVE DOSSIERS
                </span>
                <span className="font-share text-[12px] text-text-dim/60 tracking-wide uppercase relative z-10 leading-relaxed">
                  No open cases — register or reopen one in Case Files
                </span>
                <span className="font-share text-[12px] text-cyan-primary/70 tracking-[0.2em] uppercase mt-1 relative z-10 group-hover:text-cyan-primary transition-colors">
                  › INITIALIZE ARCHIVE
                </span>
              </button>
            ) : (
              activeCases.map((c) => {
                const isSelected = c.id === activeCaseId;
                const dotColor = c.status === "ACTIVE" ? "bg-green-active" : c.status === "STALLED" ? "bg-amber-alert" : "bg-cyan-primary";
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCase(c.id)}
                    onMouseEnter={() => playHoverBlip()}
                    className={`hud-target w-full text-left p-2.5 border transition-all duration-300 flex items-center justify-between relative overflow-hidden group ${
                      isSelected
                        ? "bg-cyan-primary/[0.06] border-cyan-primary text-text-primary shadow-[0_0_8px_rgb(var(--rgb-accent) / 0.15)]"
                        : "bg-bg-void/40 border-border-hairline/15 text-text-dim hover:border-cyan-primary/35 hover:bg-cyan-primary/[0.02]"
                    }`}
                    style={{
                      clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)"
                    }}
                  >
                    {/* Subtle scan-line overlay on hover */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(var(--rgb-accent) / 0)_50%,rgb(var(--rgb-accent) / 0.06)_50%)] bg-[size:100%_4px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    {/* Corner reticle highlight on active selection */}
                    {isSelected && (
                      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-primary" />
                    )}

                    <div className="flex items-center space-x-2.5 min-w-0 relative z-10">
                      <div className={`w-7 h-7 border flex items-center justify-center transition-colors duration-300 ${
                        isSelected ? "border-cyan-primary/50 text-cyan-primary bg-cyan-primary/10 animate-[pulse_2s_infinite]" : "border-border-hairline/25 text-text-dim group-hover:border-cyan-primary/40 group-hover:text-cyan-text"
                      }`}
                           style={{ clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)" }}>
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-chakra text-xs font-bold uppercase tracking-wider truncate leading-none group-hover:text-cyan-text transition-colors duration-200">
                          {c.title}
                        </p>
                        <p className="font-share text-[13px] text-text-dim tracking-wide truncate mt-1 max-w-[150px]">
                          {c.synopsis}
                        </p>
                      </div>
                    </div>

                    {/* Animated active status indicator instead of static badge */}
                    <div className="flex items-center space-x-1.5 shrink-0 relative z-10 font-mono text-[13px]">
                      <span className={`tracking-widest uppercase font-bold ${isSelected ? "text-cyan-text" : "text-text-dim/80"}`}>{c.status}</span>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`} />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Dossier Profile Sheet (Subject Bio reference design) */}
          {activeCase ? (
            <GlassPanel className="p-3.5 mt-3 space-y-3 bg-bg-void/30 relative overflow-hidden" clipSize="md" showCornerTicks={true}>
              {/* Target-acquisition snap box overlay */}
              <div key={activeCase.id} className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute inset-0 border border-transparent animate-lock-on-snap" />
                <div className="absolute top-2 right-2 flex items-center space-x-0.5 h-2">
                  <span className="w-[1.5px] h-1.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0s" }} />
                  <span className="w-[1.5px] h-2.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0.1s" }} />
                  <span className="w-[1.5px] h-3.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-display text-[13px] font-black text-text-primary tracking-widest uppercase flex items-center min-w-0" title={activeCase.title} key={activeCase.id}>
                    <span className="truncate">{activeCase.title}</span>
                  </h4>
                  <p className="font-share text-[13px] text-text-dim/60 uppercase">
                    SYS_INDEXED: {new Date(activeCase.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={getStatusBadgeVariant(activeCase.status)} size="xs">
                  {activeCase.status}
                </Badge>
              </div>

              {/* Grid specifications */}
              <div className="grid grid-cols-2 gap-2 font-share text-[13px] border-y border-border-hairline/15 py-2">
                <div className="space-y-0.5 col-span-2">
                  <span className="text-text-dim block text-[13px]">BRIEFING INTEL SYNOPSIS:</span>
                  <p className="text-text-primary font-sans italic text-[13px] leading-snug line-clamp-2">
                    "{activeCase.synopsis}"
                  </p>
                </div>
              </div>

              {/* Dossier Notes Preview */}
              {activeCase.notes ? (
                <div className="space-y-1">
                  <span className="text-text-dim block text-[13px]">SAVED JOURNAL PREVIEW:</span>
                  <p className="text-[13px] leading-relaxed text-cyan-text/80 font-mono italic pr-1 max-h-[60px] overflow-y-auto scrollbar-none line-clamp-2">
                    "{activeCase.notes}"
                  </p>
                </div>
              ) : null}
            </GlassPanel>
          ) : (
            <div className="p-4 border border-border-hairline/10 bg-bg-void/10 text-center text-xs text-text-dim mt-3 uppercase">
              NO ACTIVE DOSSIER FOCUS
            </div>
          )}
        </GlassPanel>

        {/* Console Logs Terminal Component */}
        <div className="h-48 xl:h-64 flex flex-col">
          <Terminal lines={logs} />
        </div>

      </div>

      {/* ================= CENTER SECTION: FORENSIC ANALYZER ================= */}
      <div className="col-span-12 xl:col-span-8 flex flex-col min-h-[500px] xl:h-full space-y-4 xl:min-h-0">
        
        {/* "ANALYZE ANYTHING" HUD Console */}
        <RegistrationFrame className="flex-1 flex flex-col min-h-0" glow={isScanning}>
          <GlassPanel className="p-5 flex-1 flex flex-col relative overflow-hidden min-h-0" clipSize="md" showScanlines={isScanning}>
            <VignetteBackdrop intensity="medium" />
            
            {/* Scanning Animation */}
          <ScannerAnimation active={isScanning} scanLabel="SCANNING INPUT SPECTRUM" />

          {/* Top border header banner */}
          <div className="border-b border-border-hairline/25 pb-3 mb-4 flex justify-between items-center relative z-10">
            <div>
              <h2 className="font-display text-base font-black tracking-widest text-cyan-text flex items-center uppercase animate-data-assemble">
                <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                <ShinyText text="FORENSIC SCANNER // ANALYZE ANY EVIDENCE" speed={6} />
              </h2>
              <p className="text-xs font-share text-text-dim tracking-wide uppercase mt-0.5">
                Drop raw files, paste cipherstrings, or trigger mock sensor intercepts
              </p>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              <div className="flex items-end space-x-0.5 h-3 mr-1">
                <span className="w-[1.5px] h-1.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0s" }} />
                <span className="w-[1.5px] h-2.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0.15s" }} />
                <span className="w-[1.5px] h-3.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0.3s" }} />
              </div>
              {/* Quick clean button */}
              <button
                onClick={() => {
                  setTextInput("");
                  addLog("CLEARED ANALYSIS BUFFER STACK", "info", "BUFFER");
                }}
                disabled={isScanning}
                className="p-1.5 border border-border-hairline/20 bg-bg-void hover:bg-red-threat/10 hover:border-red-threat/50 text-text-dim hover:text-red-threat transition-colors duration-200"
                title="Clear Buffer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Drag & Drop Input Container */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`flex-1 border border-dashed p-4 flex flex-col relative z-10 transition-all duration-300 ${
              dragActive 
                ? "border-cyan-primary bg-cyan-primary/[0.03]" 
                : "border-border-hairline/25 bg-bg-void/30"
            }`}
          >
            {/* Ambient rotating radar sweep background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03] flex items-center justify-center">
              <div className="w-72 h-72 border border-cyan-primary/30 rounded-full flex items-center justify-center animate-radar-sweep">
                <div className="w-full h-[1px] bg-cyan-primary/20" />
                <div className="h-full w-[1px] bg-cyan-primary/20" />
                <div className="w-48 h-48 border border-dashed border-cyan-primary/20 rounded-full" />
              </div>
            </div>

            {/* Overlay grid design for aesthetic density */}
            <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

            <div className="flex-1 flex flex-col">
              <textarea
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                }}
                disabled={isScanning}
                placeholder="PASTE CIPHERTEXT, RAW HEX ENCODING OR BINARY TELEMETRY STRINGS HERE FOR FORENSIC DECODING... OR DROP FILE DIRECTLY IN THIS STAGE CONTAINER"
                className="w-full flex-1 bg-transparent text-cyan-dim placeholder:text-text-dim/40 font-mono text-[13px] leading-relaxed resize-none border-0 outline-none focus:ring-0 p-0 overflow-y-auto scrollbar-thin relative z-20"
              />
            </div>

            {/* Bottom info strip in text area */}
            <div className="border-t border-border-hairline/15 pt-2 mt-2 flex justify-between items-center text-[13px] font-share text-text-dim">
              <div className="flex items-center space-x-2">
                <Upload className="w-3.5 h-3.5" />
                <span>DRAG & DROP SENSOR CAPTURE INTERCEPT</span>
              </div>
              <span>CHARS: {textInput.length}</span>
            </div>
          </div>

          {/* In-fiction alert state: buffer-empty scan abort */}
          {scanAlert && (
            <div
              className="mt-4 relative z-10 flex items-center gap-2.5 px-3 py-2.5 border border-amber-alert/60 bg-amber-alert/[0.06] text-amber-alert overflow-hidden animate-stagger-in file-threat-pulse"
              style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
            >
              <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgb(var(--rgb-amber) / 0.06)_0,rgb(var(--rgb-amber) / 0.06)_8px,transparent_8px,transparent_16px)] pointer-events-none" />
              <ShieldAlert className="w-4 h-4 shrink-0 amber-glow animate-pulse relative z-10" />
              <span className="font-share text-[13px] tracking-widest uppercase font-bold amber-glow relative z-10">{scanAlert}</span>
              <span className="ml-auto flex items-end gap-0.5 h-3 relative z-10">
                <span className="w-[1.5px] h-1.5 bg-amber-alert/70 animate-signal-bar-tick" style={{ animationDelay: "0s" }} />
                <span className="w-[1.5px] h-2.5 bg-amber-alert/70 animate-signal-bar-tick" style={{ animationDelay: "0.12s" }} />
                <span className="w-[1.5px] h-3.5 bg-amber-alert/70 animate-signal-bar-tick" style={{ animationDelay: "0.24s" }} />
              </span>
            </div>
          )}

          {/* Scan trigger bar */}
          <div className="mt-4 flex space-x-3 relative z-10">
            <button
              onClick={handleScanTrigger}
              disabled={isScanning}
              className={`tablet-btn hud-target flex-1 text-sm py-3 relative flex items-center justify-center space-x-2 ${
                isScanning
                  ? "tablet-active cursor-not-allowed"
                  : textInput.trim()
                  ? "cursor-pointer"
                  : "cursor-pointer"
              }`}
              // Amber frame when there is nothing to scan yet, cyan once armed,
              // teal while running — the reference's three-state register.
              style={
                {
                  "--frame-color": isScanning
                    ? "#00ffbe"
                    : textInput.trim()
                    ? "var(--color-accent-primary)"
                    : "var(--color-amber-alert)",
                } as React.CSSProperties
              }
            >
              <Search className="w-4 h-4" />
              <span>{isScanning ? `ANALYZING EVIDENCE (${scanProgress}%)` : "INITIALIZE FORENSIC SCAN"}</span>
            </button>
          </div>

          {/* SCANNED EVIDENCE RESULT PANEL (Rendered after successful scan) */}
          {scannedEvidence && !isScanning && (
            <div className="mt-4 border border-cyan-primary/40 bg-cyan-primary/[0.02] p-4 relative animate-stagger-in overflow-hidden power-sweep"
                 style={{ clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)" }}>
              {/* Subtle CorrelationNetwork success background animation */}
              <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
                <CorrelationNetwork nodeCount={15} connectionDistance={55} />
              </div>

              {/* Target-acquisition snap box overlay */}
              <div key={scannedEvidence.id} className="absolute inset-0 border border-transparent pointer-events-none animate-lock-on-snap z-10" />

              {/* Corner reticle line ticks */}
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-primary" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-primary" />

              <div className="flex justify-between items-end mb-4 border-b border-cyan-primary/10 pb-3 z-10 relative">
                <div className="flex-1 min-w-0">
                  <HeroStat
                    label="EVIDENCE ACQUIRED"
                    value={
                      <div className="flex items-center text-sm font-black uppercase tracking-wider text-cyan-text truncate">
                        <Fingerprint className="w-3.5 h-3.5 mr-1.5 text-cyan-primary shrink-0" />
                        <span>{scannedEvidence.id} // {scannedEvidence.name}</span>
                      </div>
                    }
                    valueClassName="text-cyan-text"
                  />
                </div>
                <div className="text-right ml-4 shrink-0">
                  <HeroStat
                    label="CONFIDENCE"
                    value={<AnimatedCounter value={scannedEvidence.confidence} suffix="%" />}
                    valueClassName="text-xl md:text-2xl font-black text-green-verified cyan-glow"
                    disabledShine={true}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 font-share text-[13px] border-t border-cyan-primary/10 pt-2.5">
                <div>
                  <span className="text-text-dim block uppercase">RECOVERY VECTOR:</span>
                  <span className="text-text-primary font-bold">{scannedEvidence.source}</span>
                </div>
                <div>
                  <span className="text-text-dim block uppercase">IDENTIFIED SIGNATURE:</span>
                  <span className="text-green-verified font-bold flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    <DecryptText text={scanResults[0]?.name || ""} trigger={scannedEvidence?.id} className="text-green-verified" />
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-text-dim block uppercase">DIAGNOSTIC EXTRAPOLATION:</span>
                  <p className="text-text-primary/95 leading-normal mt-0.5">
                    <DecryptText text={scannedEvidence.notes} trigger={scannedEvidence?.id} duration={1200} silent />
                  </p>
                </div>
              </div>

              <div className="mt-3.5 flex justify-end space-x-3.5 font-chakra text-[13px]">
                <div className="flex items-center space-x-2">
                  {showPicker ? (
                    <>
                      <select 
                        value={targetCaseId || activeCaseId || (cases[0]?.id || "")} 
                        onChange={(e) => setTargetCaseId(e.target.value)}
                        className="bg-bg-void border border-cyan-primary/30 text-cyan-text text-[13px] p-1 uppercase font-chakra tracking-wider"
                      >
                        {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <button 
                        onClick={() => {
                          if (!scannedEvidence) return;
                          const caseId = targetCaseId || activeCaseId || (cases[0]?.id || "");
                          if (!caseId) return;
                          
                          if (activeCaseId !== caseId) {
                            selectCase(caseId);
                          }
                          
                          addEvidenceNode({ 
                            type: "file", 
                            content: scannedEvidence.notes, 
                            title: scannedEvidence.name, 
                            x: 100 + Math.random() * 100, 
                            y: 100 + Math.random() * 100 
                          });
                          
                          addLog(`ADDED EVIDENCE ITEM ${scannedEvidence.id} TO CASE DATABASE`, "success", "SYS");
                          setModule("detective-board");
                          setShowPicker(false);
                        }}
                        className="px-4 py-1.5 border border-green-verified/30 text-green-verified hover:bg-green-verified hover:text-bg-void transition-colors uppercase tracking-widest font-black"
                        style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
                      >
                        CONFIRM
                      </button>
                      <button 
                        onClick={() => setShowPicker(false)}
                        className="px-2 py-1.5 text-text-dim hover:text-text-primary transition-colors uppercase tracking-widest font-black text-[13px]"
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => setShowPicker(true)}
                      className="px-4 py-1.5 border border-cyan-primary/30 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors uppercase tracking-widest font-black"
                      style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
                    >
                      ADD TO DOSSIER
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          </GlassPanel>
        </RegistrationFrame>

      </div>

      {/* ================= RIGHT SECTION: HEURISTIC PATTERNS & RADAR ================= */}
      <div className="col-span-12 xl:col-span-2 flex flex-col space-y-4 min-h-[500px] xl:h-full xl:min-h-0">
        
        {/* PATTERN ANALYSIS Detector Heuristics Panel */}
        <GlassPanel className="p-4 flex flex-col flex-1" clipSize="md">
          <div className="border-b border-border-hairline/25 pb-2 mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-extrabold tracking-[0.18em] text-white uppercase flex items-center">
              <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
              <ShinyText text="PATTERN HEURISTICS" speed={5} />
            </h3>
            <div className="flex items-end space-x-0.5 h-3">
              <span className="w-[1.5px] h-1.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0.1s" }} />
              <span className="w-[1.5px] h-2.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0.2s" }} />
              <span className="w-[1.5px] h-3.5 bg-cyan-primary/50 animate-signal-bar-tick" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
          <p className="text-xs font-share text-text-dim tracking-wide uppercase mt-0.5 mb-3">
            Encoding candidate classification percentages
          </p>

          {/* If scanned evidence, render real progress-bars. Otherwise, display standard baseline trackers */}
          <div className="space-y-4 flex-1 overflow-y-auto">
            {scanResults.length > 0 ? (
              scanResults.map((result, idx) => (
                <div key={idx} className="space-y-1.5 bg-bg-void/40 border border-cyan-primary/20 p-2.5 relative group overflow-hidden animate-[pulse_3s_infinite_alternate]">
                  {/* Glowing vertical scanning line inside each row for active feeling */}
                  <div className="absolute top-0 bottom-0 w-[1.5px] bg-cyan-primary/30 left-0 animate-[shimmer_2.5s_infinite]" style={{ animationDelay: `${idx * 0.4}s` }} />
                  {/* Top corner triangle notch */}
                  <div className="absolute top-0 right-0 w-2 h-2 bg-cyan-primary/15" />
                  
                  <div className="flex justify-between items-start relative z-10">
                    <span className="font-chakra text-[13px] font-extrabold tracking-wider text-text-primary uppercase flex items-center">
                      <Hash className="w-3.5 h-3.5 mr-1 text-cyan-dim" />
                      <DecryptText text={result.name} trigger={scannedEvidence?.id} silent />
                    </span>
                    <div className="flex items-center space-x-1">
                      {result.isMatch && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-[pulse_1.5s_infinite]" />
                      )}
                      <Badge variant={result.isMatch ? "green" : "dim"} size="xs">
                        {result.isMatch ? "RECOMMENDED" : "CANDIDATE"}
                      </Badge>
                    </div>
                  </div>

                  <div className="relative animate-[pulse_2.5s_infinite_alternate] z-10">
                    <ProgressBar value={result.confidence} variant={result.isMatch ? "green" : "cyan"} showValue={true} />
                  </div>

                  <p className="text-[13px] leading-relaxed text-text-dim mt-1.5 font-share italic relative z-10">
                    "<DecryptText text={result.details} trigger={scannedEvidence?.id} duration={1000} silent />"
                  </p>
                </div>
              ))
            ) : (
              // Default background standby heuristic rows (made to feel alive at rest)
              <div className="space-y-3.5">
                <div className="bg-bg-void/40 border border-border-hairline/10 p-2.5 opacity-50 space-y-1 animate-[pulse_4s_infinite_alternate]">
                  <div className="flex justify-between text-[13px] font-chakra font-bold">
                    <span className="tracking-wide">BASE64 INDEXED</span>
                    <span className="text-text-dim font-mono animate-pulse">STANDBY</span>
                  </div>
                  <ProgressBar value={0} variant="cyan" showValue={false} />
                  <span className="text-[13px] font-share text-text-dim block mt-1">Awaiting sensor data buffer stream...</span>
                </div>
                <div className="bg-bg-void/40 border border-border-hairline/10 p-2.5 opacity-50 space-y-1 animate-[pulse_4s_infinite_alternate]" style={{ animationDelay: "1.2s" }}>
                  <div className="flex justify-between text-[13px] font-chakra font-bold">
                    <span className="tracking-wide">ROT13 ALPHABETICAL</span>
                    <span className="text-text-dim font-mono animate-pulse">STANDBY</span>
                  </div>
                  <ProgressBar value={0} variant="cyan" showValue={false} />
                  <span className="text-[13px] font-share text-text-dim block mt-1">Awaiting sensor data buffer stream...</span>
                </div>
                <div className="bg-bg-void/40 border border-border-hairline/10 p-2.5 opacity-50 space-y-1 animate-[pulse_4s_infinite_alternate]" style={{ animationDelay: "2.4s" }}>
                  <div className="flex justify-between text-[13px] font-chakra font-bold">
                    <span className="tracking-wide">VIGENÈRE CYCLICAL</span>
                    <span className="text-text-dim font-mono animate-pulse">STANDBY</span>
                  </div>
                  <ProgressBar value={0} variant="cyan" showValue={false} />
                  <span className="text-[13px] font-share text-text-dim block mt-1">Awaiting sensor data buffer stream...</span>
                </div>
              </div>
            )}
          </div>

          {/* Observations Panel */}
          <div className="border-t border-border-hairline/25 pt-3 mt-3 space-y-1.5 text-[13px] font-share text-text-dim">
            <span className="text-[13px] font-bold text-cyan-dim block">FORENSIC OBSERVATION FEED</span>
            <div className="bg-cyan-primary/[0.02] border border-cyan-primary/10 p-2 text-text-primary/90 text-[13px] leading-relaxed font-sans italic">
              "System filters for recurring cryptographic markers in raw buffers. High-entropy streams default to base-ranking, which flags patterns matching standard Base64, ROT13, EXIF block headers, and Meyda voice vectors."
            </div>
          </div>
        </GlassPanel>

        {/* LATTICE — ornamental, cursor-reactive. Replaced a "gadget matrix" of
            buttons that implied capabilities the app does not have; the three
            routes it exposed are all reachable from the sidebar. */}
        <GlassPanel className="p-4 flex flex-col justify-between amber-tab" clipSize="md" showCornerTicks={true}>
          <div className="border-b border-border-hairline/25 pb-1 mb-2 flex items-baseline justify-between">
            <h3 className="font-display text-sm font-extrabold tracking-[0.18em] text-white flex items-center uppercase">
              <span className="w-1 h-2 bg-accent-primary mr-1.5 transform -skew-x-12 inline-block shadow-[0_0_4px_var(--color-accent-primary)]" />
              Neural Activity
            </h3>
            <span className="font-share text-[12px] tracking-widest text-text-dim/45 uppercase">
              Inference field
            </span>
          </div>

          {/* `relative` is required — NeuralActivity anchors itself with
              absolute inset-0 (see the note in that component). */}
          <div className="relative flex-1 my-2 min-h-[170px]">
            <NeuralActivity />
          </div>
        </GlassPanel>

      </div>

    </div>
  );
}
