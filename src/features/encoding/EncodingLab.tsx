import React, { useState, useMemo, useEffect } from "react";
import {
  Copy,
  CheckCircle,
  Database,
  ArrowRight,
  RefreshCw,
  Terminal,
  Cpu,
  CornerDownRight,
  Eye,
  Settings,
  HelpCircle,
  Activity,
  Zap,
  Layers,
  Search
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import { useAppStore } from "../../store/appStore";
import ShinyText from "../../components/react-bits/ShinyText";
import FactoryThroughputBar from "../../components/ui/FactoryThroughputBar";
import { playSuccessChime, playFailBuzz, playTypeKey, playHoverEvidence, playPinClick } from "../../lib/soundEngine";
import { getTool, asText, pipelineLayerIds } from "../../lib/tools/registry";
import { textToBigInteger, bigIntegerToText } from "../../lib/tools/utility/bigInteger";

// Custom premium component to render the branching breakout bus lines
interface BreakoutLineProps {
  index: number;
  total: number;
  isActive: boolean;
}

function BreakoutLine({ index, total, isActive }: BreakoutLineProps) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="w-12 h-full relative flex items-center justify-center shrink-0" id={`breakout-line-${index}`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 48 100" preserveAspectRatio="none">
        {/* Main Trunk Line */}
        {isFirst ? (
          <line
            x1="18"
            y1="50"
            x2="18"
            y2="100"
            stroke={isActive ? "var(--color-cyan-primary)" : "rgb(var(--rgb-accent) / 0.15)"}
            strokeWidth="2"
            className="transition-all duration-300"
          />
        ) : isLast ? (
          <line
            x1="18"
            y1="0"
            x2="18"
            y2="50"
            stroke={isActive ? "var(--color-cyan-primary)" : "rgb(var(--rgb-accent) / 0.15)"}
            strokeWidth="2"
            className="transition-all duration-300"
          />
        ) : (
          <line
            x1="18"
            y1="0"
            x2="18"
            y2="100"
            stroke={isActive ? "var(--color-cyan-primary)" : "rgb(var(--rgb-accent) / 0.15)"}
            strokeWidth="2"
            className="transition-all duration-300"
          />
        )}

        {/* Horizontal Branching Path */}
        <line
          x1="18"
          y1="50"
          x2="48"
          y2="50"
          stroke={isActive ? "var(--color-cyan-primary)" : "rgb(var(--rgb-accent) / 0.15)"}
          strokeWidth="2"
          className="transition-all duration-300"
        />

        {/* Intersection Dot */}
        <circle
          cx="18"
          cy="50"
          r={isActive ? "4" : "3"}
          fill={isActive ? "var(--color-cyan-primary)" : "rgb(var(--rgb-accent) / 0.25)"}
          className="transition-all duration-300"
        />

        {/* Port Terminal Block */}
        <rect
          x="44"
          y="46"
          width="4"
          height="8"
          fill={isActive ? "var(--color-cyan-primary)" : "rgb(var(--rgb-accent) / 0.15)"}
          className="transition-all duration-300"
        />
      </svg>

      {/* Floating data packet animation traveling down the branch */}
      {isActive && !shouldReduceMotion && (
        <motion.div
          className="absolute w-2 h-2 bg-cyan-primary rounded-full shadow-[0_0_8px_var(--color-accent-primary)]"
          initial={{ left: "18px", top: "50%", y: "-50%", x: "-50%" }}
          animate={{ left: "48px" }}
          transition={{
            duration: 1.0 + index * 0.1,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </div>
  );
}

// Simple logic analyzer oscilloscope graphic
function LogicOscilloscope({ isActive }: { isActive: boolean }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="h-10 w-full bg-bg-void/75 border border-border-hairline/10 rounded-sm overflow-hidden relative flex items-center px-2">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
      <div className="absolute top-1 left-2 font-mono text-[12px] text-cyan-dim/40 tracking-widest uppercase">
        SIGNAL WAVEFORM
      </div>
      <svg className="w-full h-8 opacity-80" viewBox="0 0 200 40" preserveAspectRatio="none">
        <motion.path
          d="M 0 20 Q 20 5, 40 20 T 80 20 T 120 20 T 160 20 T 200 20"
          fill="none"
          stroke="var(--color-cyan-primary)"
          strokeWidth="1.5"
          animate={isActive && !shouldReduceMotion ? {
            strokeDasharray: ["4 4", "10 5", "4 4"],
            strokeDashoffset: [0, -40],
            d: [
              "M 0 20 Q 20 5, 40 20 T 80 20 T 120 20 T 160 20 T 200 20",
              "M 0 20 Q 20 35, 40 20 T 80 20 T 120 20 T 160 20 T 200 20",
              "M 0 20 Q 20 5, 40 20 T 80 20 T 120 20 T 160 20 T 200 20"
            ]
          } : {}}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M 0 20 Q 15 35, 30 20 T 60 20 T 90 20 T 120 20 T 150 20 T 180 20 T 200 20"
          fill="none"
          stroke="rgb(var(--rgb-accent) / 0.25)"
          strokeWidth="1"
          animate={isActive && !shouldReduceMotion ? {
            strokeDashoffset: [0, 40],
            d: [
              "M 0 20 Q 15 35, 30 20 T 60 20 T 90 20 T 120 20 T 150 20 T 180 20 T 200 20",
              "M 0 20 Q 15 5, 30 20 T 60 20 T 90 20 T 120 20 T 150 20 T 180 20 T 200 20",
              "M 0 20 Q 15 35, 30 20 T 60 20 T 90 20 T 120 20 T 150 20 T 180 20 T 200 20"
            ]
          } : {}}
          transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
        />
      </svg>
      <div className="absolute bottom-1 right-2 font-mono text-[12px] text-cyan-primary/50 flex items-center space-x-1">
        <span className={`w-1 h-1 rounded-full ${isActive ? "bg-cyan-primary animate-pulse" : "bg-text-dim/20"}`} />
        <span>{isActive ? "SAMPLED" : "STANDBY"}</span>
      </div>
    </div>
  );
}

export default function EncodingLab() {
  const [inputText, setInputText] = useState<string>("");
  const [isDecodeMode, setIsDecodeMode] = useState<boolean>(true);
  const [isPipelineDecode, setIsPipelineDecode] = useState<boolean>(true);

  const pendingToolId = useAppStore((s) => s.pendingToolId);
  const consumePendingTool = useAppStore((s) => s.consumePendingTool);

  /**
   * Pick up an encoding handed over from the Tool Database.
   *
   * The Deck shows every encoding at once rather than one selection, so
   * "opening" a tool here means bringing its row into view and marking it —
   * otherwise arriving from the catalogue would look identical to arriving
   * from the sidebar.
   */
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingToolId) return;
    const requested = consumePendingTool();
    if (!requested) return;
    setHighlightedRow(requested);

    // The row is rendered by this same commit, so wait a frame before scrolling.
    const raf = requestAnimationFrame(() => {
      document
        .getElementById(`breakout-container-${requested}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // The mark is a "you arrived here" cue, not persistent state.
    const timer = window.setTimeout(() => setHighlightedRow(null), 2600);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [pendingToolId, consumePendingTool]);
  
  // Custom states for copy status
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  // BigInt states
  const [bigIntInput, setBigIntInput] = useState<string>("");
  const [bigIntMode, setBigIntMode] = useState<"toBigInt" | "toText">("toBigInt");
  const [bigIntCopied, setBigIntCopied] = useState<boolean>(false);

  const bigIntOutput = useMemo(() => {
    if (!bigIntInput.trim()) return "";
    try {
      if (bigIntMode === "toBigInt") {
        return textToBigInteger(bigIntInput);
      } else {
        return bigIntegerToText(bigIntInput);
      }
    } catch (err: any) {
      return `ERROR: ${err.message}`;
    }
  }, [bigIntInput, bigIntMode]);

  // Crash-proof simultaneous translations.
  // Some registry decoders throw on invalid input (e.g. base62 on a space), and
  // the big-integer radix encoders (base58/62/85) are O(n^2). Both are guarded
  // here so a long or messy paste can never freeze or unmount the app.
  const HEAVY_RADIX = useMemo(() => new Set(["base58", "base62", "base85"]), []);
  const HEAVY_MAX = 8192;

  const encodedValues = useMemo(() => {
    const ids = [
      "base32", "base64", "hex", "binary", "ascii", "morse", "url", "base58",
      "base85", "braille", "base62", "base100", "baudot", "tapcode",
      "phonekeypad", "piglatin", "geekcode"
    ];
    const out: Record<string, string> = {};
    for (const id of ids) {
      const tool = getTool(id);
      if (!tool || !inputText) {
        out[id] = "";
        continue;
      }
      if (HEAVY_RADIX.has(id) && inputText.length > HEAVY_MAX) {
        out[id] = `— INPUT TOO LARGE FOR RADIX ENCODER (${inputText.length} B) —`;
        continue;
      }
      try {
        out[id] = asText(isDecodeMode ? tool.decode(inputText) : tool.encode(inputText));
      } catch (e: any) {
        out[id] = "ERROR: " + (e?.message || String(e));
      }
    }
    return out;
  }, [inputText, isDecodeMode, HEAVY_RADIX]);

  // Preserve the original variable names consumed by the breakout rows.
  const base64Val = encodedValues.base64;
  const hexVal = encodedValues.hex;
  const binaryVal = encodedValues.binary;
  const asciiVal = encodedValues.ascii;
  const morseVal = encodedValues.morse;
  const urlVal = encodedValues.url;
  const base32Val = encodedValues.base32;
  const base58Val = encodedValues.base58;
  const base85Val = encodedValues.base85;
  const brailleVal = encodedValues.braille;
  const extraEncodingVals = encodedValues;

  // Handle Clipboard Copy for rows
  const copyRow = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedRow(key);
    setTimeout(() => setCopiedRow(null), 2000);
  };

  // Convert and Load as primary input
  const handleLoadAsInput = (type: string, value: string) => {
    if (isDecodeMode) {
      // In decode mode, the value is already decoded plaintext, so we load it directly
      setInputText(value);
    } else {
      const tool = getTool(type);
      let decoded = "";
      try {
        decoded = tool ? asText(tool.decode(value)) : "";
      } catch {
        decoded = "";
      }
      if (decoded && !decoded.startsWith("ERROR")) {
        setInputText(decoded);
      } else {
        playFailBuzz();
      }
    }
  };

  // Multi-layer Encoder pipeline
  const [pipelineLayers, setPipelineLayers] = useState<string[]>([
    "Base64",
    "Hex"
  ]);

  const pipelineOutput = useMemo(() => {
    let current = inputText;
    try {
      for (const layer of pipelineLayers) {
        const toolId = pipelineLayerIds[layer];
        const tool = toolId ? getTool(toolId) : undefined;
        if (tool) {
          if (current.length > 8192 && ["base58", "base62", "base85"].includes(toolId)) {
            return `— INPUT TOO LARGE FOR RADIX STAGE (${current.length} B) —`;
          }
          current = asText(isPipelineDecode ? tool.decode(current) : tool.encode(current));
        }
      }
    } catch (e: any) {
      return "ERROR: " + (e?.message || String(e));
    }
    return current;
  }, [inputText, pipelineLayers, isPipelineDecode]);

  // Live dynamic bit visualization matrix (first 8 bytes, represented as an 8x8 grid of LEDs)
  const bitGrid = useMemo(() => {
    const bytes = inputText.split("").slice(0, 8);
    const grid: { char: string; charCode: number; hexCode: string; decCode: string; index: number; bits: number[] }[] = [];
    
    // Ensure we always have exactly 8 rows for consistent rendering
    for (let i = 0; i < 8; i++) {
      const char = bytes[i] || "";
      const charCode = char ? char.charCodeAt(0) : 0;
      const bitsStr = charCode.toString(2).padStart(8, "0");
      const bits = bitsStr.split("").map(b => parseInt(b));
      const hexCode = char ? charCode.toString(16).toUpperCase().padStart(2, "0") : "--";
      const decCode = char ? charCode.toString().padStart(3, "0") : "---";
      grid.push({
        char: char || "(null)",
        charCode,
        hexCode,
        decCode,
        index: i,
        bits
      });
    }
    return grid;
  }, [inputText]);

  return (
    <div className="h-full w-full p-4 grid grid-cols-12 gap-4 overflow-y-auto font-chakra select-none">
      
      {/* ================= LEFT COLUMN: CENTRAL SIGNAL SOURCE (INPUT & SYSTEM MONITOR) ================= */}
      <div className="col-span-12 xl:col-span-5 flex flex-col space-y-4">
        
        {/* Input buffer block */}
        <GlassPanel className="p-4 flex flex-col min-h-[190px]" clipSize="md" showCornerTicks={true}>
          <div className="border-b border-border-hairline/25 pb-2 mb-3 flex justify-between items-center">
            <div>
              <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                ENCODING BUFFER INPUT
              </h3>
              <p className="text-[12px] font-share text-text-dim uppercase tracking-wider mt-0.5">
                Paste plaintext or unformatted byte sequences
              </p>
            </div>
            <span className="font-mono text-[12px] text-cyan-dim bg-cyan-primary/5 px-2 py-0.5 border border-cyan-primary/10">
              {inputText.length} BYTES
            </span>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              playTypeKey();
            }}
            placeholder="ENTER RAW CHARACTERS OR TELEMETRY LOGS TO CONVERT..."
            className="w-full flex-1 bg-bg-void/40 border border-border-hairline/15 rounded-none p-3 font-mono text-[13px] leading-relaxed text-text-primary outline-none focus:border-cyan-primary/50 resize-none scrollbar-thin overflow-y-auto min-h-[80px]"
          />

          <div className="mt-2 flex justify-between text-[12px] font-share text-text-dim">
            <button
              onClick={() => {
                setInputText("");
                playPinClick();
              }}
              onMouseEnter={() => playHoverEvidence()}
              className="hover:text-red-threat border border-border-hairline/15 px-2.5 py-1 bg-bg-void/40 transition-colors uppercase cursor-pointer"
            >
              CLEAR
            </button>
            <span className="text-[12px] uppercase text-cyan-primary/50 self-center">
              CENTRAL BUS: CH_01
            </span>
          </div>
        </GlassPanel>

        {/* PROMOTED & EXPANDED: 8x8 LED System Bus Monitor & Logic Analyzer */}
        <GlassPanel className="p-4 flex-1 flex flex-col" clipSize="md" showCornerTicks={true}>
          <div className="border-b border-border-hairline/25 pb-1 mb-3.5 flex justify-between items-end">
            <div>
              <h3 className="font-orbitron text-[13px] font-black tracking-widest text-cyan-text flex items-center uppercase">
                <span className="w-1.5 h-3 bg-cyan-primary mr-1.5 transform -skew-x-12 inline-block shadow-[0_0_4px_var(--color-accent-primary)]" />
                LOGIC ANALYZER // BYTE-BIT MONITOR
              </h3>
              <span className="text-[12px] font-share text-text-dim block uppercase mt-0.5">
                Live 8-bit bus mapping of the primary input buffer index range
              </span>
            </div>
            <span className="font-mono text-[12px] text-green-verified bg-green-verified/5 px-1.5 py-0.5 border border-green-verified/15 animate-pulse">
              BUS MASTER
            </span>
          </div>

          {/* Fully featured hardware register monitor display */}
          <div className="flex-1 bg-bg-void/60 border border-border-hairline/10 p-3.5 flex flex-col justify-between space-y-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
            
            <div className="w-full space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-1 text-[12px] font-mono text-text-dim border-b border-border-hairline/10 pb-1 font-bold uppercase tracking-wider">
                <div className="col-span-2">CHANNEL</div>
                <div className="col-span-1 text-center">CHR</div>
                <div className="col-span-6 text-center">8-BIT LOGIC REGISTER</div>
                <div className="col-span-1.5 text-right">HEX</div>
                <div className="col-span-1.5 text-right">DEC</div>
              </div>

              {/* Data rows */}
              <div className="space-y-1.5">
                {bitGrid.map((row) => (
                  <div
                    key={row.index}
                    className="grid grid-cols-12 gap-1 items-center hover:bg-cyan-primary/5 px-0.5 py-1 transition-colors duration-150 border-b border-border-hairline/5"
                  >
                    {/* Channel */}
                    <div className="col-span-2 font-mono text-[12px] text-cyan-dim/80 flex items-center space-x-1">
                      <span className={`w-1 h-1 rounded-full ${row.charCode ? "bg-cyan-primary shadow-[0_0_4px_var(--color-accent-primary)]" : "bg-text-dim/10"}`} />
                      <span>BUS.0{row.index + 1}</span>
                    </div>

                    {/* Character tag */}
                    <div className="col-span-1 text-center">
                      <span className={`font-mono text-[12px] font-black px-1 py-0.2 ${row.charCode ? "text-cyan-text bg-cyan-primary/10" : "text-text-dim/30 bg-bg-void"}`}>
                        {row.charCode === 32 ? "SPC" : row.charCode === 0 ? "Ø" : row.char}
                      </span>
                    </div>

                    {/* LED Logic Bits */}
                    <div className="col-span-6 flex justify-center space-x-1 md:space-x-1.5">
                      {row.bits.map((bit, bitIdx) => {
                        const isOne = bit === 1;
                        return (
                          <div
                            key={bitIdx}
                            className={`w-3.5 h-3.5 border transition-all duration-300 relative group flex items-center justify-center ${
                              isOne
                                ? "bg-cyan-primary border-cyan-primary shadow-[0_0_8px_rgb(var(--rgb-accent) / 0.9)] scale-105"
                                : "bg-bg-void border-border-hairline/15 hover:border-cyan-primary/40"
                            }`}
                            style={{ clipPath: "polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)" }}
                            title={`Byte ${row.index + 1}, Bit ${8 - bitIdx}: ${bit}`}
                          >
                            {/* Hover bit detail tooltip overlay */}
                            <span className="hidden group-hover:block absolute bottom-5 left-1/2 -translate-x-1/2 bg-bg-void border border-cyan-primary px-1.5 py-0.5 text-[12px] text-cyan-primary font-mono whitespace-nowrap z-50 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                              REG{8 - bitIdx} = {bit}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Hex indicator */}
                    <div className="col-span-1.5 text-right font-mono text-[12px] text-cyan-dim font-bold">
                      {row.hexCode !== "--" ? `0x${row.hexCode}` : "--"}
                    </div>

                    {/* Dec indicator */}
                    <div className="col-span-1.5 text-right font-mono text-[12px] text-text-dim">
                      {row.decCode}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated Live wave oscilloscope */}
            <LogicOscilloscope isActive={inputText.length > 0} />
          </div>

          <div className="flex justify-between text-[12px] font-mono text-text-dim border-t border-border-hairline/15 pt-1.5 mt-2">
            <span>BYTES: 01 to 08 REGISTER CHANNELS</span>
            <span className="text-cyan-primary font-bold animate-hex-pulse-flicker">LIVE BUS SPECTROGRAM</span>
          </div>
        </GlassPanel>

      </div>

      {/* ================= CENTER COLUMN: THE SIMULTANEOUS FORMAT BREAKOUT BOARD ================= */}
      <div className="col-span-12 xl:col-span-4 flex flex-col space-y-4">
        
        <GlassPanel className="p-4 flex-1 flex flex-col" clipSize="md" showCornerTicks={true}>
          <div className="border-b border-border-hairline/25 pb-2 mb-3.5 flex justify-between items-center">
            <div>
              <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                BREAKOUT ROUTING CHANNELS
              </h3>
              <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
                {isDecodeMode ? "Decoding single multiplexed stream to parallel plaintext formats" : "Demultiplexing core input into simultaneous hardware translation lines"}
              </p>
            </div>

            {/* Mode switch segmented control */}
            <div className="flex bg-bg-void/80 border border-border-hairline/15 p-0.5 font-mono text-[12px] shrink-0">
              <button
                onClick={() => {
                  setIsDecodeMode(false);
                  playPinClick();
                }}
                className={`px-2 py-0.5 transition-colors uppercase cursor-pointer ${!isDecodeMode ? "bg-cyan-primary text-bg-void font-bold shadow-[0_0_6px_rgb(var(--rgb-accent) / 0.4)]" : "text-text-dim hover:text-cyan-primary"}`}
              >
                ENCODE
              </button>
              <button
                onClick={() => {
                  setIsDecodeMode(true);
                  playPinClick();
                }}
                className={`px-2 py-0.5 transition-colors uppercase cursor-pointer ${isDecodeMode ? "bg-cyan-primary text-bg-void font-bold shadow-[0_0_6px_rgb(var(--rgb-accent) / 0.4)]" : "text-text-dim hover:text-cyan-primary"}`}
              >
                DECODE
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {(() => {
              const rowsData = [
                {
                  key: "hex",
                  label: isDecodeMode ? "HEXADECIMAL DECODER (BASE-16)" : "HEXADECIMAL BREAKOUT (BASE-16)",
                  value: hexVal,
                  badge: "HEX",
                  description: isDecodeMode ? "Parse hex byte stream to text" : "8-bit hexadecimal byte stream"
                },
                {
                  key: "base64",
                  label: isDecodeMode ? "BASE64 CHARACTER DECODER (RFC 4648)" : "BASE64 CHARACTER BRANCH (RFC 4648)",
                  value: base64Val,
                  badge: "B64",
                  description: isDecodeMode ? "Decode rad-64 index stream to text" : "Standard rad-64 index representation"
                },
                {
                  key: "binary",
                  label: isDecodeMode ? "RAW BINARY BYTE STREAM DECODER" : "RAW BINARY BYTE STREAM (8-BIT OCTETS)",
                  value: binaryVal,
                  badge: "BIN",
                  description: isDecodeMode ? "Convert digital bits to text characters" : "Digital bit-gate parallel state"
                },
                {
                  key: "ascii",
                  label: isDecodeMode ? "ASCII DECIMAL INDEX DECODER" : "ASCII DECIMAL INDEX INTEGERS",
                  value: asciiVal,
                  badge: "DEC",
                  description: isDecodeMode ? "Map decimal integers back to text" : "Integers mapped to text encoding"
                },
                {
                  key: "morse",
                  label: isDecodeMode ? "MORSE TELEGRAPHIC DECODER" : "MORSE TELEGRAPHIC TELEMETRY",
                  value: morseVal,
                  badge: "MORSE",
                  description: isDecodeMode ? "Decode dit-dah telegraphy to letters" : "Pulsing audio dit-dah telegraphy"
                },
                {
                  key: "url",
                  label: isDecodeMode ? "URL ESCAPE PERCENT DECODER" : "URL ESCAPE PERCENT ENCODING",
                  value: urlVal,
                  badge: "URL",
                  description: isDecodeMode ? "Decode hex-escaped percent character text" : "Hex-safe character encodings"
                },
                {
                  key: "base62",
                  label: isDecodeMode ? "BASE62 ALPHANUMERIC DECODER" : "BASE62 ALPHANUMERIC ENCODER",
                  value: extraEncodingVals.base62,
                  badge: "B62",
                  description: isDecodeMode ? "Decode radix-62 alphanumeric stream to text" : "Radix-62 alphanumeric representation"
                },
                {
                  key: "baudot",
                  label: isDecodeMode ? "BAUDOT ITA2 TELEPRINTER DECODER" : "BAUDOT ITA2 TELEPRINTER CODE",
                  value: extraEncodingVals.baudot,
                  badge: "BAUDOT",
                  description: isDecodeMode ? "Decode 5-bit teleprinter code to text" : "5-bit ITA2 teleprinter representation"
                },
                {
                  key: "tapcode",
                  label: isDecodeMode ? "TAP CODE KNOCK DECODER" : "TAP CODE POLYBIUS KNOCKS",
                  value: extraEncodingVals.tapcode,
                  badge: "TAP",
                  description: isDecodeMode ? "Decode Polybius knock grid to text" : "Polybius-square knock representation"
                },
                {
                  key: "phonekeypad",
                  label: isDecodeMode ? "MULTI-TAP KEYPAD DECODER" : "MULTI-TAP PHONE KEYPAD",
                  value: extraEncodingVals.phonekeypad,
                  badge: "KEYPAD",
                  description: isDecodeMode ? "Decode T9-style keypad presses to text" : "Multi-tap numeric keypad representation"
                },
                {
                  key: "piglatin",
                  label: isDecodeMode ? "PIG LATIN WORDPLAY DECODER" : "PIG LATIN WORDPLAY ENCODER",
                  value: extraEncodingVals.piglatin,
                  badge: "PIGLTN",
                  description: isDecodeMode ? "Reverse Pig Latin wordplay to text" : "Pig Latin syllable-shift wordplay"
                },
                {
                  key: "base100",
                  label: isDecodeMode ? "BASE100 EMOJI DECODER" : "BASE100 EMOJI ENCODER",
                  value: extraEncodingVals.base100,
                  badge: "B100",
                  description: isDecodeMode ? "Decode emoji byte stream to text" : "Emoji byte-per-character representation"
                },
                {
                  key: "geekcode",
                  label: isDecodeMode ? "GEEK CODE BLOCK DECODER" : "GEEK CODE BLOCK ENCODER",
                  value: extraEncodingVals.geekcode,
                  badge: "GEEK",
                  description: isDecodeMode ? "Decode geek-code block to text" : "Classic geek-code block representation"
                },
                {
                  key: "base58",
                  label: isDecodeMode ? "BASE58 BITCOIN DECODER" : "BASE58 BITCOIN ENCODER",
                  value: base58Val,
                  badge: "B58",
                  description: isDecodeMode ? "Decode Bitcoin-base58 stream back to text" : "Base-58 key representation"
                },
                {
                  key: "base85",
                  label: isDecodeMode ? "BASE85/ASCII85 DECODER" : "BASE85/ASCII85 ENCODER",
                  value: base85Val,
                  badge: "B85",
                  description: isDecodeMode ? "Decode Adobe Ascii85 stream back to text" : "Adobe Ascii85 stream representation"
                },
                {
                  key: "braille",
                  label: isDecodeMode ? "BRAILLE DECODER" : "BRAILLE ENCODER",
                  value: brailleVal,
                  badge: "BRL",
                  description: isDecodeMode ? "Map Unicode Braille back to text" : "Translate letters to U+2800 Braille"
                }
              ];

              return rowsData.map((row, idx) => (
                <div key={row.key} className="flex items-stretch group" id={`breakout-container-${row.key}`}>
                  {/* Visually connecting signal breakout line */}
                  <BreakoutLine index={idx} total={rowsData.length} isActive={!!row.value} />

                  {/* Translator Node Port */}
                  <div
                    className={`hud-target flex-1 bg-bg-void/50 border p-2.5 space-y-1.5 relative hover:border-cyan-dim/30 hover:bg-bg-void/65 transition-all duration-300 ${
                      highlightedRow === row.key
                        ? "border-accent-primary/70 bg-accent-primary/[0.06] shadow-[0_0_16px_rgb(var(--rgb-accent) / 0.2)]"
                        : "border-border-hairline/15"
                    }`}
                    style={{ clipPath: "polygon(0 0, 100% 0, 99% 100%, 0 100%)", ["--reticle-size" as any]: "7px" }}
                  >
                    {/* Header label */}
                    <div className="flex justify-between items-center text-[13px]">
                      <div className="flex flex-col">
                        <span className="font-chakra font-extrabold text-cyan-dim uppercase tracking-wider flex items-center">
                          <span className={`w-1 h-2.5 mr-1.5 inline-block ${row.value ? "bg-cyan-primary shadow-[0_0_4px_var(--color-accent-primary)]" : "bg-cyan-dim/20"}`} />
                          {row.label}
                        </span>
                        <span className="text-[12px] text-text-dim/60 font-share uppercase tracking-wide mt-0.2">
                          {row.description}
                        </span>
                      </div>
                      <Badge variant={copiedRow === row.key ? "green" : "dim"} size="xs">
                        {row.badge}
                      </Badge>
                    </div>

                    {/* Read-only stream row */}
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-bg-void/80 border border-border-hairline/10 p-2 font-mono text-[13px] text-text-primary h-8 flex items-center overflow-x-auto overflow-y-hidden scrollbar-none whitespace-nowrap leading-none select-all select-text">
                          {row.value ? (
                            <ShinyText text={row.value} speed={3} className="tracking-wide" />
                          ) : (
                            <span className="text-text-dim/20 italic">-- PORT STANDBY --</span>
                          )}
                        </div>

                        {/* Actions column */}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              copyRow(row.key, row.value);
                              playSuccessChime();
                            }}
                            onMouseEnter={() => playHoverEvidence()}
                            disabled={!row.value}
                            className="p-1.5 bg-bg-void border border-border-hairline/15 text-text-dim hover:text-cyan-primary hover:border-cyan-primary/50 transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            title="Copy Port Output"
                          >
                            {copiedRow === row.key ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-verified" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {row.key !== "url" && (
                            <button
                              onClick={() => {
                                handleLoadAsInput(row.key, row.value);
                                playPinClick();
                              }}
                              onMouseEnter={() => playHoverEvidence()}
                              disabled={!row.value}
                              className="p-1.5 bg-bg-void border border-border-hairline/15 text-text-dim hover:text-amber-alert hover:border-amber-alert/50 transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                              title="Feed Back As Central Input"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <FactoryThroughputBar active={!!row.value} direction={row.key === "hex" || row.key === "binary" ? "left" : "right"} />
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </GlassPanel>

      </div>

      {/* ================= RIGHT COLUMN: CASCADE PIPELINE & REFERENCE (SECONDARY RAIL) ================= */}
      <div className="col-span-12 xl:col-span-3 flex flex-col space-y-4">
        
        {/* Cascade sequential encoding pipeline (Subtle styled secondary card) */}
        <GlassPanel className="p-4 flex-1 flex flex-col justify-between bg-bg-void/10 border-border-hairline/10 hover:border-cyan-primary/10 transition-colors duration-300" clipSize="sm" showCornerTicks={false}>
          <div>
            <div className="border-b border-border-hairline/10 pb-2 mb-3 flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-1.5 text-text-dim/60">
                  <Layers className="w-3 h-3 text-cyan-primary/45" />
                  <span className="font-mono text-[12px] tracking-widest uppercase">AUXILIARY PROCESSOR</span>
                </div>
                <h3 className="font-orbitron text-[13px] font-black tracking-widest text-text-primary flex items-center mt-1">
                  CASCADE PIPELINE CODER
                </h3>
                <p className="text-[12px] font-share text-text-dim/80 tracking-wide uppercase mt-0.5">
                  Chained step-by-step stream processor
                </p>
              </div>

              {/* Pipeline Encode/Decode Toggle */}
              <div className="flex bg-bg-void/80 border border-border-hairline/15 p-0.5 font-mono text-[12px] shrink-0">
                <button
                  onClick={() => {
                    setIsPipelineDecode(false);
                    playPinClick();
                  }}
                  className={`px-1.5 py-0.5 transition-colors uppercase cursor-pointer ${!isPipelineDecode ? "bg-cyan-primary text-bg-void font-bold shadow-[0_0_4px_rgb(var(--rgb-accent) / 0.4)]" : "text-text-dim hover:text-cyan-primary"}`}
                >
                  ENC
                </button>
                <button
                  onClick={() => {
                    setIsPipelineDecode(true);
                    playPinClick();
                  }}
                  className={`px-1.5 py-0.5 transition-colors uppercase cursor-pointer ${isPipelineDecode ? "bg-cyan-primary text-bg-void font-bold shadow-[0_0_4px_rgb(var(--rgb-accent) / 0.4)]" : "text-text-dim hover:text-cyan-primary"}`}
                >
                  DEC
                </button>
              </div>
            </div>

            <div className="space-y-3 font-share text-[12px]">
              {/* Active layers steps */}
              <div className="space-y-1.5">
                <span className="text-text-dim/70 uppercase text-[12px] block">
                  {isPipelineDecode ? "ACTIVE DECODE SEQUENCE:" : "ACTIVE ENCODE SEQUENCE:"}
                </span>
                <div className="bg-bg-void/45 border border-border-hairline/10 p-2 flex items-center flex-wrap gap-1.5">
                  {pipelineLayers.map((layer, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <ArrowRight className="w-2.5 h-2.5 text-cyan-primary/30" />}
                      <div className="bg-bg-void border border-cyan-primary/20 text-cyan-dim px-1.5 py-0.5 font-mono text-[12px]">
                        {layer.toUpperCase()}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Chain stage selectors — user-configured, no canned presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-text-dim/70 uppercase text-[12px] block">CONFIGURE CHAIN STAGES:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[0, 1].map((stageIdx) => (
                    <label key={stageIdx} className="flex flex-col gap-0.5">
                      <span className="text-text-dim/50 text-[11px] uppercase tracking-widest">STAGE {stageIdx + 1}</span>
                      <select
                        value={pipelineLayers[stageIdx] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = [...pipelineLayers];
                          if (val) next[stageIdx] = val;
                          else next.splice(stageIdx, 1);
                          setPipelineLayers(next.filter(Boolean));
                          playPinClick();
                        }}
                        className="p-1 bg-bg-void/60 border border-border-hairline/15 text-cyan-text font-mono text-[12px] uppercase outline-none focus:border-cyan-primary/50 cursor-pointer"
                      >
                        <option value="">— NONE —</option>
                        {Object.keys(pipelineLayerIds).map((label) => (
                          <option key={label} value={label}>{label.toUpperCase()}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pipeline Output */}
              <div className="space-y-1 pt-1.5">
                <div className="flex justify-between items-center text-[12px] text-text-dim/70">
                  <span>{isPipelineDecode ? "CASCADE DECODING OUTPUT:" : "CASCADE ENCODING OUTPUT:"}</span>
                  <span className="text-cyan-dim/80 font-mono">{pipelineOutput.length} CHARS</span>
                </div>
                <div className="bg-bg-void/80 border border-border-hairline/15 p-2 font-mono text-[12px] text-cyan-text break-all max-h-[75px] overflow-y-auto scrollbar-thin select-all leading-normal">
                  {pipelineOutput ? (
                    <ShinyText text={pipelineOutput} speed={2} className="tracking-widest" />
                  ) : (
                    <span className="text-text-dim/25 italic">-- Awaiting pipeline feed --</span>
                  )}
                </div>
                <FactoryThroughputBar active={!!pipelineOutput} direction="right" />
              </div>
            </div>
          </div>

          <div className="flex justify-between text-[12px] font-mono text-text-dim/50 border-t border-border-hairline/10 pt-1.5 mt-2">
            <span>SEQUENCE PIPELINE ENGINE</span>
            <span className="text-cyan-dim/40 font-bold">STABLE</span>
          </div>
        </GlassPanel>

        {/* Arbitrary Precision Big Integer Coder */}
        <GlassPanel className="p-4 flex flex-col justify-between bg-bg-void/20 border-border-hairline/10 hover:border-cyan-primary/10 transition-colors duration-300" clipSize="sm" showCornerTicks={false}>
          <div>
            <div className="border-b border-border-hairline/10 pb-2 mb-3 flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-1.5 text-text-dim/60">
                  <Cpu className="w-3 h-3 text-cyan-primary/45" />
                  <span className="font-mono text-[12px] tracking-widest uppercase">PRECISION NUMERICS</span>
                </div>
                <h3 className="font-orbitron text-[13px] font-black tracking-widest text-text-primary flex items-center mt-1">
                  BIGINT CODER
                </h3>
                <p className="text-[12px] font-share text-text-dim/80 tracking-wide uppercase mt-0.5">
                  Arbitrary-precision integer mapping
                </p>
              </div>

              {/* BigInt Mode Switcher */}
              <div className="flex bg-bg-void/80 border border-border-hairline/15 p-0.5 font-mono text-[12px] shrink-0">
                <button
                  onClick={() => {
                    setBigIntMode("toBigInt");
                    setBigIntInput("");
                    playPinClick();
                  }}
                  className={`px-1.5 py-0.5 transition-colors uppercase cursor-pointer ${bigIntMode === "toBigInt" ? "bg-cyan-primary text-bg-void font-bold shadow-[0_0_4px_rgb(var(--rgb-accent) / 0.4)]" : "text-text-dim hover:text-cyan-primary"}`}
                >
                  TEXT → INT
                </button>
                <button
                  onClick={() => {
                    setBigIntMode("toText");
                    setBigIntInput("");
                    playPinClick();
                  }}
                  className={`px-1.5 py-0.5 transition-colors uppercase cursor-pointer ${bigIntMode === "toText" ? "bg-cyan-primary text-bg-void font-bold shadow-[0_0_4px_rgb(var(--rgb-accent) / 0.4)]" : "text-text-dim hover:text-cyan-primary"}`}
                >
                  INT → TEXT
                </button>
              </div>
            </div>

            <div className="space-y-3 font-share text-[12px]">
              <div className="space-y-1">
                <span className="text-text-dim/70 uppercase text-[12px] block">
                  {bigIntMode === "toBigInt" ? "INPUT PLAIN TEXT:" : "INPUT BIGINT DECIMAL VALUE:"}
                </span>
                <textarea
                  value={bigIntInput}
                  onChange={(e) => {
                    setBigIntInput(e.target.value);
                    playTypeKey();
                  }}
                  placeholder={bigIntMode === "toBigInt" ? "ENTER PLAINTEXT TO REPRESENT..." : "ENTER DECIMAL DIGITS OR LARGE INTEGER..."}
                  className="w-full bg-bg-void/60 border border-border-hairline/10 p-2 font-mono text-[12px] text-text-primary h-12 resize-none outline-none focus:border-cyan-primary/30"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-[12px] text-text-dim/70">
                  <span>TRANSFORMED REPRESENTATION:</span>
                  <span className="text-cyan-dim/80 font-mono">{bigIntOutput.length} CHARS</span>
                </div>
                <div className="bg-bg-void/80 border border-border-hairline/15 p-2 font-mono text-[12px] text-cyan-text break-all h-14 overflow-y-auto scrollbar-thin select-all leading-normal">
                  {bigIntOutput ? (
                    <ShinyText text={bigIntOutput} speed={2} className="tracking-widest" />
                  ) : (
                    <span className="text-text-dim/25 italic">-- Awaiting precision input --</span>
                  )}
                </div>
              </div>

              <div className="flex space-x-1.5 pt-1">
                <button
                  disabled={!bigIntOutput || bigIntOutput.startsWith("ERROR")}
                  onClick={() => {
                    navigator.clipboard.writeText(bigIntOutput);
                    setBigIntCopied(true);
                    playSuccessChime();
                    setTimeout(() => setBigIntCopied(false), 2000);
                  }}
                  className="flex-1 p-1 border border-border-hairline/10 bg-bg-void/25 text-center text-text-dim hover:text-cyan-primary hover:border-cyan-primary/30 hover:bg-cyan-primary/5 uppercase text-[12px] leading-tight transition-all cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  {bigIntCopied ? <CheckCircle className="w-3 h-3 text-green-verified" /> : <Copy className="w-3 h-3" />}
                  <span>{bigIntCopied ? "COPIED" : "COPY OUTPUT"}</span>
                </button>
                <button
                  disabled={!bigIntOutput || bigIntOutput.startsWith("ERROR")}
                  onClick={() => {
                    if (bigIntMode === "toBigInt") {
                      // Already BigInt (encoded), we can load it as input
                      setInputText(bigIntOutput);
                    } else {
                      // Resulting plaintext, we can load it as input
                      setInputText(bigIntOutput);
                    }
                    playPinClick();
                  }}
                  className="p-1 border border-border-hairline/10 bg-bg-void/25 text-center text-text-dim hover:text-amber-alert hover:border-amber-alert/30 hover:bg-amber-alert/5 uppercase text-[12px] leading-tight transition-all cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-35 disabled:cursor-not-allowed"
                  title="Load into Primary Encoding Buffer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>LOAD BUS</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between text-[12px] font-mono text-text-dim/50 border-t border-border-hairline/10 pt-1.5 mt-2">
            <span>INTEGER MAPPING SUBSYSTEM</span>
            <span className="text-cyan-dim/40 uppercase font-bold">STABLE</span>
          </div>
        </GlassPanel>

        {/* Custom Charset Reference Table (Subtle styled secondary card) */}
        <GlassPanel className="p-4 h-48 flex flex-col justify-between bg-bg-void/10 border-border-hairline/10" clipSize="sm" showCornerTicks={false}>
          <div>
            <div className="border-b border-border-hairline/10 pb-1 mb-2 flex justify-between items-center">
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5 text-text-dim/60">
                  <Search className="w-3 h-3 text-cyan-primary/30" />
                  <span className="font-mono text-[12px] tracking-widest uppercase">DICTIONARY LOOKUP</span>
                </div>
                <h3 className="font-orbitron text-[12px] font-black tracking-widest text-text-primary mt-0.5">
                  ENCODING REFERENCER
                </h3>
              </div>
              <span className="text-[12px] font-mono text-text-dim bg-bg-void/50 px-1 border border-border-hairline/10 uppercase">
                ASCII INDEX
              </span>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 max-h-[90px]">
              <table className="w-full text-left font-mono text-[12px] text-text-dim/80">
                <thead>
                  <tr className="border-b border-border-hairline/10 pb-1 text-cyan-dim/80 font-bold uppercase text-[12px]">
                    <th className="py-0.5">CHAR</th>
                    <th className="py-0.5">DEC</th>
                    <th className="py-0.5">HEX</th>
                    <th className="py-0.5">BINARY</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { c: "A", d: "65", h: "41", b: "01000001" },
                    { c: "B", d: "66", h: "42", b: "01000010" },
                    { c: "C", d: "67", h: "43", b: "01000011" },
                    { c: "D", d: "68", h: "44", b: "01010100" },
                    { c: "E", d: "69", h: "45", b: "01000101" },
                    { c: "X", d: "88", h: "58", b: "01011000" },
                    { c: "Y", d: "89", h: "59", b: "01011001" },
                    { c: "Z", d: "90", h: "6A", b: "01011010" },
                    { c: "0", d: "48", h: "30", b: "00110000" },
                    { c: "9", d: "57", h: "39", b: "00111001" }
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-cyan-primary/5 hover:text-text-primary border-b border-border-hairline/5">
                      <td className="py-0.5 text-cyan-primary font-bold">{row.c}</td>
                      <td className="py-0.5">{row.d}</td>
                      <td className="py-0.5">{row.h}</td>
                      <td className="py-0.5">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between text-[12px] font-mono text-text-dim/50 border-t border-border-hairline/10 pt-1.5">
            <span>ISO/IEC 8859-1 CODES</span>
            <span className="text-cyan-dim/40 uppercase font-bold">READY</span>
          </div>
        </GlassPanel>

      </div>

    </div>
  );
}

