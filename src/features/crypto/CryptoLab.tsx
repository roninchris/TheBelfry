import { ToolOptionsPanel } from "../../components/ui/ToolOptionsPanel";
import React, { useState, useMemo, useEffect } from "react";
import {
  Lock,
  Unlock,
  RefreshCw,
  Copy,
  CheckCircle,
  Hash,
  Activity,
  ArrowRight,
  ShieldAlert,
  Info,
  Radio,
  Sliders,
  Sparkles,
  Disc,
  BarChart2
} from "lucide-react";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import ProgressBar from "../../components/ui/ProgressBar";
import DecryptText from "../../components/ui/DecryptText";
import DataStream from "../../components/react-bits/DataStream";
import { playSuccessChime, playFailBuzz, playTypeKey, playHoverEvidence, playReticleLock, playPinClick } from "../../lib/soundEngine";
import HeroStat from "../../components/ui/HeroStat";
import DatabaseTag from "../../components/ui/DatabaseTag";
import RegistrationFrame from "../../components/ui/RegistrationFrame";
import VignetteBackdrop from "../../components/ui/VignetteBackdrop";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { getTool, getToolsByCategory, asText, asResult } from "../../lib/tools/registry";
import type { ToolEntry } from "../../lib/tools/types";
import { useAppStore } from "../../store/appStore";
import { Search, Star, Clock, LayoutGrid } from "lucide-react";
import {
  CIPHER_GROUPS,
  groupForCipher,
  useCipherPrefs,
  type CipherGroupId,
} from "./cipherTaxonomy";
import { bruteForceTool, DEFAULT_WORDLIST } from "../../lib/tools/bruteForce";
import WordlistControl from "../../components/brute-force/WordlistControl";
import { identifyInput } from "../../lib/tools/identify";
import { getLetterFrequencies } from "../../lib/tools/identify/index-of-coincidence";

function useAnimatedValue(target: number, duration: number = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start = performance.now();
    const initial = value;
    let raf: number;
    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(initial + (target - initial) * ease);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function AnimatedProgressBar({ value, variant, showValue = false }: { value: number, variant: any, showValue?: boolean }) {
  const animatedValue = useAnimatedValue(value, 1500);
  return <ProgressBar value={animatedValue} variant={variant} showValue={showValue} />;
}

// Ciphers most commonly seen in ARGs/puzzle hunts — surfaced first in the lab list
const ARG_PRIORITY_CIPHER_IDS = [
  "caesar", "vigenere", "atbash", "rot13", "railfence", "xor", "affine",
  "polybius", "bacon", "a1z26", "playfair", "bifid", "trifid", "hill",
  "enigma", "rot47", "cicada", "adfgvx", "adfgx"
];

function sortCiphersByArgPriority(tools: ToolEntry[]): ToolEntry[] {
  const priorityIndex = new Map(ARG_PRIORITY_CIPHER_IDS.map((id, idx) => [id, idx]));
  return [...tools].sort((a, b) => {
    const aIdx = priorityIndex.has(a.id) ? priorityIndex.get(a.id)! : Infinity;
    const bIdx = priorityIndex.has(b.id) ? priorityIndex.get(b.id)! : Infinity;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.label.localeCompare(b.label);
  });
}

// Standard English letter frequency distribution
const englishFrequencies: Record<string, number> = {
  A: 8.2, B: 1.5, C: 2.8, D: 4.3, E: 12.7, F: 2.2, G: 2.0, H: 6.1, I: 7.0,
  J: 0.2, K: 0.8, L: 4.0, M: 2.4, N: 6.7, O: 7.5, P: 1.9, Q: 0.1, R: 6.0,
  S: 6.3, T: 9.1, U: 2.8, V: 1.0, W: 2.4, X: 0.2, Y: 2.0, Z: 0.1
};

export default function CryptoLab() {
  const [activeTab, setActiveTab] = useState<"ciphers" | "identifier" | "frequency">("ciphers");
  const [selectedCipher, setSelectedCipher] = useState<string>("caesar");
  const [freqSortBy, setFreqSortBy] = useState<"letter" | "count" | "Actual" | "Expected" | "deviation">("letter");
  const [freqSortAsc, setFreqSortAsc] = useState<boolean>(true);

  // Cipher configuration parameters
  const [toolOptions, setToolOptions] = useState<Record<string, any>>({});

  useEffect(() => {
    const tool = getTool(selectedCipher);
    if (tool && tool.optionsSchema) {
      const defaultOpts: Record<string, any> = {};
      tool.optionsSchema.forEach(field => {
        defaultOpts[field.name] = field.defaultValue;
      });
      setToolOptions(defaultOpts);
    } else {
      setToolOptions({});
    }
    setLastOp("");
    setOutputText("");
  }, [selectedCipher]);

  const [cipherSearchQuery, setCipherSearchQuery] = useState<string>("");
  // Active library filter: everything, favorites, recents, or a taxonomy group.
  const [activeGroup, setActiveGroup] = useState<"all" | "favorites" | "recents" | CipherGroupId>("all");
  const { favorites, recents, toggleFavorite, pushRecent } = useCipherPrefs();

  const consumePendingTool = useAppStore((s) => s.consumePendingTool);
  const pendingToolId = useAppStore((s) => s.pendingToolId);

  /**
   * Pick up a cipher handed over from the Tool Database.
   *
   * The active group and search are reset alongside it: an incoming cipher that
   * sits outside the current filter would be selected but invisible in the
   * library list, which reads as the navigation having silently failed.
   */
  useEffect(() => {
    if (!pendingToolId) return;
    const requested = consumePendingTool();
    if (!requested) return;
    setSelectedCipher(requested);
    setActiveGroup("all");
    setCipherSearchQuery("");
  }, [pendingToolId, consumePendingTool]);

  // Full ordered cipher set (ARG priority) — stable source of truth.
  const allCiphers = useMemo(() => sortCiphersByArgPriority(getToolsByCategory("cipher")), []);
  // Stable display index per cipher id, independent of the active filter.
  const orderIndex = useMemo(() => {
    const m = new Map<string, number>();
    allCiphers.forEach((c, i) => m.set(c.id, i + 1));
    return m;
  }, [allCiphers]);

  // Search + filter applied to the full set.
  const filteredCiphers = useMemo(() => {
    const query = cipherSearchQuery.trim().toLowerCase();
    const matches = (c: ToolEntry) =>
      !query || c.label.toLowerCase().includes(query) || c.id.toLowerCase().includes(query);
    const pool = allCiphers.filter(matches);
    if (activeGroup === "favorites") return pool.filter((c) => favorites.includes(c.id));
    if (activeGroup === "recents")
      return recents.map((id) => pool.find((c) => c.id === id)).filter(Boolean) as ToolEntry[];
    if (activeGroup !== "all") return pool.filter((c) => groupForCipher(c.id) === activeGroup);
    return pool;
  }, [allCiphers, cipherSearchQuery, activeGroup, favorites, recents]);

  // When viewing "all", present grouped sections; otherwise a flat list.
  const groupedSections = useMemo(() => {
    if (activeGroup !== "all") return null;
    const byGroup = new Map<CipherGroupId, ToolEntry[]>();
    for (const c of filteredCiphers) {
      const g = groupForCipher(c.id);
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(c);
    }
    return CIPHER_GROUPS.filter((g) => byGroup.has(g.id)).map((g) => ({
      group: g,
      tools: byGroup.get(g.id)!,
    }));
  }, [filteredCiphers, activeGroup]);

  // IO buffers
  const [inputText, setInputText] = useState<string>("");
  const [outputText, setOutputText] = useState<string>("");
  const [outputHex, setOutputHex] = useState<string>("");
  const [flashOp, setFlashOp] = useState<number>(0);
  const [lastOp, setLastOp] = useState<"ENCRYPTED" | "DECRYPTED" | "">("");
  const [copied, setCopied] = useState(false);
  const [bruteWordlist, setBruteWordlist] = useState<string[]>(DEFAULT_WORDLIST);

  const runCipher = (mode: "encode" | "decode") => {
    if (!inputText.trim()) {
      playFailBuzz();
      return;
    }
    const tool = getTool(selectedCipher);
    if (!tool) return;

    const options = { ...toolOptions };
    if (selectedCipher === "enigma") {
      if (typeof options.rotors === "string") {
        options.rotors = options.rotors.split(",").map((s: string) => s.trim());
      }
      if (typeof options.ringSettings === "string") {
        options.ringSettings = options.ringSettings.split(",").map((s: string) => parseInt(s.trim(), 10) || 1);
      }
    }

    const output = mode === "encode" ? tool.encode(inputText, options) : tool.decode(inputText, options);
    const parsed = asResult(output);
    setOutputText(parsed.text);
    setOutputHex(parsed.hex ?? "");
    setLastOp(mode === "encode" ? "ENCRYPTED" : "DECRYPTED");
    setFlashOp(prev => prev + 1);
    playSuccessChime();
  };

  const handleEncrypt = () => runCipher("encode");
  const handleDecrypt = () => runCipher("decode");

  // Handle Quick Clipboard Copy
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Live calculation of input letter frequencies
  const chartData = useMemo(() => {
    const clean = inputText.toUpperCase().replace(/[^A-Z]/g, "");
    const counts: Record<string, number> = {};
    for (let i = 65; i <= 90; i++) {
      counts[String.fromCharCode(i)] = 0;
    }
    for (const char of clean) {
      counts[char] = (counts[char] || 0) + 1;
    }
    const total = clean.length || 1;
    return Object.entries(counts).map(([letter, count]) => ({
      name: letter,
      Actual: parseFloat(((count / total) * 100).toFixed(1)),
      Expected: englishFrequencies[letter] || 0
    }));
  }, [inputText]);

  // Compute entropy score
  const shannonEntropy = useMemo(() => {
    if (!inputText) return 0;
    const len = inputText.length;
    const freqs: Record<string, number> = {};
    for (const c of inputText) {
      freqs[c] = (freqs[c] || 0) + 1;
    }
    let entropy = 0;
    for (const count of Object.values(freqs)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return parseFloat(entropy.toFixed(3));
  }, [inputText]);

  // Index of coincidence (IOC)
  const indexCoincidence = useMemo(() => {
    const clean = inputText.toUpperCase().replace(/[^A-Z]/g, "");
    const len = clean.length;
    if (len <= 1) return 0;
    const counts: Record<string, number> = {};
    for (const char of clean) {
      counts[char] = (counts[char] || 0) + 1;
    }
    let sum = 0;
    for (const count of Object.values(counts)) {
      sum += count * (count - 1);
    }
    return parseFloat((sum / (len * (len - 1))).toFixed(5));
  }, [inputText]);

  // Brute Force candidates
  const bruteOutcome = useMemo(() => {
    if (!inputText.trim()) return { results: [], notes: [], failedCount: 0 };
    return bruteForceTool(selectedCipher, inputText, bruteWordlist);
  }, [inputText, selectedCipher, bruteWordlist]);
  const bruteCandidates = bruteOutcome.results;

  const identifiedResults = useMemo(() => {
    return identifyInput(inputText);
  }, [inputText]);

  // Compute live letter frequencies using getLetterFrequencies helper
  const frequencyData = useMemo(() => {
    const freqs = getLetterFrequencies(inputText);
    return freqs.map(item => {
      const actualPct = parseFloat((item.frequency * 100).toFixed(2));
      const expectedPct = englishFrequencies[item.letter] || 0;
      const deviation = parseFloat((actualPct - expectedPct).toFixed(2));
      return {
        letter: item.letter,
        count: item.count,
        Actual: actualPct,
        Expected: expectedPct,
        deviation
      };
    });
  }, [inputText]);

  const sortedFrequencyData = useMemo(() => {
    const data = [...frequencyData];
    data.sort((a, b) => {
      let valA: any = a[freqSortBy];
      let valB: any = b[freqSortBy];
      if (typeof valA === "string") {
        return freqSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return freqSortAsc ? valA - valB : valB - valA;
    });
    return data;
  }, [frequencyData, freqSortBy, freqSortAsc]);

  const handleFreqSort = (field: typeof freqSortBy) => {
    playPinClick();
    if (freqSortBy === field) {
      setFreqSortAsc(prev => !prev);
    } else {
      setFreqSortBy(field);
      // Letters default to alphabetical ascending, metrics to descending
      setFreqSortAsc(field === "letter");
    }
  };

  const selectCipher = (id: string) => {
    setSelectedCipher(id);
    setLastOp("");
    setOutputText("");
    pushRecent(id);
    playPinClick();
  };

  // Library filter chips: All / Favorites / Recents + the taxonomy groups.
  const filterChips: { id: "all" | "favorites" | "recents" | CipherGroupId; label: string; icon?: React.ReactNode }[] = [
    { id: "all", label: "ALL", icon: <LayoutGrid className="w-3 h-3" /> },
    { id: "favorites", label: "FAV", icon: <Star className="w-3 h-3" /> },
    { id: "recents", label: "RECENT", icon: <Clock className="w-3 h-3" /> },
    ...CIPHER_GROUPS.filter((g) => g.id !== "specialty").map((g) => ({ id: g.id, label: g.short })),
  ];

  const renderCipherRow = (cipher: ToolEntry) => {
    const isSelected = selectedCipher === cipher.id;
    const idx = orderIndex.get(cipher.id) ?? 0;
    const isFav = favorites.includes(cipher.id);
    return (
      <button
        key={cipher.id}
        onClick={() => selectCipher(cipher.id)}
        onMouseEnter={() => {
          playHoverEvidence();
          playReticleLock();
        }}
        className={`hud-target w-full text-left p-2.5 border transition-all duration-300 flex items-center justify-between relative overflow-hidden group ${
          isSelected
            ? "bg-cyan-primary/[0.06] border-cyan-primary text-text-primary shadow-[0_0_8px_rgb(var(--rgb-accent) / 0.15)]"
            : "bg-bg-void/40 border-border-hairline/10 text-text-dim hover:border-cyan-primary/45 hover:bg-cyan-primary/[0.02]"
        }`}
        style={{
          clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 10px) 100%, 0 100%, 0 6px)",
        }}
      >
        <div className="absolute inset-y-0 left-0 w-[2px] bg-border-hairline/20 group-hover:bg-cyan-primary/50 transition-colors duration-200" />
        {isSelected && <div className="absolute inset-y-0 left-0 w-[3px] bg-cyan-primary shadow-[0_0_6px_var(--color-accent-primary)]" />}

        <div className="flex items-center space-x-2 min-w-0 z-10 relative">
          <span className="font-mono text-[12px] text-text-dim group-hover:text-cyan-text transition-colors duration-200">
            [{String(idx).padStart(2, "0")}]
          </span>
          <div className="min-w-0">
            <p className="font-chakra text-[13px] font-bold uppercase tracking-wider leading-none truncate group-hover:text-cyan-text transition-colors duration-200">
              {cipher.label}
            </p>
            <p className="font-share text-[12px] text-text-dim/75 tracking-wide mt-1 truncate">
              {cipher.id.toUpperCase()} // SYS_RT_{String(idx).padStart(2, "0")}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 relative z-10 shrink-0">
          {/* Favorite toggle — span (not button) to avoid nested interactive elements */}
          <span
            role="button"
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(cipher.id);
              playPinClick();
            }}
            className={`p-0.5 transition-all cursor-pointer ${
              isFav
                ? "text-amber-alert drop-shadow-[0_0_4px_rgb(var(--rgb-amber) / 0.6)]"
                : "text-text-dim/30 hover:text-amber-alert/70 opacity-0 group-hover:opacity-100"
            }`}
          >
            <Star className="w-3.5 h-3.5" fill={isFav ? "currentColor" : "none"} />
          </span>
          <div
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              isSelected ? "bg-cyan-primary animate-pulse shadow-[0_0_6px_var(--color-accent-primary)]" : "bg-text-dim/30"
            }`}
          />
        </div>
      </button>
    );
  };

  return (
    <div className="h-full w-full p-4 flex flex-col space-y-4 overflow-y-auto font-chakra select-none">
      
      {/* TABS HEADER */}
      <div className="flex items-center justify-between border-b border-border-hairline/15 pb-2 shrink-0">
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setActiveTab("ciphers");
              playPinClick();
            }}
            onMouseEnter={() => playHoverEvidence()}
            className={`px-4 py-2 text-xs font-display font-black tracking-widest transition-all ${
              activeTab === "ciphers"
                ? "bg-cyan-primary/[0.08] text-cyan-text border-b-2 border-cyan-primary shadow-[0_4px_10px_-2px_rgb(var(--rgb-accent) / 0.2)]"
                : "text-text-dim hover:text-text-primary"
            }`}
          >
            DECRYPTION LAB
          </button>
          <button
            onClick={() => {
              setActiveTab("identifier");
              playPinClick();
            }}
            onMouseEnter={() => playHoverEvidence()}
            className={`px-4 py-2 text-xs font-display font-black tracking-widest transition-all ${
              activeTab === "identifier"
                ? "bg-cyan-primary/[0.08] text-cyan-text border-b-2 border-cyan-primary shadow-[0_4px_10px_-2px_rgb(var(--rgb-accent) / 0.2)]"
                : "text-text-dim hover:text-text-primary"
            }`}
          >
            CIPHER IDENTIFIER
          </button>
          <button
            onClick={() => {
              setActiveTab("frequency");
              playPinClick();
            }}
            onMouseEnter={() => playHoverEvidence()}
            className={`px-4 py-2 text-xs font-display font-black tracking-widest transition-all ${
              activeTab === "frequency"
                ? "bg-cyan-primary/[0.08] text-cyan-text border-b-2 border-cyan-primary shadow-[0_4px_10px_-2px_rgb(var(--rgb-accent) / 0.2)]"
                : "text-text-dim hover:text-text-primary"
            }`}
          >
            LETTER FREQUENCY
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <DatabaseTag text="FORENSIC DECODING ARRAY" />
        </div>
      </div>

      {activeTab === "ciphers" ? (
        <div className="grid grid-cols-12 xl:grid-rows-[minmax(0,1fr)] gap-4 flex-1 min-h-0">
          
          {/* ================= LEFT COLUMN: CONFIG & CIPHERS ================= */}
      <div className="col-span-12 xl:col-span-3 flex flex-col space-y-4">
        
        {/* Cipher Selector */}
        <GlassPanel className="p-4 flex flex-col flex-1" clipSize="md">
          <div className="border-b border-border-hairline/25 pb-2 mb-3">
            <h3 className="font-display text-xs font-black tracking-widest text-cyan-primary flex items-center">
              <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
              CRYPTOGRAPHIC CIPHERS
            </h3>
            <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
              Select decoding algorithm matrix
            </p>
          </div>

          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-text-dim/50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={cipherSearchQuery}
              onChange={(e) => setCipherSearchQuery(e.target.value)}
              placeholder="SEARCH CIPHER NAME..."
              className="w-full bg-bg-void/50 border border-border-hairline/20 focus:border-cyan-primary/60 pl-8 pr-2.5 py-1.5 text-[13px] font-share tracking-wide uppercase text-text-primary placeholder:text-text-dim/40 outline-none transition-colors"
              style={{
                clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 6px) 100%, 0 100%, 0 4px)"
              }}
            />
          </div>

          {/* Taxonomy filter chips — categorize 47 ciphers into browsable groups */}
          <div className="flex flex-wrap gap-1 mb-2.5">
            {filterChips.map((chip) => {
              const isActive = activeGroup === chip.id;
              const count =
                chip.id === "favorites"
                  ? favorites.length
                  : chip.id === "recents"
                  ? recents.length
                  : chip.id === "all"
                  ? allCiphers.length
                  : allCiphers.filter((c) => groupForCipher(c.id) === chip.id).length;
              return (
                <button
                  key={chip.id}
                  onClick={() => {
                    setActiveGroup(chip.id);
                    playPinClick();
                  }}
                  onMouseEnter={() => playHoverEvidence()}
                  className={`hud-target flex items-center gap-1 px-1.5 py-1 text-[12px] font-share font-bold tracking-widest uppercase border transition-all duration-200 ${
                    isActive
                      ? "bg-cyan-primary/15 border-cyan-primary text-cyan-text shadow-[0_0_6px_rgb(var(--rgb-accent) / 0.2)]"
                      : "bg-bg-void/40 border-border-hairline/15 text-text-dim/70 hover:border-cyan-primary/40 hover:text-cyan-text"
                  }`}
                  style={{ ["--reticle-size" as any]: "6px" }}
                >
                  {chip.icon}
                  <span>{chip.label}</span>
                  <span className={`font-mono ${isActive ? "text-cyan-primary" : "text-text-dim/40"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 flex-1 pr-1 overflow-y-auto scrollbar-thin max-h-[380px]">
            {filteredCiphers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed border-border-hairline/15 bg-bg-void/20">
                {activeGroup === "favorites" ? (
                  <>
                    <Star className="w-5 h-5 text-amber-alert/40" />
                    <p className="text-text-dim/50 text-center text-[12px] font-share uppercase tracking-wide px-4 leading-relaxed">
                      No favorites yet — tap the ☆ on any cipher to pin it here
                    </p>
                  </>
                ) : activeGroup === "recents" ? (
                  <>
                    <Clock className="w-5 h-5 text-cyan-primary/40" />
                    <p className="text-text-dim/50 text-center text-[12px] font-share uppercase tracking-wide px-4 leading-relaxed">
                      No recent engines — selected ciphers log here
                    </p>
                  </>
                ) : (
                  <p className="text-text-dim/40 text-center italic text-xs">-- NO MATCHING CIPHER --</p>
                )}
              </div>
            )}

            {groupedSections
              ? groupedSections.map((section) => (
                  <div key={section.group.id} className="space-y-1.5">
                    <div className="flex items-center gap-2 pt-1.5 pb-1 sticky top-0 bg-bg-panel/95 backdrop-blur-sm z-20">
                      <span className="w-1 h-2.5 bg-cyan-primary/70 transform -skew-x-12 shadow-[0_0_4px_var(--color-accent-primary)]" />
                      <span className="font-display text-[12px] font-black tracking-[0.2em] text-cyan-primary/90 uppercase">
                        {section.group.label}
                      </span>
                      <span className="font-mono text-[12px] text-text-dim/50">{section.tools.length}</span>
                      <div className="flex-1 h-[1px] bg-gradient-to-r from-cyan-primary/20 to-transparent" />
                    </div>
                    {section.tools.map(renderCipherRow)}
                  </div>
                ))
              : filteredCiphers.map(renderCipherRow)}
          </div>

          {/* Cipher settings controls */}
          <div className="border-t border-border-hairline/25 pt-3 mt-3 space-y-3.5 bg-bg-void/30 p-2.5 border border-border-hairline/10 relative">
            <DatabaseTag text="ALGORITHM KEY CONFIGURATION" className="mb-2.5 self-start" />

            {selectedCipher === "caesar" && (
              <div className="space-y-4 mb-4">
                <div className="flex justify-center my-5 relative">
                  <div className="w-32 h-32 rounded-full border border-border-hairline/25 relative flex items-center justify-center bg-bg-void/60 shadow-[inset_0_0_12px_rgba(0,0,0,0.8)] overflow-hidden">
                    {/* Rotating grid ticks */}
                    <div className="absolute inset-1.5 rounded-full border border-dashed border-cyan-primary/10 animate-[spin_60s_linear_infinite]" />
                    
                    {/* 26 letters arranged circularly around the rotor */}
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, idx) => {
                      const angle = (idx * 360) / 26 - 90;
                      const rad = (angle * Math.PI) / 180;
                      const x = Math.cos(rad) * 46;
                      const y = Math.sin(rad) * 46;
                      const isHighlighted = idx === (toolOptions.shift || 3) % 26;
                      return (
                        <span
                          key={letter}
                          className={`absolute font-mono text-[12px] font-black transition-all duration-300 ${
                            isHighlighted ? "text-cyan-primary scale-125 drop-shadow-[0_0_4px_rgb(var(--rgb-accent) / 0.8)]" : "text-text-dim/30"
                          }`}
                          style={{
                            transform: `translate(${x}px, ${y}px)`
                          }}
                        >
                          {letter}
                        </span>
                      );
                    })}

                    {/* Rotating center core dial wheel */}
                    <div className="charge-ring w-14 h-14 rounded-full bg-bg-void border border-cyan-primary/30 flex items-center justify-center relative shadow-[0_0_10px_rgb(var(--rgb-accent) / 0.15)] z-10">
                      <Disc className="w-10 h-10 text-cyan-primary/15 absolute animate-[spin_12s_linear_infinite_reverse]" />
                      <RefreshCw 
                        className="w-7 h-7 text-cyan-primary drop-shadow-[0_0_6px_rgb(var(--rgb-accent) / 0.4)]" 
                        style={{ 
                          transform: `rotate(${(toolOptions.shift || 3) * (360/26)}deg)`, 
                          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                        }} 
                      />
                      <div className="absolute inset-0 flex items-center justify-center font-display text-[13px] font-black text-cyan-text">
                        {toolOptions.shift || 3}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedCipher === "vigenere" && (
              <div className="mb-4">
                <p className="text-[12px] font-share text-text-dim leading-relaxed uppercase">
                  Longer keywords increase the secure polyalphabetic shift spacing.
                </p>
              </div>
            )}

            {selectedCipher === "rot13" && (
              <div className="text-[12px] font-share text-text-dim/80 leading-relaxed uppercase space-y-1 bg-bg-void/40 p-2">
                <div className="flex justify-center my-5 relative">
                  <div className="w-32 h-32 rounded-full border border-border-hairline/25 relative flex items-center justify-center bg-bg-void/60 shadow-[inset_0_0_12px_rgba(0,0,0,0.8)] overflow-hidden">
                    <div className="absolute inset-1.5 rounded-full border border-dashed border-cyan-primary/10 animate-[spin_60s_linear_infinite]" />
                    
                    {/* 26 letters with ROT13 highlighted */}
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter, idx) => {
                      const angle = (idx * 360) / 26 - 90;
                      const rad = (angle * Math.PI) / 180;
                      const x = Math.cos(rad) * 46;
                      const y = Math.sin(rad) * 46;
                      const isHighlighted = idx === 13;
                      return (
                        <span
                          key={letter}
                          className={`absolute font-mono text-[12px] font-black transition-all duration-300 ${
                            isHighlighted ? "text-cyan-primary scale-125 drop-shadow-[0_0_4px_rgb(var(--rgb-accent) / 0.8)]" : "text-text-dim/30"
                          }`}
                          style={{
                            transform: `translate(${x}px, ${y}px)`
                          }}
                        >
                          {letter}
                        </span>
                      );
                    })}

                    <div className="charge-ring w-14 h-14 rounded-full bg-bg-void border border-cyan-primary/30 flex items-center justify-center relative shadow-[0_0_10px_rgb(var(--rgb-accent) / 0.15)] z-10">
                      <Disc className="w-10 h-10 text-cyan-primary/15 absolute animate-[spin_12s_linear_infinite_reverse]" />
                      <RefreshCw 
                        className="w-7 h-7 text-cyan-primary drop-shadow-[0_0_6px_rgb(var(--rgb-accent) / 0.4)]" 
                        style={{ transform: `rotate(${13 * (360/26)}deg)` }} 
                      />
                      <div className="absolute inset-0 flex items-center justify-center font-display text-[13px] font-black text-cyan-text">
                        13
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-cyan-primary font-bold block text-center">FIXED OFFSET 13</span>
                <p>
                  Symmetric rotation where enciphering and deciphering use identical steps. Standard unix obfuscation protocol.
                </p>
              </div>
            )}
 
            {selectedCipher === "atbash" && (
              <div className="text-[12px] font-share text-text-dim/80 leading-relaxed uppercase space-y-1 bg-bg-void/40 p-2">
                <span className="text-cyan-primary font-bold">REVERSED ALPHABET</span>
                <p>
                  A is mapped to Z, B to Y, C to X. Fixed reciprocal cipher. No key or settings necessary.
                </p>
              </div>
            )}
 
            {["vigenere", "playfair", "bifid", "trifid"].includes(selectedCipher) && (
              <WordlistControl onWordlistChange={setBruteWordlist} />
            )}

            <div className="space-y-4">
              <ToolOptionsPanel 
                optionsSchema={getTool(selectedCipher)?.optionsSchema}
                options={toolOptions}
                onChange={(key, value) => {
                  setToolOptions(prev => ({ ...prev, [key]: value }));
                  setLastOp("");
                }}
                variant="default"
              />
            </div>
          </div>
        </GlassPanel>

        {/* Real-time Crypto Diagnostics */}
        <GlassPanel className="p-4 h-48 flex flex-col justify-between" clipSize="md" showCornerTicks={true}>
          <div className="border-b border-border-hairline/25 pb-1.5 mb-2.5 flex items-center">
            <DatabaseTag text="STREAM COMPLEXITY RATIOS" />
          </div>

          <div className="flex-1 space-y-2.5 font-share text-[13px]">
            <div>
              <HeroStat
                label="SHANNON ENTROPY"
                value={`${shannonEntropy} BITS`}
                valueClassName={`!text-lg ${shannonEntropy > 4.5 ? "text-amber-text" : "text-cyan-text"}`}
                disabledShine={true}
              />
              <AnimatedProgressBar value={(shannonEntropy / 8) * 100} variant={shannonEntropy > 4.5 ? "amber" : "cyan"} showValue={false} />
              <span className="text-[12px] text-text-dim uppercase mt-0.5 block">
                {shannonEntropy > 4.5 ? "HIGH-ENTROPY CIPHERTEXT SUSPECTED" : "LOW-ENTROPY PLAINTEXT PATTERN"}
              </span>
            </div>

            <div>
              <HeroStat
                label="INDEX OF COINCIDENCE"
                value={String(indexCoincidence)}
                valueClassName="!text-lg text-cyan-text"
                disabledShine={true}
              />
              <AnimatedProgressBar value={Math.min(indexCoincidence * 1000, 100)} variant="cyan" showValue={false} />
              <span className="text-[12px] text-text-dim uppercase mt-0.5 block">
                ENGLISH STANDARD STANDARD RATIO: ~0.0667
              </span>
            </div>
          </div>
        </GlassPanel>

      </div>

      {/* ================= CENTER COLUMN: BUFFER & CONTROLS ================= */}
      <RegistrationFrame className="col-span-12 xl:col-span-5 flex flex-col p-2 bg-bg-void/10 border border-cyan-primary/10 relative overflow-hidden" glow={true}>
        <VignetteBackdrop intensity="medium" className="z-0" />
        
        <div className="flex-1 flex flex-col space-y-4 relative z-10 h-full">
          {/* Input buffer */}
          <GlassPanel className="p-4 flex-1 flex flex-col relative overflow-hidden min-h-[300px]" clipSize="md" showCornerTicks={true}>
            <div className="border-b border-border-hairline/25 pb-2 mb-3 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <DatabaseTag text="FORENSIC DATA INPUT BUFFER" />
              </div>
              <span className="text-[12px] font-share text-text-dim uppercase">
                {inputText.length} CHARS
              </span>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setLastOp("");
                playTypeKey();
              }}
              placeholder="ENTER CIPHERTEXT OR PLAINTEXT FOR ALGORITHMIC TRANSFORMATION..."
              className="w-full flex-1 bg-bg-void/40 border border-border-hairline/15 rounded-none p-3.5 font-mono text-[14px] md:text-sm leading-relaxed text-white outline-none focus:border-cyan-primary/50 resize-none scrollbar-thin overflow-y-auto placeholder:text-text-dim/40"
            />

            {/* Quick Clear & Preload triggers */}
            <div className="mt-2.5 flex justify-between text-[12px] font-share text-text-dim">
              <button
                onClick={() => {
                  setInputText("");
                  setOutputText("");
                  setLastOp("");
                  playPinClick();
                }}
                onMouseEnter={() => playHoverEvidence()}
                className="hover:text-red-threat border border-border-hairline/15 px-2 py-1 bg-bg-void/30 transition-all uppercase"
              >
                CLEAR INPUT
              </button>
            </div>
          </GlassPanel>

          {/* Decoder triggers / operator console */}
          <div className="flex space-x-3 items-stretch">
            <button
              onClick={handleDecrypt}
              onMouseEnter={() => playHoverEvidence()}
              className="engine-btn hud-target flex-1 text-sm py-4 cursor-pointer flex items-center justify-center space-x-2"
              style={{
                clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                "--engine-color": "var(--color-green-active)",
                "--reticle-color": "var(--color-green-active)"
              } as React.CSSProperties}
            >
              <Unlock className="w-5 h-5" />
              <span>RUN DECRYPTION ENGINE</span>
            </button>
            <button
              onClick={handleEncrypt}
              onMouseEnter={() => playHoverEvidence()}
              className="engine-btn hud-target flex-1 text-sm py-4 cursor-pointer flex items-center justify-center space-x-2"
              style={{
                clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                "--engine-color": "var(--color-blue-pale)",
                "--reticle-color": "var(--color-blue-pale)"
              } as React.CSSProperties}
            >
              <Lock className="w-5 h-5" />
              <span>RUN ENCRYPTION ENGINE</span>
            </button>
          </div>

          {/* Output buffer */}
          <div className="relative flex-1 flex flex-col min-h-[300px]">
            <GlassPanel className="p-4 h-full flex flex-col" clipSize="md" showCornerTicks={true}>
              <div className="border-b border-border-hairline/25 pb-2 mb-3 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <DatabaseTag text="DECRYPTED / ENCRYPTED RESULT OUTPUT" />
                  {lastOp && (
                    <Badge variant={lastOp === "ENCRYPTED" ? "amber" : "green"} size="xs">
                      {lastOp}
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => {
                    copyToClipboard(outputText);
                    playSuccessChime();
                  }}
                  onMouseEnter={() => playHoverEvidence()}
                  disabled={!outputText}
                  className="text-text-dim hover:text-cyan-primary flex items-center space-x-1 text-[12px] uppercase border border-border-hairline/15 px-2 py-0.5 bg-bg-void/40 transition-colors"
                >
                  {copied ? <CheckCircle className="w-3 h-3 text-green-verified" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "COPIED" : "COPY OUTPUT"}</span>
                </button>
              </div>

              <div className="w-full flex-1 bg-bg-void/40 border border-border-hairline/15 p-3.5 font-mono text-[14px] md:text-sm leading-relaxed text-text-primary overflow-y-auto scrollbar-thin">
                {outputText ? (
                  <div className="space-y-4 select-text">
                    <HeroStat
                      label={lastOp ? `${lastOp} PLAIN/CIPHER RESULT` : "TRANSFORMED RESULT"}
                      value={
                        <div className="break-all whitespace-pre-wrap text-[14px] md:text-sm font-mono font-medium leading-relaxed text-cyan-text select-text">
                          <DecryptText text={outputText} trigger={outputText} duration={900} />
                        </div>
                      }
                      valueClassName="w-full"
                      disabledShine={true}
                    />
                    {selectedCipher === "xor" && outputHex && (
                      <div className="border-t border-border-hairline/10 pt-2.5">
                        <HeroStat
                          label="XOR OUTPUT IN HEXADECIMAL"
                          value={
                            <div className="break-all font-mono text-[13px] md:text-xs font-medium leading-normal text-amber-text select-text">
                              <DecryptText text={outputHex} trigger={outputHex} duration={900} />
                            </div>
                          }
                          valueClassName="w-full"
                          disabledShine={true}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-text-dim/30 italic text-center py-16 text-xs uppercase select-none">
                    -- Transformed output ciphertext/plaintext results populate here --
                  </p>
                )}
              </div>
            </GlassPanel>
            <div 
              key={`flash-${flashOp}`} 
              className="pointer-events-none absolute inset-0 border-2 border-transparent animate-lock-on-flash z-50"
              style={{ clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)" }}
            />
          </div>
        </div>

      </RegistrationFrame>

      {/* ================= RIGHT COLUMN: ANALYSIS & CHART ================= */}
      <div className="col-span-12 xl:col-span-4 flex flex-col space-y-4">
        
        {/* Frequency distribution Recharts */}
        <GlassPanel className="p-4 shrink-0 flex flex-col" clipSize="md" showCornerTicks={true}>
          <div className="border-b border-border-hairline/25 pb-2 mb-3">
            <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center">
              <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
              UNIGRAM FREQUENCY COMPASS
            </h3>
            <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
              Live text frequencies vs English baseline %
            </p>
          </div>

          <div className="h-[230px] shrink-0 relative">
            {!inputText.trim() && (
              <div className="absolute inset-0 bg-bg-void/35 backdrop-blur-[1px] flex flex-col justify-center items-center z-10 space-y-1.5 pointer-events-none">
                <span className="font-mono text-[12px] text-cyan-primary/50 tracking-wider font-bold uppercase animate-pulse">
                  // GRAPHIC SPECTRUM IDLE //
                </span>
                <span className="font-share text-[12px] text-text-dim/60 uppercase">
                  Awaiting input buffer characters to map weights
                </span>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
              >
                <XAxis
                  dataKey="name"
                  stroke="var(--color-cyan-primary)"
                  fontSize={8}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--color-cyan-primary)"
                  fontSize={8}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-bg-void)",
                    borderColor: "rgba(77, 217, 232, 0.3)",
                    color: "var(--color-cyan-text)",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "10px"
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: "9px",
                    fontFamily: "Chakra Petch",
                    color: "var(--color-cyan-primary)"
                  }}
                />
                <Bar dataKey="Actual" fill="var(--color-accent-primary)" name="Input Frequency %" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Expected" fill="var(--color-amber-alert)" name="English baseline %" fillOpacity={0.25} stroke="var(--color-amber-alert)" strokeWidth={1} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        {/* Caesar brute forcing shift scanner (when Caesar is active) or reference metadata */}
        {selectedCipher === "caesar" ? (
          <GlassPanel className="p-4 h-64 flex flex-col justify-between" clipSize="md" showCornerTicks={true}>
            <div className="border-b border-border-hairline/25 pb-1 mb-2 flex justify-between items-center">
              <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-text flex items-center">
                <span className="w-1 h-2 bg-cyan-primary mr-1.5 transform -skew-x-12 inline-block shadow-[0_0_4px_var(--color-accent-primary)]" />
                CAESAR BRUTE FORCE PREVIEWER
              </h3>
              {inputText.trim() && (
                <span className="text-[12px] font-mono text-green-verified animate-pulse">
                  SCANNING_ACTIVE
                </span>
              )}
            </div>

            {inputText.trim() ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Rolling candidates pipeline stream */}
                <div className="bg-bg-void/60 border border-cyan-primary/20 p-1 mb-2">
                  <div className="flex justify-between items-center text-[12px] font-mono text-cyan-dim uppercase px-1">
                    <span>LIVE DECRYPTION PIPELINE</span>
                    <span className="animate-pulse">SCANNING...</span>
                  </div>
                  <DataStream 
                    text={bruteCandidates.length > 0 
                      ? bruteCandidates.slice(0, 20).map(c => `[${c.label}]: ${c.output.slice(0, 40).replace(/\n/g, ' ')}`).join("  ||  ")
                      : "BRUTE-FORCE NOT AVAILABLE FOR THIS TOOL"} 
                    speed={25} 
                    className="font-mono text-[12px] text-cyan-primary/80" 
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 max-h-[110px]">
                  {bruteCandidates.length > 0 ? bruteCandidates.slice(0, 50).map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setToolOptions(prev => ({ ...prev, ...c.options }));
                        setOutputText(c.output);
                        setLastOp("DECRYPTED");
                        setFlashOp(prev => prev + 1);
                      }}
                      onMouseEnter={() => {
                        playHoverEvidence();
                        playReticleLock();
                      }}
                      className={`w-full text-left p-1.5 border flex items-center justify-between text-[13px] font-mono transition-colors relative group ${
                        JSON.stringify(c.options) === JSON.stringify(toolOptions)
                          ? "bg-cyan-primary/10 border-cyan-primary text-text-primary"
                          : "bg-bg-void/40 border-border-hairline/10 text-text-dim hover:border-cyan-primary/35 hover:text-text-primary"
                      }`}
                      style={{ clipPath: "polygon(0 0, 100% 0, 98% 100%, 0 100%)" }}
                    >
                      <div className="absolute inset-y-0 left-0 w-[1.5px] bg-transparent group-hover:bg-cyan-primary transition-colors duration-200" />
                      <span className="text-cyan-primary font-bold z-10 truncate max-w-[120px]">{c.label}:</span>
                      <span className="truncate flex-1 ml-2 text-left lowercase z-10 text-[12px]">{c.output.slice(0, 50)}</span>
                      <span className="text-[12px] font-share uppercase opacity-60 text-cyan-dim ml-1 z-10 group-hover:opacity-100 transition-opacity whitespace-nowrap">APPLY</span>
                    </button>
                  )) : (
                    <div className="h-full flex items-center justify-center text-[13px] font-mono text-text-dim/40 uppercase tracking-widest border border-dashed border-border-hairline/10 bg-bg-void/10 p-4">
                       Brute-force unavailable
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center p-3 border border-dashed border-border-hairline/15 bg-bg-void/20 space-y-2.5 my-1.5">
                <Activity className="w-4 h-4 text-cyan-primary/30 animate-pulse" />
                <div className="text-center space-y-1">
                  <span className="text-[12px] font-mono text-cyan-primary/60 tracking-wider block font-bold">
                    BRUTE_FORCE_STANDBY
                  </span>
                  <p className="text-[12px] font-share text-text-dim leading-normal uppercase max-w-[200px]">
                    Enter ciphertext in buffer to rotate indices dynamically
                  </p>
                </div>
                <div className="w-full bg-bg-void/80 border border-border-hairline/10 p-1 overflow-hidden mt-1">
                  <DataStream 
                    text="SYS_STANDBY_MODE // KEY_ ROT_DECRYPT // ROT_01_STANDBY... ROT_02_STANDBY... ROT_03_STANDBY... ROT_04_STANDBY... ROT_05_STANDBY..." 
                    speed={15} 
                    className="font-mono text-[12px] text-cyan-primary/25" 
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between text-[12px] font-mono text-text-dim border-t border-border-hairline/15 pt-1.5 mt-2">
              <span>SCAN SHIFTS: 1 to 25</span>
              <span className="text-cyan-dim animate-hex-pulse-flicker font-bold">CLICK PREVIEW TO LOAD SHIFT</span>
            </div>
          </GlassPanel>
        ) : (
          <GlassPanel className="p-4 h-64 flex flex-col justify-between" clipSize="md" showCornerTicks={true}>
            <div className="border-b border-border-hairline/25 pb-1 mb-2">
              <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-text flex items-center">
                <span className="w-1 h-2 bg-cyan-primary mr-1.5 transform -skew-x-12 inline-block shadow-[0_0_4px_var(--color-accent-primary)]" />
                FORENSIC CRYPTO REFERENCE
              </h3>
            </div>

            <div className="flex-1 text-[12px] font-share text-text-dim leading-relaxed space-y-2 overflow-y-auto scrollbar-thin max-h-[140px]">
              <div className="border-b border-border-hairline/10 pb-1.5">
                <span className="text-cyan-primary font-bold uppercase block">Polyalphabetic Ciphers</span>
                <span>Vigenère utilizes multiple shift alphabets dynamically using a keyword, flattening letter frequency curves and frustrating simple frequency attacks.</span>
              </div>
              <div className="border-b border-border-hairline/10 pb-1.5">
                <span className="text-cyan-primary font-bold uppercase block">Bitwise Security</span>
                <span>XOR operations are highly secure when keys are perfectly random and matching the length of the message (One-Time Pad). Used extensively in machine-level protocols.</span>
              </div>
              <div>
                <span className="text-cyan-primary font-bold uppercase block">Atbash Reciprocity</span>
                <span>An ancient monoalphabetic cipher based on symmetric reversal. Simple mapping makes security highly transient but useful for historic riddle extraction.</span>
              </div>
            </div>

            <div className="flex justify-between text-[12px] font-mono text-text-dim border-t border-border-hairline/15 pt-1.5 mt-2">
              <span>BELFRY DATABASE // v2.8</span>
              <span className="text-green-verified font-bold">SECURE LOGIC LINKED</span>
            </div>
          </GlassPanel>
        )}

      </div>

    </div>
      ) : activeTab === "identifier" ? (
        <div className="grid grid-cols-12 xl:grid-rows-[minmax(0,1fr)] gap-4 flex-1 min-h-0">
          {/* INPUT BUFFER (Left) */}
          <div className="col-span-12 lg:col-span-6 flex flex-col space-y-4">
            <GlassPanel className="p-5 flex-1 flex flex-col relative overflow-hidden" clipSize="md" showCornerTicks={true}>
              <div className="border-b border-border-hairline/25 pb-2 mb-3 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                  <DatabaseTag text="FORENSIC TARGET STREAM" />
                </div>
                <span className="text-[12px] font-share text-text-dim uppercase">
                  {inputText.length} CHARS
                </span>
              </div>

              <p className="text-[13px] font-share text-text-dim uppercase mb-3 leading-relaxed">
                PASTE ANY SCRAMBLED CODES, BINARY BLOCKS, OR ENCRYPTED MESSAGE SEGMENTS HERE. THE AUTOMATED HEURISTIC ENGINE WILL FINGERPRINT THE SIGNAL AND RANK THE PROBABLE ALGORITHMS.
              </p>

              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  playTypeKey();
                }}
                placeholder="INPUT CODES FOR AUTOMATED PATTERN ANALYSIS..."
                className="w-full flex-1 bg-bg-void/40 border border-border-hairline/15 p-4 font-mono text-[14px] leading-relaxed text-white outline-none focus:border-cyan-primary/50 resize-none scrollbar-thin overflow-y-auto placeholder:text-text-dim/30"
              />

              <div className="mt-3 flex justify-between text-[12px] font-share text-text-dim">
                <button
                  onClick={() => {
                    setInputText("");
                    playPinClick();
                  }}
                  onMouseEnter={() => playHoverEvidence()}
                  className="hover:text-red-threat border border-border-hairline/15 px-3 py-1.5 bg-bg-void/30 transition-all uppercase cursor-pointer text-text-dim hover:text-white"
                >
                  CLEAR INPUT
                </button>
              </div>
            </GlassPanel>

            {/* Quick Metrics */}
            <GlassPanel className="p-4 h-44 flex flex-col justify-between" clipSize="md">
              <div className="border-b border-border-hairline/25 pb-1.5 flex items-center">
                <DatabaseTag text="SIGNAL METRIC SUMMARY" />
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1 pt-2 font-share text-[13px]">
                <div>
                  <HeroStat
                    label="SHANNON ENTROPY"
                    value={`${shannonEntropy} BITS`}
                    valueClassName="!text-sm text-cyan-text"
                    disabledShine={true}
                  />
                  <div className="text-[12px] text-text-dim uppercase mt-1">
                    {shannonEntropy > 4.5 ? "HIGH ENTROPY SIGNAL" : "STRUCTURED CHARACTER FLUX"}
                  </div>
                </div>
                <div>
                  <HeroStat
                    label="INDEX OF COINCIDENCE"
                    value={String(indexCoincidence)}
                    valueClassName="!text-sm text-cyan-text"
                    disabledShine={true}
                  />
                  <div className="text-[12px] text-text-dim uppercase mt-1">
                    ENGLISH REFERENCE IC: ~0.0667
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>

          {/* RESULTS (Right) */}
          <div className="col-span-12 lg:col-span-6 flex flex-col">
            <GlassPanel className="p-5 flex-1 flex flex-col overflow-hidden" clipSize="md" showCornerTicks={true}>
              <div className="border-b border-border-hairline/25 pb-2 mb-3">
                <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center">
                  <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                  ALGORITHMIC IDENTIFICATION RESULTS
                </h3>
              </div>

              {!inputText.trim() ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-3 border border-dashed border-border-hairline/10 bg-bg-void/10 p-6">
                  <Activity className="w-8 h-8 text-cyan-primary/20 animate-pulse" />
                  <div>
                    <span className="font-mono text-xs text-cyan-primary/60 font-black uppercase tracking-widest block">
                      AWAITING INPUT TELEMETRY
                    </span>
                    <p className="text-[13px] font-share text-text-dim/60 uppercase max-w-[280px] mt-1 leading-relaxed">
                      Provide message string data in the target buffer to spin up the forensic heuristic array.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                  {identifiedResults.length === 0 ? (
                    <p className="text-text-dim/40 text-center italic py-12 text-xs">
                      -- NO PROBABLE ENGINE IDENTIFIED --
                    </p>
                  ) : (
                    identifiedResults.map((candidate, idx) => {
                      const confidencePercent = Math.round(candidate.confidence * 100);
                      const isTopResult = idx === 0 && candidate.confidence > 0.4;
                      
                      // Colored based on confidence
                      let barVariant = "cyan";
                      let textColor = "text-cyan-text";
                      if (candidate.confidence > 0.8) {
                        barVariant = "green";
                        textColor = "text-green-verified";
                      } else if (candidate.confidence > 0.4) {
                        barVariant = "amber";
                        textColor = "text-amber-text";
                      }

                      return (
                        <div
                          key={candidate.toolId + "-" + idx}
                          className={`p-4 border transition-all duration-300 relative overflow-hidden group ${
                            isTopResult
                              ? "bg-cyan-primary/[0.04] border-cyan-primary/60 shadow-[0_0_12px_rgb(var(--rgb-accent) / 0.1)]"
                              : "bg-bg-void/30 border-border-hairline/10"
                          }`}
                          style={{
                            clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 10px) 100%, 0 100%, 0 6px)"
                          }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-[13px] text-text-dim font-bold">
                                  [{String(idx + 1).padStart(2, "0")}]
                                </span>
                                <h4 className="font-display text-xs font-black tracking-wider uppercase text-white">
                                  {candidate.toolId.toUpperCase()}
                                </h4>
                                {isTopResult && (
                                  <Badge variant="cyan" size="xs" className="animate-pulse">
                                    PRIMARY CANDIDATE
                                  </Badge>
                                )}
                              </div>
                              <p className="font-share text-[13px] text-text-primary mt-1">
                                {candidate.preview || `Matches characteristic patterns of ${candidate.toolId}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`font-display text-xs font-black ${textColor}`}>
                                {confidencePercent}%
                              </span>
                              <span className="text-[12px] font-share text-text-dim block uppercase">
                                MATCH CONFIDENCE
                              </span>
                            </div>
                          </div>

                          <div className="my-2.5">
                            <ProgressBar value={confidencePercent} variant={barVariant as any} showValue={false} />
                          </div>

                          <p className="font-mono text-[12px] text-text-dim mt-1.5 bg-bg-void/50 p-2 border border-border-hairline/5 leading-relaxed">
                            {candidate.details}
                          </p>

                          {/* Action Button */}
                          <div className="mt-3 flex justify-end">
                            {getTool(candidate.toolId) ? (
                              <button
                                onClick={() => {
                                  // Match to registry tool
                                  setSelectedCipher(candidate.toolId);
                                  setActiveTab("ciphers");
                                  playSuccessChime();
                                }}
                                onMouseEnter={() => playHoverEvidence()}
                                className="px-3 py-1 bg-cyan-primary/10 hover:bg-cyan-primary text-cyan-text hover:text-bg-void border border-cyan-primary/30 hover:border-cyan-primary font-display font-bold text-[12px] tracking-widest uppercase transition-all flex items-center space-x-1.5 cursor-pointer"
                                style={{
                                  clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)"
                                }}
                              >
                                <span>APPLY LAB ENGINE</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span
                                className="px-3 py-1 bg-bg-void/40 text-text-dim/50 border border-border-hairline/15 font-display font-bold text-[12px] tracking-widest uppercase flex items-center space-x-1.5 cursor-not-allowed"
                                style={{
                                  clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)"
                                }}
                                title="This is a general classification, not a specific cipher engine — try the candidates it names manually in the Decryption Lab."
                              >
                                <span>NO SPECIFIC ENGINE</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </GlassPanel>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 xl:grid-rows-[minmax(0,1fr)] gap-4 flex-1 min-h-0">
          {/* INPUT BUFFER (Left) */}
          <div className="col-span-12 lg:col-span-6 flex flex-col space-y-4">
            <GlassPanel className="p-5 flex-1 flex flex-col relative overflow-hidden" clipSize="md" showCornerTicks={true}>
              <div className="border-b border-border-hairline/25 pb-2 mb-3 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                  <DatabaseTag text="FORENSIC TARGET STREAM" />
                </div>
                <span className="text-[12px] font-share text-text-dim uppercase">
                  {inputText.length} CHARS
                </span>
              </div>

              <p className="text-[13px] font-share text-text-dim uppercase mb-3 leading-relaxed">
                PASTE ANY SCRAMBLED CODES, CIPHERTEXT SEGMENTS, OR RAW TEXT TO CALCULATE EXACT UNIGRAM FREQUENCY AND IDENTIFY DEVIATIONS FROM ENGLISH BASELINE VALUES.
              </p>

              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  playTypeKey();
                }}
                placeholder="INPUT CODES FOR AUTOMATED FREQUENCY ANALYSIS..."
                className="w-full flex-1 bg-bg-void/40 border border-border-hairline/15 p-4 font-mono text-[14px] leading-relaxed text-white outline-none focus:border-cyan-primary/50 resize-none scrollbar-thin overflow-y-auto placeholder:text-text-dim/30"
              />

              <div className="mt-3 flex justify-between text-[12px] font-share text-text-dim">
                <button
                  onClick={() => {
                    setInputText("");
                    playPinClick();
                  }}
                  onMouseEnter={() => playHoverEvidence()}
                  className="hover:text-red-threat border border-border-hairline/15 px-3 py-1.5 bg-bg-void/30 transition-all uppercase cursor-pointer text-text-dim hover:text-white"
                >
                  CLEAR INPUT
                </button>
              </div>
            </GlassPanel>

            {/* Quick Metrics */}
            <GlassPanel className="p-4 h-44 flex flex-col justify-between" clipSize="md">
              <div className="border-b border-border-hairline/25 pb-1.5 flex items-center">
                <DatabaseTag text="SIGNAL METRIC SUMMARY" />
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1 pt-2 font-share text-[13px]">
                <div>
                  <HeroStat
                    label="SHANNON ENTROPY"
                    value={`${shannonEntropy} BITS`}
                    valueClassName="!text-sm text-cyan-text"
                    disabledShine={true}
                  />
                  <div className="text-[12px] text-text-dim uppercase mt-1">
                    {shannonEntropy > 4.5 ? "HIGH ENTROPY SIGNAL" : "STRUCTURED CHARACTER FLUX"}
                  </div>
                </div>
                <div>
                  <HeroStat
                    label="INDEX OF COINCIDENCE"
                    value={String(indexCoincidence)}
                    valueClassName="!text-sm text-cyan-text"
                    disabledShine={true}
                  />
                  <div className="text-[12px] text-text-dim uppercase mt-1">
                    ENGLISH REFERENCE IC: ~0.0667
                  </div>
                </div>
              </div>
            </GlassPanel>
          </div>

          {/* FREQUENCY ANALYSIS (Right) */}
          <div className="col-span-12 lg:col-span-6 flex flex-col space-y-4">
            {/* Visualizer */}
            <GlassPanel className="p-5 h-72 flex flex-col overflow-hidden" clipSize="md" showCornerTicks={true}>
              <div className="border-b border-border-hairline/25 pb-2 mb-3">
                <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center">
                  <BarChart2 className="w-4 h-4 mr-2 text-cyan-primary animate-pulse" />
                  UNIGRAM FREQUENCY ANALYSIS
                </h3>
                <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
                  Comparative distribution spectrum: Live text frequency vs english standard
                </p>
              </div>

              <div className="flex-1 relative min-h-0">
                {!inputText.trim() ? (
                  <div className="absolute inset-0 bg-bg-void/35 backdrop-blur-[1px] flex flex-col justify-center items-center z-10 space-y-1.5">
                    <span className="font-mono text-[12px] text-cyan-primary/50 tracking-wider font-bold uppercase animate-pulse">
                      // ANALYSIS MATRIX STANDBY //
                    </span>
                    <span className="font-share text-[12px] text-text-dim/60 uppercase">
                      Provide message string data to populate frequency waves
                    </span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={frequencyData}
                      margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                    >
                      <XAxis
                        dataKey="letter"
                        stroke="var(--color-cyan-primary)"
                        fontSize={8}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--color-cyan-primary)"
                        fontSize={8}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#05090c",
                          borderColor: "rgba(77, 217, 232, 0.3)",
                          color: "var(--color-cyan-text)",
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "10px"
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          fontSize: "9px",
                          fontFamily: "Chakra Petch",
                          color: "var(--color-cyan-primary)"
                        }}
                      />
                      <Bar dataKey="Actual" fill="var(--color-accent-primary)" name="Input Frequency %" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Expected" fill="var(--color-amber-alert)" name="English baseline %" fillOpacity={0.25} stroke="var(--color-amber-alert)" strokeWidth={1} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </GlassPanel>

            {/* Data Table */}
            <GlassPanel className="p-5 flex-1 flex flex-col min-h-0" clipSize="md" showCornerTicks={true}>
              <div className="border-b border-border-hairline/25 pb-2 mb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-display text-xs font-black tracking-widest text-cyan-text uppercase">
                    TABULAR ANALYSIS & DEVIATIONS
                  </h3>
                  <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
                    Sort by any metric to inspect specific cipher characteristics
                  </p>
                </div>
                {inputText.trim() && (
                  <Badge variant="cyan" size="xs">
                    ACTIVE SENSOR
                  </Badge>
                )}
              </div>

              {!inputText.trim() ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-3 border border-dashed border-border-hairline/10 bg-bg-void/10 p-6 min-h-[120px]">
                  <Activity className="w-6 h-6 text-cyan-primary/20 animate-pulse" />
                  <span className="font-mono text-[12px] text-cyan-primary/60 font-black uppercase tracking-widest block">
                    AWAITING TARGET INPUT
                  </span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin max-h-[220px]">
                  <table className="w-full text-left text-[13px] font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-border-hairline/20 text-text-dim uppercase font-bold text-[12px] pb-1 select-none">
                        <th className="pb-2 text-left cursor-pointer hover:text-cyan-primary transition-colors" onClick={() => handleFreqSort("letter")}>
                          LETTER {freqSortBy === "letter" && (freqSortAsc ? "▲" : "▼")}
                        </th>
                        <th className="pb-2 text-right cursor-pointer hover:text-cyan-primary transition-colors" onClick={() => handleFreqSort("count")}>
                          COUNT {freqSortBy === "count" && (freqSortAsc ? "▲" : "▼")}
                        </th>
                        <th className="pb-2 text-right cursor-pointer hover:text-cyan-primary transition-colors" onClick={() => handleFreqSort("Actual")}>
                          ACTUAL % {freqSortBy === "Actual" && (freqSortAsc ? "▲" : "▼")}
                        </th>
                        <th className="pb-2 text-right cursor-pointer hover:text-cyan-primary transition-colors" onClick={() => handleFreqSort("Expected")}>
                          BASELINE % {freqSortBy === "Expected" && (freqSortAsc ? "▲" : "▼")}
                        </th>
                        <th className="pb-2 text-right cursor-pointer hover:text-cyan-primary transition-colors" onClick={() => handleFreqSort("deviation")}>
                          DEVIATION {freqSortBy === "deviation" && (freqSortAsc ? "▲" : "▼")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-hairline/5">
                      {sortedFrequencyData.map((row) => {
                        const hasDev = row.deviation !== 0;
                        const devColor = row.deviation > 0 
                          ? "text-cyan-text font-bold" 
                          : row.deviation < 0 
                            ? "text-amber-text" 
                            : "text-text-dim";
                        const devSign = row.deviation > 0 ? `+${row.deviation}%` : `${row.deviation}%`;

                        return (
                          <tr key={row.letter} className="hover:bg-cyan-primary/[0.03] transition-colors">
                            <td className="py-1.5 text-left font-black text-white text-[13px]">{row.letter}</td>
                            <td className="py-1.5 text-right text-text-primary">{row.count}</td>
                            <td className="py-1.5 text-right text-cyan-primary">{row.Actual}%</td>
                            <td className="py-1.5 text-right text-text-dim">{row.Expected}%</td>
                            <td className={`py-1.5 text-right ${devColor}`}>{hasDev ? devSign : "0%"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassPanel>
          </div>
        </div>
      )}

    </div>
  );
}
