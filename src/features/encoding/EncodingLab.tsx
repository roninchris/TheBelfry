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
import DataWall from "../../components/ui/DataWall";
import Badge from "../../components/ui/Badge";
import { useAppStore } from "../../store/appStore";
import ShinyText from "../../components/react-bits/ShinyText";
import FactoryThroughputBar from "../../components/ui/FactoryThroughputBar";
import { playSuccessChime, playFailBuzz, playTypeKey, playHoverEvidence, playPinClick, playHoverBlip } from "../../lib/soundEngine";
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



/** Character-class composition of the buffer, used by the source signature. */
function analyseSource(text: string) {
  const len = text.length;
  if (!len) return null;

  let hexish = 0, b64ish = 0, digits = 0, letters = 0, ws = 0, other = 0;
  const freq = new Map<string, number>();

  for (const ch of text) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
    if (/\s/.test(ch)) { ws++; continue; }
    if (/[0-9]/.test(ch)) digits++;
    else if (/[a-zA-Z]/.test(ch)) letters++;
    else other++;
    if (/[0-9a-fA-F]/.test(ch)) hexish++;
    if (/[A-Za-z0-9+/=]/.test(ch)) b64ish++;
  }

  // Shannon entropy over the observed symbol distribution.
  let entropy = 0;
  for (const n of freq.values()) {
    const pr = n / len;
    entropy -= pr * Math.log2(pr);
  }

  const body = len - ws || 1;
  const stripped = text.replace(/\s/g, "");

  // Format plausibility. These are the same shape checks a solver does by eye:
  // does the alphabet fit, and is the length consistent with the encoding.
  // Interior whitespace between word-like runs. Base64 and Base32 payloads are
  // not normally split this way, so this is what stops ordinary prose — whose
  // letters happen to fit the alphabet and whose length happens to divide by
  // four — from being reported as Base64.
  const looksSpaced = /\S\s+\S/.test(text.trim()) && /[a-z]{2,}\s+[a-z]{2,}/i.test(text);

  const hints: string[] = [];
  // Ordered most specific first: a run of 0s and 1s is also valid hex and valid
  // decimal, so binary has to lead or the useful answer is buried.
  if (stripped.length > 3 && /^[01]+$/.test(stripped) && stripped.length % 8 === 0) hints.push("BINARY");
  if (stripped.length > 1 && /^[0-9a-fA-F]+$/.test(stripped) && stripped.length % 2 === 0) hints.push("HEX");
  if (!looksSpaced && stripped.length > 3 && /^[A-Za-z0-9+/]+={0,2}$/.test(stripped) && stripped.length % 4 === 0) hints.push("BASE64");
  if (!looksSpaced && stripped.length > 3 && /^[A-Z2-7]+=*$/.test(stripped)) hints.push("BASE32");
  if (stripped.length > 1 && /^[0-9\s]+$/.test(text.trim())) hints.push("DECIMAL");
  if (/^[.\-\s/]+$/.test(text.trim())) hints.push("MORSE");

  return {
    len,
    unique: freq.size,
    entropy: +entropy.toFixed(2),
    hints,
    bars: [
      { key: "letters", label: "Alpha", pct: (letters / body) * 100 },
      { key: "digits", label: "Numeric", pct: (digits / body) * 100 },
      { key: "other", label: "Symbol", pct: (other / body) * 100 },
    ],
    hexPct: (hexish / body) * 100,
    b64Pct: (b64ish / body) * 100,
  };
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
  const [showAllPorts, setShowAllPorts] = useState(false);
  const sourceStats = useMemo(() => analyseSource(inputText), [inputText]);

  // Bumped whenever the buffer changes so the channels replay their resolve.
  // Without this the decode is instantaneous and nothing conveys that sixteen
  // formats were just driven off one stream.
  const [decodeGen, setDecodeGen] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDecodeGen((g) => g + 1), 90);
    return () => clearTimeout(t);
  }, [inputText, isDecodeMode]);

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
      <div className="col-span-12 xl:col-span-4 flex flex-col space-y-4 min-h-0">
        
        {/* Input buffer block */}
        <GlassPanel className="p-4 flex flex-col shrink-0 min-h-[190px]" clipSize="md" showCornerTicks={true}>
          <div className="border-b border-border-hairline/25 pb-2 mb-3 flex justify-between items-center">
            <div>
              <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
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
          </div>
        </GlassPanel>

        {/* SOURCE SIGNATURE — replaces the 8-bit bus monitor that used to sit
            here. That showed an LED register readout of the first eight bytes
            only: fixed, near-static, and useless for deciding what a payload
            is. This reads the whole buffer and answers the question a solver
            actually has on arrival — what does this look like, and which
            formats are even plausible — before they scan sixteen channels. */}
        <GlassPanel className="p-4 flex-1 flex flex-col min-h-0 relative overflow-hidden" clipSize="md" showCornerTicks={true}>
          <DataWall cell={18} intensity={0.07} />

          <div className="relative z-10 flex flex-col min-h-0 h-full">
            <div className="border-b border-border-hairline/25 pb-2 mb-3">
              <h3 className="font-display text-sm font-extrabold tracking-[0.18em] text-white flex items-center uppercase">
                <span className="w-1.5 h-3 bg-accent-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                Source signature
              </h3>
              <p className="text-[12px] font-share text-text-dim uppercase tracking-wider mt-0.5">
                Composition of the live buffer
              </p>
            </div>

            {!sourceStats ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-8">
                <span className="font-display text-sm font-extrabold tracking-[0.16em] text-white/60 uppercase">
                  Buffer empty
                </span>
                <span className="font-share text-[12px] tracking-wide text-text-dim/60 uppercase max-w-xs leading-relaxed">
                  Paste a payload and its shape will be read here
                </span>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto hud-scroll-hidden">
                {/* Headline figures */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Bytes", String(sourceStats.len)],
                    ["Symbols", String(sourceStats.unique)],
                    ["Entropy", sourceStats.entropy.toFixed(2)],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-bg-void/50 border border-border-hairline/15 p-2">
                      <div className="font-share text-[12px] tracking-widest text-text-dim/60 uppercase">
                        {label}
                      </div>
                      <div className="font-display text-xl font-extrabold text-white leading-none mt-1 tracking-tight">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Character-class composition */}
                <div className="space-y-1.5">
                  <div className="font-share text-[12px] tracking-widest text-text-dim/60 uppercase">
                    Composition
                  </div>
                  {sourceStats.bars.map((b) => (
                    <div key={b.key} className="flex items-center gap-2">
                      <span className="font-share text-[12px] uppercase tracking-wide text-cyan-text/70 w-16 shrink-0">
                        {b.label}
                      </span>
                      <span className="relative flex-1 h-[6px] bg-bg-void/70 border border-border-hairline/20 overflow-hidden">
                        <span
                          className="absolute inset-y-0 left-0 bg-accent-primary/70 transition-[width] duration-500 ease-out"
                          style={{ width: `${Math.min(100, b.pct)}%` }}
                        />
                      </span>
                      <span className="font-mono text-[12px] text-cyan-text/80 w-10 text-right tabular-nums shrink-0">
                        {Math.round(b.pct)}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Alphabet fit — how much of the payload each alphabet covers */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Hex alphabet", sourceStats.hexPct],
                    ["Base64 alphabet", sourceStats.b64Pct],
                  ].map(([label, pct]) => (
                    <div key={label as string} className="bg-bg-void/40 border border-border-hairline/15 p-2">
                      <div className="font-share text-[12px] tracking-widest text-text-dim/60 uppercase truncate">
                        {label}
                      </div>
                      <div
                        className={`font-mono text-sm mt-0.5 ${
                          (pct as number) === 100 ? "text-green-active" : "text-cyan-text/80"
                        }`}
                      >
                        {Math.round(pct as number)}% fit
                      </div>
                    </div>
                  ))}
                </div>

                {/* Plausible formats */}
                <div>
                  <div className="font-share text-[12px] tracking-widest text-text-dim/60 uppercase mb-1.5">
                    Shape matches
                  </div>
                  {sourceStats.hints.length === 0 ? (
                    <p className="font-share text-[12px] tracking-wide text-text-dim/50 uppercase">
                      No format matches this alphabet and length cleanly — likely
                      plaintext, a cipher, or a mixed payload.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {sourceStats.hints.map((h) => (
                        <span
                          key={h}
                          className="font-display text-[12px] font-extrabold tracking-[0.14em] uppercase px-2 py-1 border border-green-active/50 text-green-active bg-green-active/10"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </GlassPanel>

      </div>

      {/* ================= CENTER COLUMN: THE SIMULTANEOUS FORMAT BREAKOUT BOARD ================= */}
      <div className="col-span-12 xl:col-span-5 flex flex-col space-y-4 min-h-0">
        
        <GlassPanel className="p-4 flex-1 flex flex-col min-h-0" clipSize="md" showCornerTicks={true}>
          <div className="border-b border-border-hairline/25 pb-2 mb-3.5 flex justify-between items-center">
            <div>
              <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
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

          {/* Bounded with max-h, not just flex-1 + min-h-0. This panel sits in a
              grid row that sizes to its content, so no ancestor ever gives it a
              definite height and overflow-y-auto could never engage — "show all"
              grew the container to ~2600px and pushed the page down instead of
              scrolling inside it. */}
          <div className="flex-1 min-h-0 max-h-[72vh] space-y-3 overflow-y-auto overflow-x-hidden pr-1 hud-scroll-hidden">
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

              // Ports that produced output lead; the rest collapse into a
              // strip. Rendering all sixteen at full height meant decoding a
              // Base64 string gave one useful card and fifteen full-size
              // "PORT STANDBY" placeholders to scroll past.
              // A failed decoder returns an "ERROR: ..." string, which is
              // truthy — so filtering on presence alone promoted every failure
              // to a full-size card. Only genuine output counts as a hit.
              const isHit = (v: string) => !!v && !v.startsWith("ERROR");
              const activeRows = rowsData.filter((r) => isHit(r.value));
              const idleRows = rowsData.filter((r) => !isHit(r.value));
              const shown = showAllPorts ? rowsData : activeRows;

              const renderRow = (row: typeof rowsData[0], idx: number, total: number) => (
                <div
                  key={`${row.key}-${decodeGen}`}
                  className="channel-resolve flex items-stretch group min-w-0"
                  data-hit={isHit(row.value) ? "" : undefined}
                  style={{ animationDelay: `${Math.min(idx, 10) * 45}ms` }}
                  id={`breakout-container-${row.key}`}
                >
                  {/* Visually connecting signal breakout line */}
                  <BreakoutLine index={idx} total={rowsData.length} isActive={!!row.value} />

                  {/* Translator Node Port */}
                  <div
                    className={`hud-target flex-1 min-w-0 bg-bg-void/50 border p-2.5 space-y-1.5 relative hover:border-cyan-dim/30 hover:bg-bg-void/65 transition-all duration-300 ${
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
                        {/* Wraps and clamps instead of scrolling sideways. A
                            fixed-height nowrap box with overflow-x meant every
                            long value got its own horizontal scrollbar, and a
                            single wide value stretched the whole row past the
                            column. Long output now wraps to two lines and is
                            still selectable and copyable in full. */}
                        <div className="flex-1 min-w-0 bg-bg-void/80 border border-border-hairline/10 p-2 font-mono text-[13px] text-text-primary">
                          {/* The clamp lives on this inner div, not the flex
                              item above it. Flex items get their `display`
                              blockified, so -webkit-box became flow-root and
                              the line clamp silently did nothing — which is why
                              both the Tailwind utility and an inline style
                              failed here. A max-height clamp is not a
                              substitute: it cuts at an arbitrary pixel and
                              slices the last row of glyphs in half. */}
                          <div
                            className="select-all select-text break-all"
                            style={{
                              // Height clamp pinned to an exact multiple of the
                              // line box: 2 x 1.45em. That is what makes it cut
                              // between lines rather than through one — the
                              // earlier 2.9em against leading-snug was not an
                              // exact multiple, which is why glyphs were sliced.
                              // -webkit-box/line-clamp is not used: it is
                              // rejected here and silently degrades.
                              lineHeight: 1.45,
                              height: "2.9em",
                              overflow: "hidden",
                            }}
                          >
                          {row.value ? (
                            <ShinyText text={row.value} speed={3} className="tracking-wide" />
                          ) : (
                            <span className="text-text-dim/20 italic">-- PORT STANDBY --</span>
                          )}
                          </div>
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
              );

              return (
                <>
                  {shown.length === 0 && (
                    <div className="border border-dashed border-border-hairline/20 bg-bg-void/25 p-4 text-center">
                      <p className="font-display text-sm font-extrabold tracking-[0.16em] text-white uppercase">
                        Awaiting input
                      </p>
                      <p className="text-[12px] text-text-dim/70 font-share tracking-wide mt-1">
                        Paste into the buffer above and every format that can read it
                        will appear here.
                      </p>
                    </div>
                  )}

                  {shown.map((row, idx) => renderRow(row, idx, shown.length))}

                  {!showAllPorts && idleRows.length > 0 && (
                    <div className="border border-border-hairline/15 bg-bg-void/35 p-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-share text-[12px] tracking-widest text-text-dim/70 uppercase">
                          {idleRows.length} format{idleRows.length === 1 ? "" : "s"} produced nothing
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAllPorts(true)}
                          onMouseEnter={() => playHoverBlip()}
                          className="hud-target font-display text-[12px] font-extrabold tracking-[0.14em] uppercase text-accent-primary px-2 py-1 border border-accent-primary/40 hover:bg-accent-primary/10 transition-colors cursor-pointer"
                        >
                          Show all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {idleRows.map((r) => (
                          <span
                            key={r.key}
                            className="font-mono text-[12px] text-text-dim/50 border border-border-hairline/15 px-1.5 py-0.5 uppercase"
                          >
                            {r.badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {showAllPorts && (
                    <button
                      type="button"
                      onClick={() => setShowAllPorts(false)}
                      onMouseEnter={() => playHoverBlip()}
                      className="hud-target w-full font-display text-[12px] font-extrabold tracking-[0.14em] uppercase text-text-dim hover:text-accent-primary px-2 py-1.5 border border-border-hairline/20 hover:border-accent-primary/40 transition-colors cursor-pointer"
                    >
                      Collapse empty formats
                    </button>
                  )}
                </>
              );
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
                <h3 className="font-display text-[13px] font-black tracking-widest text-text-primary flex items-center mt-1">
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
                      <span className="text-text-dim/50 text-[12px] uppercase tracking-widest">STAGE {stageIdx + 1}</span>
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
                <h3 className="font-display text-[13px] font-black tracking-widest text-text-primary flex items-center mt-1">
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
                <h3 className="font-display text-[12px] font-black tracking-widest text-text-primary mt-0.5">
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

