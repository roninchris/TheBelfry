import { ToolOptionsPanel } from "../../components/ui/ToolOptionsPanel";
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  Play,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  Database,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  Copy,
  Check,
  Sliders,
  Activity,
  Sparkles,
  Terminal,
  Settings,
  ShieldAlert,
  Radio,
  Cpu,
  SearchCode,
  Award,
  Info
} from "lucide-react";
import GlassPanel from "../../components/ui/GlassPanel";
import KeyspaceTunnel from "../../components/ui/KeyspaceTunnel";
import Checkbox from "../../components/ui/Checkbox";
import Badge from "../../components/ui/Badge";
import DecryptText from "../../components/ui/DecryptText";
import DataStream from "../../components/react-bits/DataStream";
import PipelineConnector from "../../components/react-bits/PipelineConnector";
import { useAppStore } from "../../store/appStore";
import { getTool, getAllTools, asResult } from "../../lib/tools/registry";
import { scoreDecodedPlaintext } from "../../lib/tools/scoring";
import { bruteForceTool, DEFAULT_WORDLIST, SWEEPABLE_TOOL_IDS } from "../../lib/tools/bruteForce";
import WordlistControl from "../../components/brute-force/WordlistControl";
import { identifyInput } from "../../lib/tools/identify";
import {
  playSuccessChime,
  playPinClick,
  playHoverEvidence,
  playHoverBlip,
  playTypeKey,
  playAddStep,
  playRemoveStep,
  playDragReorder,
  playBakeSuccess,
  playBakeFailure,
  playBruteForceMatch
} from "../../lib/soundEngine";

interface RecipeStep {
  id: string;
  toolId: string;
  type: "encode" | "decode";
  options: Record<string, any>;
}

interface BruteResult {
  label: string;
  parameter?: string;
  text: string;
  score: number;
  options?: any;
  error?: boolean;
}

// Plaintext heuristics scoring engine
// (Removed local version, now using shared module)

export default function CyberChefPipeline() {
  const {
    cases,
    activeCaseId,
    addEvidenceNode,
    addLog,
    setModule
  } = useAppStore();

  // Mode: "manual" (Chain Builder) vs "brute" (Brute Force / Auto Crack)
  const [mode, setMode] = useState<"manual" | "brute">("manual");

  // Input states
  const [inputText, setInputText] = useState<string>("");
  const [pipelineSteps, setPipelineSteps] = useState<RecipeStep[]>([]);

  const [outputText, setOutputText] = useState<string>("");
  const [intermediateResults, setIntermediateResults] = useState<string[]>([]);
  const [autoRun, setAutoRun] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<"all" | "cipher" | "encoding" | "utility">("all");
  
  // Drag and drop sorting state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Status metrics
  const [isBaking, setIsBaking] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [bakeSuccess, setBakeSuccess] = useState<boolean>(true);
  const [executionStats, setExecutionStats] = useState({
    latencyMs: 0,
    characterCount: 0,
    depth: 0,
    errorMessage: ""
  });
  const [copied, setCopied] = useState<boolean>(false);

  // ================= BRUTE FORCE STATE =================
  const [bruteSubMode, setBruteSubMode] = useState<"sweep" | "auto">("sweep");
  const [sweepCipher, setSweepCipher] = useState<string>("caesar");
  const [bruteResults, setBruteResults] = useState<BruteResult[]>([]);
  const [bruteNotes, setBruteNotes] = useState<string[]>([]);
  const [bruteFailedCount, setBruteFailedCount] = useState<number>(0);
  // Candidate registry uses progressive disclosure instead of a cramped inner scroller.
  const [showAllCandidates, setShowAllCandidates] = useState<boolean>(false);
  const CONFIDENCE_THRESHOLD = 40;
  const CANDIDATE_PREVIEW = 6;
  /**
   * Derived once at component scope rather than inside the workspace render.
   * The candidate registry now lives in the right-hand column while the gates
   * that produce it stay on the left, so both halves have to read the same
   * numbers — deriving them in either branch would guarantee they drift.
   */
  const topMatch = bruteResults.length > 0 ? bruteResults.find((r, idx) => idx === 0 && r.score > 40) : null;
  const alternativeMatches = topMatch ? bruteResults.slice(1) : bruteResults;
  const feasibleCount = bruteResults.filter(r => r.score > CONFIDENCE_THRESHOLD).length;
  const visibleAlternatives = showAllCandidates
    ? alternativeMatches
    : alternativeMatches.slice(0, CANDIDATE_PREVIEW);
  const [bruteWordlist, setBruteWordlist] = useState<string[]>(DEFAULT_WORDLIST);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  // Load all operations from the app's tool registry
  const availableTools = useMemo(() => {
    return getAllTools();
  }, []);

  // Filtered available operations
  const filteredTools = useMemo(() => {
    return availableTools.filter(tool => {
      const matchesSearch = tool.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            tool.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === "all" || tool.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [availableTools, searchQuery, activeCategory]);

  // Specific filtered lists for Ciphers vs Encodings
  const filteredCiphers = useMemo(() => {
    return filteredTools.filter(t => t.category === "cipher");
  }, [filteredTools]);

  const filteredEncodings = useMemo(() => {
    return filteredTools.filter(t => t.category === "encoding");
  }, [filteredTools]);

  // Anything that is neither a cipher nor an encoding — RSA Factorizer, Hash
  // Lab. Written as an exclusion rather than `=== "utility"` so a future
  // category cannot silently vanish from this panel the way utility did.
  const filteredUtilities = useMemo(() => {
    return filteredTools.filter(t => t.category !== "cipher" && t.category !== "encoding");
  }, [filteredTools]);

  // Execute the entire chain of recipes (Manual mode)
  const runRecipe = (currentInput: string, steps: RecipeStep[]) => {
    const startTime = performance.now();
    let currentVal = currentInput;
    let errMessage = "";
    let ok = true;
    const intermediates: string[] = [];

    try {
      for (const step of steps) {
        const tool = getTool(step.toolId);
        if (!tool) {
          throw new Error(`Tool "${step.toolId}" was not found in registry.`);
        }

        // Format options correctly depending on tool specifics
        const options: any = { ...step.options };
        if (tool.optionsSchema) {
          tool.optionsSchema.forEach(field => {
            if (options[field.name] === undefined) {
              options[field.name] = field.defaultValue;
            }
          });
        }

        const runMethod = step.type === "encode" ? tool.encode : tool.decode;
        const result = runMethod(currentVal, options);
        const parsed = asResult(result);
        currentVal = parsed.text;
        intermediates.push(currentVal);
      }
    } catch (err) {
      ok = false;
      errMessage = (err as Error).message || "An error occurred during decoding cascade.";
      currentVal = `[CHAIN ERROR]: ${errMessage}`;
    }

    const duration = parseFloat((performance.now() - startTime).toFixed(2));
    setOutputText(currentVal);
    setIntermediateResults(intermediates);
    setBakeSuccess(ok);
    setExecutionStats({
      latencyMs: duration,
      characterCount: currentVal.length,
      depth: steps.length,
      errorMessage: errMessage
    });
    return ok;
  };

  // Run recipe whenever steps or input change, if autoRun is enabled
  useEffect(() => {
    if (mode === "manual" && autoRun) {
      runRecipe(inputText, pipelineSteps);
    }
  }, [inputText, pipelineSteps, autoRun, mode]);

  // Trigger manual baking
  const handleBake = async () => {
    setIsBaking(true);
    setBakeSuccess(true);
    
    // Visually cycle through steps for "processing glow" effect
    for (let i = 0; i < pipelineSteps.length; i++) {
      setActiveStepIndex(i);
      await new Promise(r => setTimeout(r, 120));
    }
    
    const ok = runRecipe(inputText, pipelineSteps);
    setActiveStepIndex(null);
    setIsBaking(false);
    
    if (ok) {
      playBakeSuccess();
      addLog(`BAKED RECIPE PIPELINE WITH ${pipelineSteps.length} OPS`, "success", "SYS");
    } else {
      playBakeFailure();
      addLog("BAKED RECIPE COMPILATION FAULT - EXAMINE PIPELINE LAYERS", "warning", "SYS");
    }
  };

  // Add tool operation as a new recipe step - defaults to DECODE
  const addStep = (toolId: string) => {
    playAddStep();
    const tool = getTool(toolId);
    if (!tool) return;

    // Default options from schema
    const defaultOptions: any = {};
    if (tool.optionsSchema) {
      tool.optionsSchema.forEach(field => {
        defaultOptions[field.name] = field.defaultValue;
      });
    }

    const newStep: RecipeStep = {
      id: crypto.randomUUID(),
      toolId,
      type: "decode", // Default to DECODE direction
      options: defaultOptions
    };

    setPipelineSteps([...pipelineSteps, newStep]);
    addLog(`ADDED RECIPE OPERATION: ${tool.label.toUpperCase()}`, "info", "SYS");
  };

  // Remove a step from the recipe
  const removeStep = (id: string) => {
    playRemoveStep();
    const targetStep = pipelineSteps.find(s => s.id === id);
    const label = targetStep ? getTool(targetStep.toolId)?.label : "operation";
    setPipelineSteps(pipelineSteps.filter(s => s.id !== id));
    addLog(`REMOVED RECIPE OPERATION: ${label?.toUpperCase()}`, "warning", "SYS");
  };

  // Update step options
  const updateStepOption = (id: string, optionKey: string, value: any) => {
    setPipelineSteps(pipelineSteps.map(step => {
      if (step.id === id) {
        return {
          ...step,
          options: {
            ...step.options,
            [optionKey]: value
          }
        };
      }
      return step;
    }));
  };

  // Copy output
  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    playPinClick();
    setTimeout(() => setCopied(false), 2000);
  };

  // HTML5 Drag and Drop Handlers for Reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDropStep = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const reorderedSteps = [...pipelineSteps];
    const [draggedItem] = reorderedSteps.splice(draggedIndex, 1);
    reorderedSteps.splice(targetIndex, 0, draggedItem);

    setPipelineSteps(reorderedSteps);
    setDraggedIndex(null);
    setDragOverIndex(null);
    playDragReorder();
    addLog("REORDERED RECIPE DECIPHER SEQUENCE", "info", "SYS");
  };

  // Move steps manually with arrows
  const moveStep = (index: number, direction: "up" | "down") => {
    playDragReorder();
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= pipelineSteps.length) return;

    const reorderedSteps = [...pipelineSteps];
    const temp = reorderedSteps[index];
    reorderedSteps[index] = reorderedSteps[nextIndex];
    reorderedSteps[nextIndex] = temp;

    setPipelineSteps(reorderedSteps);
  };

  // Discharge / clear whole pipeline
  const clearPipeline = () => {
    playPinClick();
    setPipelineSteps([]);
    setOutputText("");
    addLog("DISCHARGED PIPELINE DECRYPTION RECIPE CONTAINER", "warning", "SYS");
  };

  // Dossier Export Report
  const handleExportToDossier = () => {
    const caseId = activeCaseId || (cases[0]?.id || "");
    if (!caseId) {
      addLog("CANNOT COMPLY: NO ACTIVE CASE TARGET SELECTED IN DOSSIER", "warning", "SYS");
      return;
    }

    playPinClick();

    const stepsReport = pipelineSteps.map((step, idx) => {
      const tool = getTool(step.toolId);
      const optStr = JSON.stringify(step.options);
      return `${idx + 1}. [${step.type.toUpperCase()}] ${tool?.label} with config: ${optStr}`;
    }).join("\n");

    const fullReport = `### MULTI-STEP RECIPE PIPELINE DECODE REPORT
**PIPELINE CHAIN LENGTH**: ${pipelineSteps.length} layers
**EXECUTION LATENCY**: ${executionStats.latencyMs} ms
**STATUS**: ${bakeSuccess ? "INTEGRITY SEAL CLEAR" : "DECRYPTION CASCADE ERROR"}

#### ENTRANCE INPUT BUFFER:
\`\`\`
${inputText}
\`\`\`

#### PIPELINE DECRYPTION RECIPE:
${stepsReport || "(Empty recipe)"}

#### TERMINAL ESCAPE OUTPUT BUFFER:
\`\`\`
${outputText}
\`\`\`

**CONCLUSION**:
Custom chain processing successfully compiled. Extracted and formatted coordinates and hashes have been indexed to forensic memory bounds.`;

    addEvidenceNode({
      type: "text",
      title: `RECIPE PIPELINE DUMP: ${pipelineSteps.length} STACK`,
      content: fullReport,
      x: 130 + Math.random() * 150,
      y: 130 + Math.random() * 150
    });

    addLog("COMPLETED DECRYPTION STREAM BAKE - EXPORTED RECORD TO CASE DOSSIER", "success", "SYS");
    setModule("detective-board");
  };

  // ================= BRUTE FORCE & AUTO CRACK CALCULATORS =================
  const executeBruteCrack = (inputVal: string, subMode: "sweep" | "auto", cipherId: string) => {
    if (!inputVal) {
      setBruteResults([]);
      setBruteNotes([]);
      setBruteFailedCount(0);
      return;
    }

    let resultsList: BruteResult[] = [];
    let notes: string[] = [];
    let failedCount = 0;

    if (subMode === "sweep") {
      const outcome = bruteForceTool(cipherId, inputVal, bruteWordlist);
      resultsList = outcome.results.map(c => ({
        label: c.label,
        parameter: c.parameter,
        text: c.output,
        score: c.score,
        options: c.options
      }));
      notes = outcome.notes;
      failedCount = outcome.failedCount;
    } else {
      /**
       * "Try everything" mode.
       *
       * This used to call every decoder exactly once with its default options,
       * with a hardcoded `opts.shift = 7` for Caesar. That meant auto-crack
       * could only ever solve a Caesar whose shift happened to be 7, and the
       * same blind spot applied to every other parameterised cipher — the mode
       * named "try everything" was in fact trying one arbitrary configuration
       * each. Anything the brute forcer knows how to sweep is now swept
       * properly, and only its best few candidates are kept so one cipher
       * cannot flood the registry.
       */
      const allTools = getAllTools();
      const KEEP_PER_SWEEP = 3;

      for (const t of allTools) {
        if ((SWEEPABLE_TOOL_IDS as readonly string[]).includes(t.id)) {
          const outcome = bruteForceTool(t.id, inputVal, bruteWordlist);
          failedCount += outcome.failedCount;
          notes.push(...outcome.notes);
          outcome.results
            .slice()
            .sort((a, b) => b.score - a.score)
            .slice(0, KEEP_PER_SWEEP)
            .forEach(c => {
              resultsList.push({
                label: t.label,
                parameter: c.parameter,
                text: c.output,
                score: c.score,
                options: c.options
              });
            });
          continue;
        }

        try {
          const opts: any = {};
          if (t.optionsSchema) {
            t.optionsSchema.forEach(field => {
              opts[field.name] = field.defaultValue;
            });
          }

          const res = t.decode(inputVal, opts);
          const outText = asResult(res).text;

          // Avoid adding trivially unmodified inputs for encodings like base64
          if (outText === inputVal && (t.id === "base64" || t.id === "hex" || t.id === "binary")) {
            continue;
          }

          resultsList.push({
            label: t.label,
            parameter: JSON.stringify(opts) === "{}" ? undefined : "Default config",
            text: outText,
            score: scoreDecodedPlaintext(outText),
            options: opts
          });
        } catch (e) {
          failedCount++;
        }
      }
    }

    /**
     * Fold the identifier's opinion into the ranking.
     *
     * Plaintext scoring alone is blind to *what the input looked like*: a
     * decoder that happens to emit vowel-rich noise could outrank the cipher the
     * identifier had already recognised from the input's own signature. Since
     * both halves are now reliable, the ranking uses both — a candidate whose
     * tool the identifier flagged is promoted in proportion to that confidence,
     * so the auto-cracker and the identifier stop disagreeing on screen.
     */
    const signals = new Map<string, number>();
    for (const r of identifyInput(inputVal)) {
      if (r.confidence > 0.4) signals.set(r.toolId, r.confidence);
    }

    const toolIdFor = (label: string) =>
      getAllTools().find(t => t.label === label)?.id ?? "";

    const ranked = resultsList.map(r => {
      const conf = signals.get(toolIdFor(r.label)) ?? 0;
      // Capped so a strong identification nudges ordering without letting a
      // recognised-but-wrong key beat a candidate that actually reads as English.
      return { ...r, score: Math.min(100, r.score + Math.round(conf * 25)) };
    });

    // Sort descending by plausibility score
    const sorted = ranked.sort((a, b) => b.score - a.score);
    setBruteResults(sorted);
    setBruteNotes(notes);
    setBruteFailedCount(failedCount);
    return sorted;
  };

  // Launch simulated HUD scan animation
  const triggerBruteScan = (inputVal: string, subMode: "sweep" | "auto", cipherId: string) => {
    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([]);
    playSuccessChime();

    const logSteps = [
      { text: `[SYS] CORRELATING PLAIN-TEXT MATRICES ON STREAM (${inputVal.length} B)...`, progress: 15 },
      { text: `[SYS] ANALYZING COGNITIVE PLAUSIBILITY WEIGHTS...`, progress: 38 },
      { text: subMode === "sweep" 
          ? `[SYS] RUNNING BOUNDED PARAMETER SWEEP OVER CIPHER: ${cipherId.toUpperCase()}...` 
          : `[SYS] INTERROGATING ALL ${getAllTools().length} REGISTERED DATA DECODERS...`, progress: 65 },
      { text: `[SYS] FILTERING INTERFERENCE AND ISOLATING NOISE VECTORS...`, progress: 85 },
      { text: `[SYS] COMPLETED: ISOLATED HIGHEST PROBABILITY SEALS.`, progress: 100 }
    ];

    logSteps.forEach((step, idx) => {
      setTimeout(() => {
        setScanLogs(prev => [...prev, step.text]);
        setScanProgress(step.progress);
        if (step.progress === 100) {
          const sorted = executeBruteCrack(inputVal, subMode, cipherId);
          setIsScanning(false);
          if (sorted && sorted.length > 0 && sorted[0].score > 40) {
            playBruteForceMatch();
          } else {
            playSuccessChime();
          }
        }
      }, (idx + 1) * 150);
    });
  };

  // Dump top Brute Force Match into Detective Dossier
  const handleBruteExportToDossier = (result: BruteResult) => {
    const caseId = activeCaseId || (cases[0]?.id || "");
    if (!caseId) {
      addLog("CANNOT COMPLY: NO ACTIVE CASE TARGET SELECTED IN DOSSIER", "warning", "SYS");
      return;
    }

    playPinClick();

    const fullReport = `### COGNITIVE DECRYPTION MATRIX MATCH DUMP
**PLAUSIBILITY MATCH RATING**: ${result.score}%
**ISOLATED LAYER TECHNIQUE**: ${result.label}
**DECODER CONFIGURATION**: ${result.parameter || "No parameters"}

#### RAW CIPHERTEXT STREAM:
\`\`\`
${inputText}
\`\`\`

#### DEDUCED ESCAPE PLAUSIBILITY PLAINTEXT:
\`\`\`
${result.text}
\`\`\`

**CONCLUSION**:
Simultaneous parameter sweeping successfully breached the encryption boundary. Decrypted data vectors have been index-mapped to active case board.`;

    addEvidenceNode({
      type: "text",
      title: `AUTO-BREACH MATCH: ${result.label}`,
      content: fullReport,
      x: 140 + Math.random() * 140,
      y: 140 + Math.random() * 140
    });

    addLog("BREACH REPORT GENERATED AND DUMPED TO DOSSIER", "success", "SYS");
    setModule("detective-board");
  };

  // Sub-component renderer for sidebar tools
  /**
   * A registry row. The whole row is the control.
   *
   * It used to be an inert <div> whose only way to add an operation was a ~22px
   * unlabelled "+" icon at the far right, with cursor:auto on the row itself —
   * so clicking the operation, which is the obvious affordance, did nothing and
   * the pipeline looked broken. The "+" is now decoration; the row is a button.
   */
  const renderToolItem = (tool: typeof availableTools[0]) => (
    <button
      key={tool.id}
      type="button"
      onClick={() => addStep(tool.id)}
      onMouseEnter={() => playHoverBlip()}
      title={`Add ${tool.label} to the pipeline`}
      className="hud-target w-full text-left cursor-pointer flex items-center justify-between p-2 border border-border-hairline/10 bg-bg-void/45 hover:border-cyan-primary/40 hover:bg-cyan-primary/[0.04] transition-all group select-none"
    >
      <div className="min-w-0 flex-1 pr-2">
        <h4 className="font-mono text-[13px] font-bold text-text-primary group-hover:text-cyan-text transition-colors uppercase truncate">
          {tool.label}
        </h4>
        <span className="text-[12px] font-mono text-text-dim uppercase tracking-wider block mt-0.5">
          ID: {tool.id}
        </span>
      </div>

      <div className="flex items-center space-x-2 shrink-0">
        <Badge variant={tool.category === "cipher" ? "amber" : "cyan"} size="xs">
          {tool.category}
        </Badge>
        <span
          aria-hidden="true"
          className="p-1 bg-bg-void border border-border-hairline/15 text-cyan-primary group-hover:text-bg-void group-hover:bg-cyan-primary transition-all flex items-center justify-center"
        >
          <Plus className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  );

  // Row sizing is explicit. Auto rows in a grid taller than its content get
  // stretched by align-content, which silently inflated the header row from its
  // natural 104px to 240px — 136px of dead space above the mode switcher, and
  // the same again around the workspace. The header now takes what it needs and
  // the workspace claims the rest.
  return (
    <div className="h-full w-full p-4 grid grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)_auto] content-start gap-4 overflow-hidden font-chakra text-text-primary animate-fade-in" id="cyberchef-pipeline-root">
      
      {/* ================= HEADER SECTION (SPAN 12) ================= */}
      <div className="col-span-12 flex flex-col space-y-3">
        
        {/* Header Ribbon Info */}
        <GlassPanel className="p-4 flex flex-col justify-between" clipSize="sm" showCornerTicks={true}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-4 bg-cyan-primary transform -skew-x-12 inline-block shadow-[0_0_8px_var(--color-accent-primary)]" />
                <h1 className="font-display text-sm font-black tracking-widest text-cyan-text uppercase">
                  FORENSIC DECRYPTION CORES
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={mode === "manual" ? "cyan" : "amber"} size="xs" className="animate-hex-pulse-flicker">
                {mode === "manual" ? "CHAIN RECOVERY MODE" : "BRUTE SCAN CORE"}
              </Badge>
            </div>
          </div>
        </GlassPanel>

      </div>

      {/* ================= LEFT SECTION: ACTIVE TOOL / WORKSPACE ================= */}
      <div className="col-span-12 lg:col-span-8 flex flex-col space-y-4 min-h-0">
        
        {/* Unified conveyor layout replaces former separate input rows */}
        {/* Mode switcher, directly above the workspace it controls. It used to
            sit at the bottom of the left-hand column, one column away from the
            content it switches. */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { playPinClick(); setMode("manual"); }}
            onMouseEnter={() => playHoverBlip()}
            className={`tablet-btn hud-target py-2.5 text-[13px] flex items-center justify-center space-x-2 ${mode === "manual" ? "tablet-active" : ""}`}
            style={{ "--frame-color": "var(--color-accent-primary)" } as React.CSSProperties}
            aria-pressed={mode === "manual"}
          >
            <Sliders className="w-4 h-4" />
            <span>Manual cascade</span>
          </button>

          <button
            onClick={() => { playPinClick(); setMode("brute"); }}
            onMouseEnter={() => playHoverBlip()}
            className={`tablet-btn hud-target py-2.5 text-[13px] flex items-center justify-center space-x-2 ${mode === "brute" ? "tablet-active" : ""}`}
            style={{ "--frame-color": "var(--color-amber-alert)" } as React.CSSProperties}
            aria-pressed={mode === "brute"}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Brute force</span>
          </button>
        </div>


        {/* MANUAL WORKSPACE LAYOUT (Steps List) */}
        {mode === "manual" && (
          <GlassPanel className="p-4 flex-1 flex flex-col min-h-0" contentClassName="flex flex-col" clipSize="md">
            <div className="border-b border-border-hairline/20 pb-2 mb-4 flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-cyan-primary animate-hex-pulse-flicker" />
                <h3 className="font-display text-xs font-black tracking-widest text-cyan-text uppercase">
                  ACTIVE RECIPE PIPELINE STACK
                </h3>
              </div>
              
              <div className="flex items-center space-x-3.5 flex-wrap gap-2">
                {/* Auto Run Toggle */}
                <Checkbox 
                  label="Auto-Bake Cascade"
                  checked={autoRun}
                  onChange={(e) => {
                    setAutoRun(e.target.checked);
                    playPinClick();
                  }}
                />

                {/* Clear Pipeline */}
                {pipelineSteps.length > 0 && (
                  <button
                    onClick={clearPipeline}
                    className="tablet-btn hud-target px-2 py-1.5 text-[12px]" style={{ "--frame-color": "var(--color-red-threat)", color: "var(--color-red-threat)", borderColor: "rgb(var(--rgb-threat) / 0.45)" } as React.CSSProperties}
                  >
                    Clear Recipe
                  </button>
                )}

                {/* Bake Now Button */}
                <button
                  onClick={handleBake}
                  disabled={isBaking || pipelineSteps.length === 0}
                  className="tablet-btn hud-target px-3 py-1.5 text-[13px] disabled:opacity-30 disabled:pointer-events-none flex items-center space-x-1.5"
                  style={{ "--frame-color": "var(--color-accent-primary)" } as React.CSSProperties}
                >
                  <RefreshCw className={`w-3 h-3 ${isBaking ? "animate-radar-sweep" : ""}`} />
                  <span>BAKE PIPELINE</span>
                </button>
              </div>
            </div>

            {/* The conveyor always renders, including with an empty recipe.
                Previously an empty recipe replaced this whole region with a
                placeholder — which also removed the input textarea, so on
                arrival there was nowhere to paste anything and BAKE had nothing
                to act on. The empty state is now a card inside the chain. */}
            {(
              // Horizontal Conveyor Assembly Line
              <div className="relative flex-1 flex flex-col justify-start gap-3 min-h-0">

                {/* ===== SEQUENCE PROGRESS RAIL — the "flow" identity for a chain of ops ===== */}
                <div className="relative z-10 mb-3 flex items-center gap-0.5 overflow-x-auto scrollbar-none pb-1.5 border-b border-border-hairline/10">
                  {(() => {
                    // Node state helper: idle | active | done | error
                    const nodeCls = (state: string, danger = false) =>
                      state === "active"
                        ? "border-cyan-primary text-cyan-text bg-cyan-primary/15 shadow-[0_0_10px_rgb(var(--rgb-accent) / 0.4)] animate-pulse"
                        : state === "done"
                        ? danger
                          ? "border-red-threat/60 text-red-threat bg-red-threat/10"
                          : "border-green-verified/60 text-green-verified bg-green-verified/10"
                        : "border-border-hairline/25 text-text-dim/60 bg-bg-void/40";
                    const conn = (filled: boolean) =>
                      `h-[2px] w-5 shrink-0 transition-colors duration-300 ${filled ? "bg-cyan-primary/70 shadow-[0_0_5px_var(--color-accent-primary)]" : "bg-border-hairline/20"}`;
                    const nodes: React.ReactNode[] = [];
                    const inState = inputText.trim() ? "done" : "idle";
                    nodes.push(
                      <div key="in" className={`shrink-0 flex items-center justify-center w-8 h-8 border font-mono text-[12px] font-black tracking-wider transition-all duration-300 ${nodeCls(inState)}`} style={{ clipPath: "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)" }} title="Input stream">IN</div>
                    );
                    pipelineSteps.forEach((step, i) => {
                      const state =
                        activeStepIndex === i ? "active" : intermediateResults[i] !== undefined ? "done" : "idle";
                      const prevDone = i === 0 ? !!inputText.trim() : intermediateResults[i - 1] !== undefined;
                      nodes.push(<div key={`c${i}`} className={conn(prevDone || activeStepIndex === i)} />);
                      nodes.push(
                        <div
                          key={step.id}
                          className={`shrink-0 flex flex-col items-center justify-center w-9 h-8 border font-mono text-[12px] font-black tracking-wider transition-all duration-300 ${nodeCls(state)}`}
                          style={{ clipPath: "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)" }}
                          title={getTool(step.toolId)?.label || step.toolId}
                        >
                          L{i + 1}
                        </div>
                      );
                    });
                    const outState = outputText ? (bakeSuccess ? "done" : "done") : "idle";
                    nodes.push(<div key="cout" className={conn(!!outputText)} />);
                    nodes.push(
                      <div key="out" className={`shrink-0 flex items-center justify-center w-8 h-8 border font-mono text-[12px] font-black tracking-wider transition-all duration-300 ${nodeCls(outState, !bakeSuccess && !!outputText)}`} style={{ clipPath: "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)" }} title="Output">OUT</div>
                    );
                    return (
                      <>
                        {nodes}
                        <span className="ml-auto pl-3 font-share text-[12px] tracking-widest uppercase text-text-dim/70 shrink-0">
                          {isBaking ? (
                            <span className="text-cyan-text animate-pulse">EXECUTING {activeStepIndex !== null ? `L${activeStepIndex + 1}` : "…"}</span>
                          ) : outputText ? (
                            bakeSuccess ? <span className="text-green-verified">SEQUENCE RESOLVED</span> : <span className="text-red-threat">CASCADE FAULT</span>
                          ) : (
                            <span>{pipelineSteps.length} OPS · STANDBY</span>
                          )}
                        </span>
                      </>
                    );
                  })()}
                </div>

                {/* The rail is a band, not a column. Letting it take the whole
                    panel stretched three sparse cards into ~660px towers; a
                    chain reads left-to-right, so it gets a fixed comfortable
                    height and the trace below uses the rest. */}
                <div className="relative z-10 h-[380px] shrink-0 overflow-x-auto pb-4 scrollbar-thin flex items-stretch gap-2 px-1">

                  {/* GATE 1: INPUT VESSEL CARD */}
                  <div className="flex-1 min-w-[250px] flex items-stretch">
                    <GlassPanel className="p-4 flex flex-col w-full h-full justify-between" contentClassName="flex flex-col min-h-0" clipSize="sm" showCornerTicks={true}>
                      <div className="border-b border-border-hairline/20 pb-2 mb-3 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="w-1.5 h-3 bg-cyan-primary inline-block transform -skew-x-12" />
                          <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-text uppercase">
                            INPUT STREAM VESSEL
                          </h3>
                        </div>
                        <span className="font-mono text-[12px] text-text-dim">
                          {inputText.length} BYTES
                        </span>
                      </div>
                      <textarea
                        value={inputText}
                        onChange={(e) => {
                          setInputText(e.target.value);
                          playTypeKey();
                        }}
                        placeholder="Inject raw ciphertext or plaintext vectors to pass through the stack..."
                        className="w-full flex-1 min-h-[140px] p-2 bg-bg-void/70 border border-border-hairline/15 text-xs text-text-primary placeholder:text-text-dim/40 font-mono focus:outline-none focus:border-cyan-primary/50 resize-none select-text"
                      />
                    </GlassPanel>
                  </div>

                  {/* EMPTY SLOT — stands in for the first operation so the
                      chain still reads as input -> ? -> output. */}
                  {pipelineSteps.length === 0 && (
                    <>
                      <div className="flex items-center shrink-0 self-center px-1">
                        <PipelineConnector orientation="horizontal" active={false} className="w-8" />
                      </div>
                      <div className="flex-1 min-w-[250px] flex items-stretch">
                        {/* A slot in the chain, so it gets the same panel material
                            as the vessels either side of it. It was a bare dashed
                            block, which read as an unstyled gap rather than a
                            placeholder for a stage. */}
                        <GlassPanel
                          className="p-6 w-full h-full border-dashed"
                          contentClassName="flex flex-col items-center justify-center text-center"
                          clipSize="sm"
                          showCornerTicks={false}
                        >
                          <Terminal className="w-9 h-9 text-cyan-primary/25 animate-hex-pulse-flicker mb-2.5" />
                          <h4 className="font-display text-sm font-extrabold tracking-[0.18em] text-white uppercase">
                            No operations yet
                          </h4>
                          <p className="text-[12px] text-text-dim/80 font-share tracking-wide mt-1.5 leading-relaxed max-w-[24ch]">
                            Pick an operation from the registry on the right. Each one you
                            add becomes a stage here, and the text above flows through them
                            left to right into the output.
                          </p>
                        </GlassPanel>
                      </div>
                    </>
                  )}

                  {/* STEP CARDS IN CHAIN */}
                  {pipelineSteps.map((step, index) => {
                    const tool = getTool(step.toolId);
                    const isDragging = index === draggedIndex;
                    const isOver = index === dragOverIndex;
                    const isProcessing = activeStepIndex === index;
                    const hasResult = intermediateResults[index] !== undefined;

                    if (!tool) return null;

                    return (
                      <React.Fragment key={step.id}>
                        {/* Visual Horizontal Connector */}
                        <div className="flex items-center shrink-0 self-center px-1">
                          <PipelineConnector 
                            orientation="horizontal"
                            active={isBaking && (activeStepIndex === null || activeStepIndex >= index)} 
                            className="w-8"
                          />
                        </div>

                        <motion.div
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDropStep(e, index)}
                          className="w-[300px] shrink-0 flex flex-col justify-between"
                        >
                          <GlassPanel 
                            clipSize="sm" 
                            showCornerTicks={true} 
                            className={`p-3 flex flex-col h-full justify-between transition-all duration-300 ${
                              isProcessing 
                                ? "shadow-[0_0_25px_rgb(var(--rgb-accent) / 0.15)] border-cyan-primary/50 bg-cyan-primary/[0.03]" 
                                : ""
                            } ${
                              isDragging 
                                ? "opacity-30 border-dashed border-cyan-primary bg-bg-void" 
                                : isOver 
                                  ? "border-cyan-primary bg-cyan-primary/[0.03] scale-[0.99]" 
                                  : "bg-bg-void/60 border-border-hairline/15 hover:border-cyan-primary/30"
                            }`}
                          >
                            {/* Step Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-hairline/10 pb-2 mb-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <div className="cursor-grab active:cursor-grabbing p-1 hover:text-cyan-primary text-text-dim/60 transition-colors shrink-0">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-mono text-[12px] text-cyan-primary font-bold shrink-0 uppercase">
                                  L-{index + 1}
                                </span>
                                <h4 className={`font-display text-[13px] font-black tracking-widest uppercase truncate transition-colors ${isProcessing ? "text-cyan-text" : "text-white"}`}>
                                  {tool.label}
                                </h4>
                              </div>

                              <div className="flex items-center space-x-1.5 shrink-0">
                                <button
                                  onClick={() => removeStep(step.id)}
                                  className="p-1 hover:text-red-threat text-text-dim transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* DEC/ENC Toggle */}
                            <div className="mb-2.5 flex items-center justify-between">
                              <Badge variant={tool.category === "cipher" ? "amber" : "cyan"} size="xs">
                                {tool.category}
                              </Badge>
                              <div className="flex bg-bg-void border border-border-hairline/25 rounded-none overflow-hidden shrink-0">
                                <button
                                  onClick={() => {
                                    playPinClick();
                                    setPipelineSteps(pipelineSteps.map(s => s.id === step.id ? { ...s, type: "decode" } : s));
                                  }}
                                  className={`px-2 py-0.5 text-[12px] font-mono font-black uppercase tracking-widest transition-all ${
                                    step.type === "decode"
                                      ? "bg-red-threat/15 text-red-threat border-r border-red-threat/25 font-bold shadow-[inset_0_0_8px_rgba(239,68,68,0.25)]"
                                      : "text-text-dim hover:text-text-primary"
                                  }`}
                                >
                                  DEC
                                </button>
                                <button
                                  onClick={() => {
                                    playPinClick();
                                    setPipelineSteps(pipelineSteps.map(s => s.id === step.id ? { ...s, type: "encode" } : s));
                                  }}
                                  className={`px-2 py-0.5 text-[12px] font-mono font-black uppercase tracking-widest transition-all ${
                                    step.type === "encode"
                                      ? "bg-cyan-primary/15 text-cyan-text border-l border-cyan-primary/25 font-bold shadow-[inset_0_0_8px_rgb(var(--rgb-accent) / 0.25)]"
                                      : "text-text-dim hover:text-text-primary"
                                  }`}
                                >
                                  ENC
                                </button>
                              </div>
                            </div>

                            {/* Options Parameter Editing */}
                            <div className="flex-1 min-h-[48px] flex flex-col justify-center">
                              <ToolOptionsPanel 
                                optionsSchema={tool.optionsSchema}
                                options={step.options}
                                onChange={(key, value) => updateStepOption(step.id, key, value)}
                                variant="compact"
                              />
                            </div>

                            {/* LAYER OUTPUT PREVIEW */}
                            <div className="mt-2.5 pt-2 border-t border-border-hairline/10">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[12px] font-mono text-text-dim uppercase tracking-widest">
                                  LAYER OUTPUT BUFFER
                                </span>
                              </div>
                              {/* Fixed two-line preview — clamped, never a 36px scroll viewport */}
                              <div className={`bg-bg-void/40 p-1.5 border min-h-[36px] flex items-start transition-colors duration-500 overflow-hidden ${
                                isProcessing ? "border-cyan-primary/30 bg-cyan-primary/5" : "border-border-hairline/10"
                              }`}>
                                {hasResult ? (
                                  <div className="line-clamp-2 break-all w-full" title={intermediateResults[index]}>
                                    <DataStream
                                      text={intermediateResults[index]}
                                      active={isProcessing || (isBaking && activeStepIndex === null)}
                                      className={`text-[12px] font-mono transition-colors duration-500 break-all select-text ${isProcessing ? "text-cyan-text" : "text-green-verified/70"}`}
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[12px] font-mono text-text-dim/30 italic">Awaiting bake...</span>
                                )}
                              </div>
                            </div>
                          </GlassPanel>
                        </motion.div>
                      </React.Fragment>
                    );
                  })}

                  {/* VISUAL CONNECTOR TO OUTPUT */}
                  <div className="flex items-center shrink-0 self-center px-1">
                    <PipelineConnector 
                      orientation="horizontal"
                      active={bakeSuccess} 
                      className="w-8"
                    />
                  </div>

                  {/* GATE 4: OUTPUT VESSEL CARD */}
                  <div className="flex-1 min-w-[250px] flex items-stretch">
                    <GlassPanel className="p-4 flex flex-col w-full h-full justify-between" contentClassName="flex flex-col min-h-0" clipSize="sm" showCornerTicks={true}>
                      <div className="border-b border-border-hairline/20 pb-2 mb-3 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="w-1.5 h-3 bg-green-verified inline-block transform -skew-x-12" />
                          <h3 className="font-display text-[13px] font-black tracking-widest text-green-verified uppercase flex items-center">
                            OUTPUT GATE VESSEL
                            {!bakeSuccess && <AlertCircle className="w-3.5 h-3.5 text-red-threat ml-2 animate-hex-pulse-flicker" />}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-1.5 text-[12px] font-mono text-text-dim">
                          <span>{executionStats.depth} OPS</span>
                          <span className="text-cyan-primary font-bold">{executionStats.latencyMs}ms</span>
                        </div>
                      </div>

                      <div className="relative flex-1 min-h-[140px] flex flex-col justify-between">
                        {outputText ? (
                          <div
                            className={`w-full flex-1 p-2 bg-bg-void/50 border text-xs font-mono overflow-y-auto select-text scrollbar-thin ${
                              bakeSuccess 
                                ? "border-border-hairline/15 text-green-verified" 
                                : "border-red-threat/30 bg-red-threat/[0.02] text-red-threat"
                            }`}
                          >
                            <DecryptText text={outputText} trigger={outputText} />
                          </div>
                        ) : (
                          <textarea
                            readOnly
                            placeholder="Awaiting pipeline baking..."
                            className="w-full flex-1 p-2 bg-bg-void/50 border border-border-hairline/15 text-xs font-mono resize-none focus:outline-none text-text-dim/60"
                          />
                        )}
                        <button
                          onClick={handleCopy}
                          disabled={!outputText}
                          className="absolute bottom-2 right-2 p-1.5 bg-bg-void border border-border-hairline/25 hover:border-cyan-primary text-text-dim hover:text-cyan-text transition-colors disabled:opacity-50"
                          title="Copy output buffer"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-green-verified" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </GlassPanel>
                  </div>

                </div>

                {/* ===== STAGE TRACE =====
                    What the text actually looks like after each operation. The
                    per-stage results were already computed for the step cards
                    but only ever shown as a clipped two-line preview inside
                    them, so following a chain meant reading across cards. Here
                    the whole cascade reads down one column. */}
                <div className="flex-1 min-h-0 flex flex-col border border-border-hairline/15 bg-bg-void/30">
                  <div className="shrink-0 flex items-center justify-between px-2.5 py-1.5 border-b border-border-hairline/15">
                    <span className="font-display text-[12px] font-black tracking-widest text-cyan-text/80 uppercase flex items-center">
                      <Activity className="w-3 h-3 mr-1.5 text-cyan-primary/70" />
                      STAGE TRACE
                    </span>
                    <span className="font-mono text-[12px] text-text-dim/60 tracking-widest uppercase">
                      {pipelineSteps.length === 0
                        ? "NO STAGES"
                        : `${pipelineSteps.length} STAGE${pipelineSteps.length === 1 ? "" : "S"}`}
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin font-mono text-[12px] divide-y divide-border-hairline/10">
                    {/* Stage 0 is the raw buffer, so the trace starts where the
                        operator's text starts rather than after the first op. */}
                    <div className="flex items-start gap-2.5 px-2.5 py-1.5">
                      <span className="text-text-dim/50 shrink-0 w-6">00</span>
                      <span className="text-cyan-text/80 shrink-0 w-24 truncate uppercase">input</span>
                      <span className="text-text-primary/90 truncate select-text">
                        {inputText || <span className="text-text-dim/40">empty buffer</span>}
                      </span>
                    </div>

                    {pipelineSteps.map((step, idx) => {
                      const tool = getTool(step.toolId);
                      const value = intermediateResults[idx];
                      const isActive = activeStepIndex === idx;
                      return (
                        <div
                          key={step.id}
                          className={`flex items-start gap-2.5 px-2.5 py-1.5 transition-colors ${
                            isActive ? "bg-cyan-primary/[0.07]" : "hover:bg-cyan-primary/[0.02]"
                          }`}
                        >
                          <span className="text-text-dim/50 shrink-0 w-6">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="text-cyan-text/80 shrink-0 w-24 truncate uppercase">
                            {tool?.label ?? step.toolId}
                          </span>
                          <span className="text-text-primary/90 truncate select-text">
                            {value !== undefined && value !== ""
                              ? value
                              : <span className="text-text-dim/40">not baked yet</span>}
                          </span>
                        </div>
                      );
                    })}

                    {pipelineSteps.length === 0 && (
                      <div className="px-2.5 py-3 text-text-dim/50 uppercase tracking-wider">
                        Add an operation and each stage's output will appear here in order.
                      </div>
                    )}
                  </div>
                </div>

                {/* Dossier database reporting row */}
                <div className="shrink-0 mt-3 pt-3 border-t border-border-hairline/15 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                  <span className="text-[12px] text-text-dim font-share uppercase tracking-widest flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-1 text-cyan-primary animate-hex-pulse-flicker" />
                    FLOW MONITOR: {bakeSuccess ? "STATUS ALIGNED" : "CASCADE COMPILATION FAULT"}
                  </span>

                  <button
                    onClick={handleExportToDossier}
                    disabled={pipelineSteps.length === 0 || !bakeSuccess}
                    className="px-3 py-1.5 border border-cyan-primary/25 hover:border-cyan-primary text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-all duration-150 text-[13px] uppercase font-black tracking-widest flex items-center space-x-1.5"
                    style={{ clipPath: "polygon(0 0, 100% 0, 94% 100%, 0 100%)" }}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>DUMP PIPELINE REPORT</span>
                  </button>
                </div>
              </div>
            )}
          </GlassPanel>
        )}

        {/* ================= BRUTE FORCE WORKSPACE LAYOUT ================= */}
        {mode === "brute" && (() => {
          return (
            <GlassPanel className="p-4 flex-1 flex flex-col min-h-[500px]" contentClassName="flex flex-col" clipSize="md">
              
              {/* Brute Mode Config Header */}
              <div className="border-b border-border-hairline/20 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-amber-alert animate-spin-slow" />
                  <h3 className="font-display text-xs font-black tracking-widest text-amber-text uppercase">
                    BRUTE CRACK MATRIX ARRAY
                  </h3>
                </div>

                {/* Sub Mode Selection Tabs */}
                <div className="flex bg-bg-void border border-border-hairline/20 p-0.5 rounded-none overflow-hidden select-none">
                  <button
                    onClick={() => {
                      playPinClick();
                      setBruteSubMode("sweep");
                    }}
                    className={`px-3 py-1 text-[12px] font-display font-bold uppercase tracking-widest transition-all ${
                      bruteSubMode === "sweep"
                        ? "bg-amber-alert/15 text-amber-text font-black shadow-[inset_0_0_8px_rgba(245,158,11,0.25)]"
                        : "text-text-dim hover:text-white"
                    }`}
                  >
                    Cipher Parameter Sweep
                  </button>
                  <button
                    onClick={() => {
                      playPinClick();
                      setBruteSubMode("auto");
                    }}
                    className={`px-3 py-1 text-[12px] font-display font-bold uppercase tracking-widest transition-all ${
                      bruteSubMode === "auto"
                        ? "bg-amber-alert/15 text-amber-text font-black shadow-[inset_0_0_8px_rgba(245,158,11,0.25)]"
                        : "text-text-dim hover:text-white"
                    }`}
                  >
                    "Try Everything" Auto-Crack
                  </button>
                </div>
              </div>

              {/* 3-GATE HORIZONTAL ASSEMBLY CONVEYOR BELT */}
              {/* Fixed band, same reasoning as the manual rail: three gates
                  stretched to full height were mostly void. */}
              <div className="h-[380px] shrink-0 overflow-x-auto pb-4 scrollbar-thin flex items-stretch gap-2 px-1">
                
                {/* GATE 1: INTELLIGENCE STREAM SOURCE & CONFIG */}
                <div className="flex-1 min-w-[250px] flex items-stretch">
                  <GlassPanel className="p-3.5 flex flex-col w-full h-full justify-between" contentClassName="flex flex-col min-h-0" clipSize="sm" showCornerTicks={true}>
                    <div className="border-b border-border-hairline/20 pb-1.5 mb-2.5 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-3 bg-amber-alert inline-block transform -skew-x-12" />
                        <h3 className="font-display text-[13px] font-black tracking-widest text-amber-text uppercase">
                          GATE 1: STREAM SOURCE
                        </h3>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <button
                          onClick={() => {
                            playPinClick();
                            if (!inputText.trim()) return;
                            const candidates = identifyInput(inputText);
                            const bestKnown = candidates.find(c => getTool(c.toolId));
                            if (bestKnown) {
                              setBruteSubMode("sweep");
                              setSweepCipher(bestKnown.toolId);
                              addLog(`AUTO-IDENTIFY SUGGESTS: ${bestKnown.toolId.toUpperCase()} (${Math.round(bestKnown.confidence * 100)}%)`, "success", "D-HEURISTICS");
                            } else {
                              addLog("AUTO-IDENTIFY: NO SPECIFIC ENGINE MATCHED — TRY MANUAL SWEEP TARGETS", "warning", "D-HEURISTICS");
                            }
                          }}
                          className="text-[12px] text-cyan-text hover:underline font-mono uppercase flex items-center space-x-1"
                          title="Run forensic pattern/entropy analysis on the input to suggest a sweep target"
                        >
                          <SearchCode className="w-3 h-3" />
                          <span>Auto-Identify</span>
                        </button>
                        <button
                          onClick={() => {
                            setInputText("");
                            setBruteResults([]);
                            playPinClick();
                          }}
                          className="text-[12px] text-red-threat hover:underline font-mono uppercase"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Source Input Text Area */}
                    <textarea
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        playTypeKey();
                      }}
                      placeholder="Paste encrypted datastream intercepts or encoded codes here..."
                      className="w-full flex-1 min-h-[90px] p-2 bg-bg-void/70 border border-border-hairline/15 text-xs text-text-primary placeholder:text-text-dim/30 font-mono focus:outline-none focus:border-amber-alert/50 resize-none select-text"
                    />

                    {/* Wordlist for specific tools */}
                    {bruteSubMode === "sweep" && ["vigenere", "playfair", "bifid", "trifid"].includes(sweepCipher) && (
                      <div className="mt-2">
                        <WordlistControl onWordlistChange={setBruteWordlist} />
                      </div>
                    )}

                    {/* Config Settings inside Gate 1 */}
                    <div className="mt-2.5 pt-2 border-t border-border-hairline/10">
                      {bruteSubMode === "sweep" ? (
                        <div className="flex flex-col space-y-1.5">
                          <span className="text-[12px] font-mono text-text-dim uppercase font-bold">
                            SELECT SWEEP BOUNDS TARGET:
                          </span>
                          <div className="grid grid-cols-2 gap-1 font-mono text-[12px]">
                            {[
                              { id: "caesar", label: "CAESAR" },
                              { id: "railfence", label: "RAIL DEPTH" },
                              { id: "xor", label: "XOR" },
                              { id: "atbash", label: "ATBASH" },
                              { id: "vigenere", label: "VIGENERE" },
                              { id: "hill", label: "HILL 2x2" },
                              { id: "playfair", label: "PLAYFAIR" },
                              { id: "bifid", label: "BIFID" },
                              { id: "trifid", label: "TRIFID" }
                            ].map((chip) => (
                              <button
                                key={chip.id}
                                onClick={() => {
                                  playPinClick();
                                  setSweepCipher(chip.id);
                                }}
                                className={`px-1.5 py-0.5 border uppercase tracking-wider transition-colors font-bold truncate ${
                                  sweepCipher === chip.id
                                    ? "bg-amber-alert/10 border-amber-alert text-amber-text"
                                    : "bg-bg-void/30 border-border-hairline/10 hover:border-amber-alert/40 text-text-dim"
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-center">
                          <span className="text-[12px] font-mono text-amber-alert/70 uppercase font-black tracking-widest block">
                            CRACK VECTOR: ALL MATRIX PLUGINS
                          </span>
                        </div>
                      )}
                    </div>
                  </GlassPanel>
                </div>

                {/* CONNECTOR GATE 1 -&gt; GATE 2 */}
                <div className="flex items-center shrink-0 self-center px-1">
                  <PipelineConnector 
                    orientation="horizontal"
                    active={isScanning || bruteResults.length > 0} 
                    className="w-8"
                  />
                </div>

                {/* GATE 2: SWEEP & DECRYPTION MATRIX CORE */}
                <div className="flex-1 min-w-[250px] flex items-stretch">
                  <GlassPanel className="p-3.5 flex flex-col w-full h-full justify-between" contentClassName="flex flex-col min-h-0" clipSize="sm" showCornerTicks={true}>
                    <div className="border-b border-border-hairline/20 pb-1.5 mb-2.5 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-3 bg-amber-alert inline-block transform -skew-x-12 animate-hex-pulse-flicker" />
                        <h3 className="font-display text-[13px] font-black tracking-widest text-amber-text uppercase">
                          GATE 2: MATRIX CORE
                        </h3>
                      </div>
                      <Badge variant="amber" size="xs" className="h-4">
                        {isScanning ? "SWEEPING" : "STATIONARY"}
                      </Badge>
                    </div>

                    {/* Interactive Scan Crack Controls & Statuses inside Gate 2 */}
                    {isScanning ? (
                      <div className="flex-1 flex flex-col">
                        {/* Radar Spinner & Progress */}
                        <div className="flex items-center space-x-3 bg-bg-void/40 border border-border-hairline/10 p-2">
                          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                            <div className="absolute inset-0 border border-dashed border-amber-alert rounded-full animate-radar-sweep" />
                            <Cpu className="w-4 h-4 text-amber-alert animate-hex-pulse-flicker" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-display text-[12px] font-black tracking-widest text-amber-text uppercase block truncate animate-hex-pulse-flicker">
                              ANALYZING ENTROPY
                            </span>
                            <div className="w-full bg-bg-void border border-border-hairline/25 h-1.5 p-0.5 mt-1">
                              <div 
                                className="h-full bg-gradient-to-r from-amber-alert to-amber-text transition-all duration-150" 
                                style={{ width: `${scanProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* The log itself lives in the SWEEP LOG band below the
                            gates now, so it outlives the run instead of being
                            destroyed with this branch the moment results land. */}
                      </div>
                    ) : (
                      // Grouped, not justify-between: spreading three items down a
                      // ~700px card left the trigger stranded in the middle with a
                      // void above and below it. The brief and its button belong
                      // together, and the heuristics note reads as a footer.
                      <div className="flex-1 flex flex-col min-h-0">
                        <span className="text-[12px] font-mono text-text-dim uppercase tracking-wider block leading-relaxed mb-2">
                          {bruteSubMode === "sweep"
                            ? `Sweeping ${sweepCipher.toUpperCase()} configurations to isolate plain english output vectors.`
                            : `Testing raw intercepts against forensic plugins simultaneously.`}
                        </span>

                        <button
                          onClick={() => triggerBruteScan(inputText, bruteSubMode, sweepCipher)}
                          disabled={isScanning || !inputText}
                          className="w-full py-2 bg-amber-alert hover:bg-white text-bg-void transition-all duration-150 text-[13px] font-black tracking-widest font-display uppercase disabled:opacity-35 flex items-center justify-center space-x-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                          style={{ clipPath: "polygon(0 0, 100% 0, 93% 100%, 0 100%)" }}
                        >
                          <SearchCode className="w-3.5 h-3.5" />
                          <span>INITIATE CRACK</span>
                        </button>

                        {/* Heuristic tip — mt-auto parks it at the bottom as a
                            footer instead of it floating mid-card. */}
                        <div className="mt-auto pt-2.5 p-1.5 border border-border-hairline/10 bg-bg-void/40 text-left font-share uppercase tracking-wider text-[12px] text-text-dim/80 leading-normal">
                          <span className="font-mono text-amber-alert font-bold block mb-0.5">HEURISTICS SEALED</span>
                          Evaluates whitespace, vowels, and core vocabulary frequencies.
                        </div>
                      </div>
                    )}
                  </GlassPanel>
                </div>

                {/* CONNECTOR GATE 2 -&gt; GATE 3 */}
                <div className="flex items-center shrink-0 self-center px-1">
                  <PipelineConnector 
                    orientation="horizontal"
                    active={bruteResults.length > 0} 
                    className="w-8"
                  />
                </div>

                {/* GATE 3: TOP MATCH PLAUSIBILITY TERMINATION */}
                <div className="flex-1 min-w-[250px] flex items-stretch">
                  <GlassPanel className="p-3.5 flex flex-col w-full h-full justify-between" contentClassName="flex flex-col min-h-0" clipSize="sm" showCornerTicks={true}>
                    <div className="border-b border-border-hairline/20 pb-1.5 mb-2.5 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-3 bg-green-verified inline-block transform -skew-x-12" />
                        <h3 className="font-display text-[13px] font-black tracking-widest text-green-verified uppercase">
                          GATE 3: TERMINAL MATCH
                        </h3>
                      </div>
                      <Badge variant={topMatch ? "green" : "cyan"} size="xs">
                        {topMatch ? "FOUND" : "EMPTY"}
                      </Badge>
                    </div>

                    {isScanning ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-3 border border-dashed border-border-hairline/10 bg-bg-void/25">
                        <Cpu className="w-8 h-8 text-cyan-primary/20 animate-radar-sweep mb-1.5" />
                        <span className="font-display text-[12px] font-black tracking-widest text-text-dim uppercase">
                          AWAITING MATCH CORE
                        </span>
                      </div>
                    ) : topMatch ? (
                      <div className="flex-1 flex flex-col justify-between">
                        {/* Header details */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[12px] text-green-verified font-bold uppercase truncate max-w-[150px]">
                            {topMatch.label}
                          </span>
                          <span className="font-mono text-[12px] text-green-verified font-bold">
                            {topMatch.score}% MATCH
                          </span>
                        </div>

                        {/* Text Output Block. min-h-[250px] was taller than the
                            room a gate card actually has now that the rail is a
                            fixed band, so it pushed the action row past the card
                            edge and the buttons were clipped out of view. It
                            shrinks with the card and scrolls instead. */}
                        <div className="flex-1 min-h-0 mb-2">
                          <div className="w-full h-full p-2 bg-bg-void/60 border border-green-verified/35 text-xs font-mono overflow-y-auto select-text text-green-verified font-bold shadow-[inset_0_0_8px_rgba(34,197,94,0.05)] scrollbar-thin">
                            <DecryptText text={topMatch.text} trigger={topMatch.text} />
                          </div>
                        </div>

                        {/* Core Match Buttons */}
                        <div className="shrink-0 grid grid-cols-3 gap-1 pt-1.5 border-t border-border-hairline/10">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(topMatch.text);
                              playPinClick();
                              addLog(`COPIED RESULT VECTOR: ${topMatch.label.toUpperCase()}`, "success", "SYS");
                            }}
                            className="py-1 border border-border-hairline/15 hover:border-cyan-primary text-text-dim hover:text-cyan-text text-[12px] font-mono uppercase truncate"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              playPinClick();
                              setInputText(topMatch.text);
                              addLog(`FED BRUTE MATCH INTO MASTER INPUT VESSEL`, "info", "SYS");
                            }}
                            className="py-1 border border-border-hairline/15 hover:border-amber-alert text-text-dim hover:text-amber-text text-[12px] font-mono uppercase truncate"
                          >
                            Use Raw
                          </button>
                          <button
                            onClick={() => handleBruteExportToDossier(topMatch)}
                            className="py-1 bg-cyan-primary/10 hover:bg-cyan-primary hover:text-bg-void border border-cyan-primary/25 text-cyan-text text-[12px] font-mono uppercase font-bold truncate"
                          >
                            Dossier
                          </button>
                        </div>
                      </div>
                    ) : bruteResults.length > 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-3 border border-dashed border-red-threat/20 bg-red-threat/[0.01]">
                        <ShieldAlert className="w-8 h-8 text-red-threat/20 mb-1 animate-hex-pulse-flicker" />
                        <span className="font-display text-[12px] font-black tracking-widest text-red-threat uppercase block">
                          NO PLAUSIBLE TOP MATCH
                        </span>
                        <span className="text-[12px] font-mono text-text-dim uppercase mt-1 leading-normal">
                          All sweeps scoring &lt; 40%. Review low scores below.
                        </span>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-3 border border-dashed border-border-hairline/10 bg-bg-void/25">
                        <Terminal className="w-8 h-8 text-text-dim/20 mb-1.5" />
                        <span className="font-display text-[12px] font-black tracking-widest text-text-dim uppercase">
                          VESSEL IDLE
                        </span>
                      </div>
                    )}
                  </GlassPanel>
                </div>

              </div>

              {/* ===== SWEEP LOG =====
                  The run's own commentary. It used to live inside Gate 2, which
                  meant it only existed while scanning and vanished the moment
                  results arrived, taking the record of what was tried with it.
                  Out here it survives the run and fills the band the gates gave
                  back. */}
              <div className="flex-1 min-h-0 mt-3 flex flex-col border border-border-hairline/15 bg-bg-void/30">
                <div className="shrink-0 flex items-center justify-between px-2.5 py-1.5 border-b border-border-hairline/15">
                  <span className="font-display text-[12px] font-black tracking-widest text-amber-text/80 uppercase flex items-center">
                    <Radio className={`w-3 h-3 mr-1.5 text-amber-alert/70 ${isScanning ? "animate-hex-pulse-flicker" : ""}`} />
                    SWEEP LOG
                  </span>
                  <span className="font-mono text-[12px] text-text-dim/60 tracking-widest uppercase">
                    {isScanning
                      ? `${scanProgress}% · RUNNING`
                      : scanLogs.length > 0
                        ? `${scanLogs.length} ENTRIES`
                        : "IDLE"}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin font-mono text-[12px] px-2.5 py-1.5 space-y-0.5 text-amber-text/80 select-text">
                  {scanLogs.length === 0 && !isScanning ? (
                    <div className="text-text-dim/50 uppercase tracking-wider py-1.5">
                      Run a sweep and each attempt will be recorded here.
                    </div>
                  ) : (
                    <>
                      {scanLogs.map((logLine, idx) => (
                        <div key={idx} className="truncate">{logLine}</div>
                      ))}
                      {isScanning && (
                        <div className="animate-hex-pulse-flicker flex items-center text-cyan-text font-bold">
                          <span>&gt; INTERROGATING MATRIX...</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Informational banners: multi-byte XOR estimates, truncated search notices — never ranked "answers" */}
              {bruteNotes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {bruteNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-2 p-2 border border-amber-alert/25 bg-amber-alert/[0.04] text-[12px] font-mono text-amber-text/90"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-alert" />
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Failed-decode transparency indicator */}
              {bruteFailedCount > 0 && (
                <div className="mt-1.5 text-[12px] font-mono text-text-dim/60 uppercase tracking-wider">
                  {bruteFailedCount} candidate{bruteFailedCount === 1 ? "" : "s"} failed to decode and were skipped
                </div>
              )}

            </GlassPanel>
          );
        })()}

      </div>

      {/* ================= RIGHT SECTION: OPERATIONS / PRESETS (SPAN 4) ================= */}
      <div className="col-span-12 lg:col-span-4 flex flex-col space-y-4 min-h-0 overflow-y-auto scrollbar-thin">
        
        {mode === "manual" ? (
          <>
            {/* Searchable / Browsable Registry of available tools */}
            <GlassPanel className="p-4 flex-1 flex flex-col min-h-[350px]" contentClassName="flex flex-col min-h-0" clipSize="sm">
              <div className="border-b border-border-hairline/20 pb-2 mb-3">
                <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                  <Plus className="w-4 h-4 mr-1.5 text-cyan-primary" />
                  TOOL REGISTRY INDEX
                </h3>
                <p className="text-[12px] text-text-dim uppercase tracking-wider font-share mt-0.5">
                  Select and insert operations to extend pipeline parameters
                </p>
              </div>

              {/* Search Box */}
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Search registry entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bg-void/60 border border-border-hairline/15 pl-8 pr-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-dim/30 font-mono focus:outline-none focus:border-cyan-primary/45"
                />
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-text-dim/40" />
              </div>

              {/* Category Tabs */}
              <div className="grid grid-cols-4 gap-1.5 mb-3.5 font-mono text-[12px] text-center">
                {["all", "cipher", "encoding", "utility"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      playPinClick();
                      setActiveCategory(cat as any);
                    }}
                    className={`py-1 border uppercase tracking-wider transition-colors ${
                      activeCategory === cat
                        ? "bg-cyan-primary/[0.04] border-cyan-primary text-cyan-text font-bold"
                        : "bg-bg-void/25 border-border-hairline/10 hover:border-cyan-primary/30 text-text-dim"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Scrollable list of operations */}
              {/* Fills the panel. max-h-[350px] capped this list inside an 834px
                  panel, so the registry stopped after ~5 entries and left the
                  rest of the column blank. */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 hud-scrollbar">
                {filteredTools.length === 0 ? (
                  <div className="py-12 text-center text-[13px] text-text-dim uppercase font-mono">
                    No matching tools index.
                  </div>
                ) : activeCategory === "all" ? (
                  <>
                    {/* Ciphers group */}
                    {filteredCiphers.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        <div className="flex items-center space-x-2 border-b border-border-hairline/10 pb-1 mb-2">
                          <span className="w-1.5 h-3 bg-amber-alert inline-block transform -skew-x-12" />
                          <span className="font-display text-[12px] font-black tracking-widest text-amber-alert uppercase">
                            CRYPTO-CIPHER RECIPES
                          </span>
                        </div>
                        {filteredCiphers.map(tool => renderToolItem(tool))}
                      </div>
                    )}
                    
                    {/* Encodings group */}
                    {filteredEncodings.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 border-b border-border-hairline/10 pb-1 mb-2">
                          <span className="w-1.5 h-3 bg-cyan-primary inline-block transform -skew-x-12" />
                          <span className="font-display text-[12px] font-black tracking-widest text-cyan-text uppercase">
                            DATA-ENCODING SCHEMES
                          </span>
                        </div>
                        {filteredEncodings.map(tool => renderToolItem(tool))}
                      </div>
                    )}

                    {/* Utilities group. RSA Factorizer and Hash Lab have always
                        been implemented and registered, but this panel only ever
                        rendered the cipher and encoding lists, so the whole
                        utility category was unreachable here — including under
                        "ALL". */}
                    {filteredUtilities.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 border-b border-border-hairline/10 pb-1 mb-2">
                          <span className="w-1.5 h-3 bg-green-verified inline-block transform -skew-x-12" />
                          <span className="font-display text-[12px] font-black tracking-widest text-green-verified uppercase">
                            FORENSIC UTILITIES
                          </span>
                        </div>
                        {filteredUtilities.map(tool => renderToolItem(tool))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1.5">
                    {filteredTools.map(tool => renderToolItem(tool))}
                  </div>
                )}
              </div>
            </GlassPanel>
          </>
        ) : (
          /* Brute Force Modes Sidebar presets & heuristic notes */
          <>
            {/* ===== CANDIDATE REGISTRY =====
                Moved out of the workspace panel on the left, where it was
                stacked under the three gate cards and competing with them for
                height while this column sat empty. A ranked list belongs in the
                tall narrow column, and it leaves the left half to the gates
                that produce it. One card per row here rather than the old two,
                since the column is ~409px wide. */}
            {bruteResults.length > 0 && alternativeMatches.length > 0 && (
              <GlassPanel className="p-4 flex flex-col min-h-0" contentClassName="flex flex-col min-h-0" clipSize="sm">
                <div className="shrink-0 flex items-center justify-between border-b border-border-hairline/15 pb-1.5 mb-2.5 gap-3">
                  <span className="text-[12px] font-mono text-text-dim uppercase tracking-wider truncate">
                    CANDIDATE REGISTRY — {alternativeMatches.length} EVALUATED
                    {bruteFailedCount > 0 && ` · ${bruteFailedCount} SKIPPED`}
                  </span>
                  <Badge variant={feasibleCount > 0 ? "green" : "dim"} size="xs">
                    {feasibleCount > 0
                      ? `${feasibleCount} ABOVE ${CONFIDENCE_THRESHOLD}%`
                      : `NONE ABOVE ${CONFIDENCE_THRESHOLD}%`}
                  </Badge>
                </div>

                <div className="min-h-0 overflow-y-auto scrollbar-thin grid grid-cols-1 gap-2 pr-1">
                  {visibleAlternatives.map((result, idx) => {
                    const rank = (topMatch ? idx + 2 : idx + 1);
                    const plausible = result.score > CONFIDENCE_THRESHOLD;
                    return (
                      <div
                        key={idx}
                        className="hud-target hud-target-amber bg-bg-void/40 border border-border-hairline/10 p-2.5 flex flex-col justify-between hover:border-amber-alert/25 hover:bg-bg-void/75 transition-all"
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <span className="font-mono text-[12px] text-text-dim/60 shrink-0">#{rank}</span>
                            <span className="font-mono text-[12px] text-amber-text font-black truncate">{result.label}</span>
                            {result.parameter && (
                              <Badge variant="cyan" size="xs" className="px-1 py-0 font-mono text-[12px] shrink-0">
                                {result.parameter}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-10 h-1 bg-bg-void border border-border-hairline/15 overflow-hidden">
                              <div
                                className={`h-full ${plausible ? "bg-green-verified" : "bg-amber-alert/50"}`}
                                style={{ width: `${Math.max(2, Math.min(100, result.score))}%` }}
                              />
                            </div>
                            <span className={`font-mono text-[12px] ${plausible ? "text-green-verified" : "text-text-dim/60"}`}>
                              {result.score}%
                            </span>
                          </div>
                        </div>

                        <div className="bg-bg-void/50 p-1.5 border border-border-hairline/5 font-mono text-[12px] text-text-dim/95 mb-2 truncate select-text">
                          {result.text}
                        </div>

                        <div className="flex justify-end space-x-1.5 text-[12px] font-mono border-t border-border-hairline/5 pt-1.5">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(result.text);
                              playPinClick();
                              addLog(`COPIED RESULT: ${result.label}`, "success", "SYS");
                            }}
                            className="hover:text-cyan-text text-text-dim uppercase transition-colors"
                          >
                            Copy
                          </button>
                          <span className="text-border-hairline/30">|</span>
                          <button
                            onClick={() => {
                              setInputText(result.text);
                              playPinClick();
                              addLog(`FED ALTERNATIVE MATCH INTO INPUT`, "info", "SYS");
                            }}
                            className="hover:text-amber-text text-text-dim uppercase transition-colors"
                          >
                            Use as Input
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {alternativeMatches.length > CANDIDATE_PREVIEW && (
                  <button
                    onClick={() => {
                      setShowAllCandidates(v => !v);
                      playPinClick();
                    }}
                    onMouseEnter={() => playHoverEvidence()}
                    className="hud-target shrink-0 mt-2 self-center px-3 py-1 border border-border-hairline/20 bg-bg-void/40 hover:border-amber-alert/50 hover:text-amber-text text-text-dim text-[12px] font-mono uppercase tracking-widest transition-all"
                  >
                    {showAllCandidates
                      ? `Collapse — showing all ${alternativeMatches.length}`
                      : `Show all ${alternativeMatches.length} candidates`}
                  </button>
                )}
              </GlassPanel>
            )}

            {/* Heuristics Intelligence Core Panel */}
            <GlassPanel className="p-4" clipSize="sm">
              <div className="border-b border-border-hairline/20 pb-2 mb-3">
                <h3 className="font-display text-[13px] font-black tracking-widest text-cyan-text uppercase">
                  INTELLIGENCE COHESION HEURISTICS
                </h3>
              </div>
              <ul className="space-y-2 text-[12px] font-share uppercase tracking-wider text-text-dim leading-relaxed">
                <li className="flex items-start">
                  <span className="text-amber-alert mr-1.5">•</span>
                  <span><strong>Spaces Ratio</strong>: Standard readable streams correlate closely with 12%-18% space characters.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-amber-alert mr-1.5">•</span>
                  <span><strong>Vowel Distribution</strong>: English plaintext contains 35%-45% vowels inside alphabetic strings.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-amber-alert mr-1.5">•</span>
                  <span><strong>Dictionary Weights</strong>: Scores candidates against common plaintext terms (the, and, coords, codes).</span>
                </li>
              </ul>
            </GlassPanel>

            {/* Ambient fill for the run-not-started state. Once a sweep produces
                candidates the registry above claims this height instead, so the
                decoration never competes with real results. */}
            {bruteResults.length === 0 && (
              <GlassPanel className="p-4 flex-1 flex flex-col min-h-[180px] relative overflow-hidden" contentClassName="flex flex-col" clipSize="sm">
                <div className="absolute inset-0 bg-grid-pattern opacity-[0.04] pointer-events-none" />
                <div className="shrink-0 flex items-center justify-between border-b border-border-hairline/20 pb-2 mb-2">
                  <span className="font-display text-[13px] font-black tracking-widest text-cyan-text/70 uppercase flex items-center">
                    <span className="w-1.5 h-1.5 bg-amber-alert mr-2 inline-block animate-ping-cyan" />
                    KEYSPACE FIELD
                  </span>
                  <span className="font-mono text-[12px] text-text-dim/50 tracking-widest uppercase">
                    Idle
                  </span>
                </div>
                <div className="flex-1 min-h-0 pointer-events-none">
                  <KeyspaceTunnel />
                </div>
              </GlassPanel>
            )}
          </>
        )}

      </div>

      {/* ================= FOOTER: ORIENTATION STRIP =================
          The explanation used to be a three-line paragraph in the header ribbon,
          which pushed the whole workspace down before the operator reached a
          single control. Condensed to one line and moved out of the way. */}
      <div className="col-span-12 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-void/40 border border-border-hairline/15 font-share text-[12px] text-text-dim/70 uppercase tracking-wider">
          <Info className="w-3.5 h-3.5 text-cyan-primary/50 shrink-0" />
          <span className="truncate">
            Chain operations so each one feeds the next — or switch to brute force to try many keys at once.
          </span>
        </div>
      </div>

    </div>
  );
}
