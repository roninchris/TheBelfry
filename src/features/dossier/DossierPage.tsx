import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useAppStore, Case, THREAT_LEVELS, type ThreatLevel } from "../../store/appStore";
import { getKnight, type KnightId } from "../../lib/identity";
import { playPinClick, playCaseSolvedSwell, playHoverEvidence, playReticleLock, playUnpinTear } from "../../lib/soundEngine";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import IconTabs from "../../components/ui/IconTabs";
import SuspectsPanel, { SuspectPortrait, STATUS_META } from "./SuspectsPanel";
import { suppressDragImage } from "../../lib/dnd";
import { GripVertical } from "lucide-react";
import ShinyText from "../../components/react-bits/ShinyText";
import BlurText from "../../components/react-bits/BlurText";
import {
  FileText,
  Bookmark,
  Database,
  CheckCircle,
  AlertTriangle,
  Compass,
  Activity,
  Crosshair,
  Trash2,
  FolderPlus,
  Plus,
  X,
  Clock,
  ExternalLink,
  Edit,
  TrendingUp,
  Brain
} from "lucide-react";

/**
 * Threat levels escalate along the established alert ramp — cyan is nominal,
 * amber is caution, red is danger — so severity reads instantly without
 * introducing colours outside the system.
 */
const THREAT_TONE: Record<ThreatLevel, { activeClass: string; text: string; dot: string }> = {
  LOW: {
    activeClass: "border-cyan-primary/60 text-cyan-text bg-cyan-primary/15",
    text: "text-cyan-text",
    dot: "bg-cyan-primary"
  },
  MODERATE: {
    activeClass: "border-cyan-primary/60 text-cyan-text bg-cyan-primary/10",
    text: "text-cyan-primary",
    dot: "bg-cyan-primary"
  },
  HIGH: {
    activeClass: "border-amber-alert/70 text-amber-alert bg-amber-alert/15",
    text: "text-amber-alert",
    dot: "bg-amber-alert"
  },
  CRITICAL: {
    activeClass: "border-red-threat/70 text-red-threat bg-red-threat/15",
    text: "text-red-threat",
    dot: "bg-red-threat"
  }
};

/** Compact threat readout for a case card. Absent on legacy cases. */
function ThreatTag({ level }: { level?: ThreatLevel }) {
  if (!level) return null;
  const tone = THREAT_TONE[level];
  return (
    <span
      className={`flex items-center gap-1 font-mono text-[12px] font-bold tracking-wider uppercase ${tone.text}`}
      title={`Threat assessment: ${level}`}
    >
      <span
        className={`w-1.5 h-1.5 ${tone.dot} ${level === "CRITICAL" ? "animate-hex-pulse-flicker" : ""}`}
      />
      {level}
    </span>
  );
}

// Procedural high-tech hologram radar of case statistics and nodes
function CaseHologramRadar({
  nodesCount,
  connectionsCount
}: {
  nodesCount: number;
  connectionsCount: number;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Grid background */}
      <svg viewBox="0 0 200 250" className="w-full h-full text-cyan-primary">
        <defs>
          <pattern id="hologrid" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="0.15" className="opacity-15" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hologrid)" />
        
        {/* Radar circles */}
        <circle cx="100" cy="110" r="70" fill="none" stroke="currentColor" strokeWidth="0.25" className="opacity-10" />
        <circle cx="100" cy="110" r="50" fill="none" stroke="currentColor" strokeWidth="0.5" className="opacity-20" />
        <circle cx="100" cy="110" r="30" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" className="opacity-40" />
        <circle cx="100" cy="110" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" className="opacity-30" />
        
        {/* Sweep scanner line */}
        <line x1="100" y1="110" x2="165" y2="45" stroke="currentColor" strokeWidth="1" className="opacity-80 origin-[100px_110px] animate-[spin_8s_linear_infinite]" />
        
        {/* Tech crosshair coordinates */}
        <line x1="30" y1="110" x2="170" y2="110" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" className="opacity-30" />
        <line x1="100" y1="40" x2="100" y2="180" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" className="opacity-30" />

        {/* Dynamic Nodes representing evidence */}
        {nodesCount > 0 ? (
          Array.from({ length: Math.min(nodesCount, 8) }).map((_, i) => {
            const angle = (i * Math.PI * 2) / Math.min(nodesCount, 8) + 0.4;
            const radius = 25 + (i % 2 === 0 ? 15 : 30);
            const cx = 100 + Math.cos(angle) * radius;
            const cy = 110 + Math.sin(angle) * radius;
            return (
              <g key={`holo-node-${i}`} className="animate-hex-pulse-flicker">
                <circle cx={cx} cy={cy} r="3" fill="currentColor" className="text-cyan-primary shadow-[0_0_6px_currentColor]" />
                <circle cx={cx} cy={cy} r="6" fill="none" stroke="currentColor" strokeWidth="0.5" className="opacity-50" />
                {connectionsCount > 0 && i < connectionsCount && (
                  <line x1="100" y1="110" x2={cx} y2={cy} stroke="currentColor" strokeWidth="0.4" className="opacity-20" />
                )}
              </g>
            );
          })
        ) : (
          <g className="animate-hex-pulse-flicker">
            <rect x="75" y="95" width="50" height="30" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" />
            <text x="100" y="113" textAnchor="middle" className="font-display text-[12px] fill-current opacity-60">EMPTY DATABASE</text>
          </g>
        )}
      </svg>
      
      {/* Scope Reticle HUD overlays */}
      <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-cyan-primary/50" />
      <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-cyan-primary/50" />
      <div className="absolute bottom-16 left-4 w-4 h-4 border-b border-l border-cyan-primary/50" />
      <div className="absolute bottom-16 right-4 w-4 h-4 border-b border-r border-cyan-primary/50" />
      
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center space-x-1 text-[12px] font-mono tracking-widest bg-bg-void/80 px-2 py-0.5 border border-border-hairline/25 text-cyan-text">
        <Crosshair className="w-2.5 h-2.5 animate-radar-sweep" style={{ animationDuration: "15s" }} />
        <span>INTELLIGENCE_VAULT: ONLINE</span>
      </div>
    </div>
  );
}

export default function DossierPage() {
  const { 
    cases, 
    activeCaseId, 
    evidenceNodes, 
    evidenceConnections, 
    selectCase,
    addCase,
    deleteCase,
    updateCaseNotes,
    updateCaseStatus,
    updateCaseDetails,
    caseClosedAt,
    markCaseClosed,
    reorderCases,
    suspects,
    addLog
  } = useAppStore();

  // Drag state for reordering the archive list: the dragged case and the case
  // it is hovering over (the drop target). Reorder commits on drop.
  const [dragCaseId, setDragCaseId] = useState<string | null>(null);
  const [dropCaseId, setDropCaseId] = useState<string | null>(null);

  // Top-level view: the case archive, or the suspect dossiers.
  const [topTab, setTopTab] = useState<"cases" | "suspects">("cases");
  const [activeTab, setActiveTab] = useState<string>("info");

  // Back-fill: a case that was already closed before durations were tracked has
  // no recorded close time, so stamp it now — its clock freezes from here.
  useEffect(() => {
    cases.forEach((c) => {
      const closed = c.status === "SOLVED" || c.status === "ARCHIVED";
      if (closed && !caseClosedAt[c.id]) markCaseClosed(c.id, true);
    });
  }, [cases, caseClosedAt, markCaseClosed]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");
  const [newStatus, setNewStatus] = useState<Case["status"]>("ACTIVE");
  const [newThreat, setNewThreat] = useState<ThreatLevel>("MODERATE");

  /** Set when the modal is amending an existing dossier rather than opening one. */
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Auto-saving tracker text
  const [saveStatus, setSaveStatus] = useState<"SAVED" | "SAVING">("SAVED");

  // Biometric wipe transition state
  const [isVerifying, setIsVerifying] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (activeCaseId && !shouldReduceMotion) {
      setIsVerifying(true);
      const timer = setTimeout(() => setIsVerifying(false), 1200);
      return () => clearTimeout(timer);
    } else {
      setIsVerifying(false);
    }
  }, [activeCaseId, shouldReduceMotion]);

  // Get active case file details
  const activeCase = cases.find((c) => c.id === activeCaseId);

  // Display order: ACTIVE cases always float to the top, then the shared manual
  // order (Case.position), falling back to status rank + creation before any
  // reorder. Drag reorders via reorderCases (persists positions to the cloud).
  const STATUS_RANK: Record<Case["status"], number> = {
    ACTIVE: 0,
    STALLED: 1,
    SOLVED: 2,
    ARCHIVED: 3,
  };
  const isActiveTier = (c: Case) => c.status === "ACTIVE";
  const orderedCases = React.useMemo(() => {
    return [...cases].sort(
      (a, b) =>
        (isActiveTier(a) ? 0 : 1) - (isActiveTier(b) ? 0 : 1) ||
        (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
        (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [cases]);

  // Marks the drop target while dragging — but only within the same tier (a
  // non-active case can't jump above the ACTIVE group, so active stays on top).
  // The actual reorder commits on drop, so the drag stays smooth (no live churn).
  const handleCaseDragOver = (e: React.DragEvent, overId: string) => {
    if (!dragCaseId || dragCaseId === overId) return;
    const dragCase = cases.find((c) => c.id === dragCaseId);
    const overCase = cases.find((c) => c.id === overId);
    if (!dragCase || !overCase || isActiveTier(dragCase) !== isActiveTier(overCase)) return;
    e.preventDefault();
    if (dropCaseId !== overId) setDropCaseId(overId);
  };

  const commitCaseReorder = () => {
    if (dragCaseId && dropCaseId && dragCaseId !== dropCaseId) {
      const ids = orderedCases.map((c) => c.id);
      const from = ids.indexOf(dragCaseId);
      const to = ids.indexOf(dropCaseId);
      if (from !== -1 && to !== -1 && from !== to) {
        ids.splice(from, 1);
        ids.splice(to, 0, dragCaseId);
        reorderCases(ids);
      }
    }
    setDragCaseId(null);
    setDropCaseId(null);
  };


  const getStatusBadgeVariant = (status: Case["status"]) => {
    switch (status) {
      case "ACTIVE": return "green";
      case "SOLVED": return "cyan";
      case "ARCHIVED": return "dim";
      case "STALLED": return "amber";
      default: return "cyan";
    }
  };

  const dossierTabs = [
    { id: "info", icon: FileText, label: "Notes Journal" },
    { id: "clues", icon: Database, label: "Clue Registry" },
    { id: "links", icon: Compass, label: "Correlations" },
  ];

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeCase) return;
    setSaveStatus("SAVING");
    updateCaseNotes(activeCase.id, e.target.value);
    
    // Simulating auto-saving indicator tick
    const timeout = setTimeout(() => {
      setSaveStatus("SAVED");
    }, 600);
    return () => clearTimeout(timeout);
  };

  const openCreateModal = () => {
    setEditingCaseId(null);
    setNewTitle("");
    setNewSynopsis("");
    setNewStatus("ACTIVE");
    setNewThreat("MODERATE");
    setShowCreateModal(true);
  };

  const openEditModal = (c: Case) => {
    setEditingCaseId(c.id);
    setNewTitle(c.title);
    setNewSynopsis(c.synopsis);
    setNewStatus(c.status);
    setNewThreat(c.threatLevel ?? "MODERATE");
    setShowCreateModal(true);
    playPinClick();
  };

  const handleCreateCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (editingCaseId) {
      updateCaseDetails(editingCaseId, {
        title: newTitle.trim(),
        synopsis: newSynopsis.trim(),
        threatLevel: newThreat
      });
      // Status has its own action (it drives the solved chime), so it is applied
      // separately and only when it actually changed.
      const existing = cases.find((c) => c.id === editingCaseId);
      if (existing && existing.status !== newStatus) {
        updateCaseStatus(editingCaseId, newStatus);
      }
    } else {
      addCase({
        title: newTitle.trim(),
        synopsis: newSynopsis.trim(),
        status: newStatus,
        threatLevel: newThreat
      });
    }

    setShowCreateModal(false);
    setEditingCaseId(null);
    playPinClick();
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      deleteCase(deleteConfirmId);
      playUnpinTear();
      setDeleteConfirmId(null);
    }
  };

  // Compute stats
  const activeCaseNodes = activeCase ? evidenceNodes.filter(n => n.caseId === activeCase.id) : [];
  const activeCaseConnections = activeCase ? evidenceConnections.filter(c => c.caseId === activeCase.id) : [];
  // Suspects attached to this case (a suspect can span several cases).
  const caseSuspects = activeCase ? suspects.filter(s => s.caseIds?.includes(activeCase.id)) : [];

  /**
   * Investigation duration: from when the case was opened until it closed
   * (SOLVED/ARCHIVED), or until now if it is still running. A closed case's
   * clock is frozen at its close time rather than counting forever.
   */
  const getDuration = (c: Case) => {
    const endMs = caseClosedAt[c.id] ? new Date(caseClosedAt[c.id]).getTime() : Date.now();
    const elapsedMs = Math.max(0, endMs - new Date(c.createdAt).getTime());
    const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    if (days >= 1) return `${days} DAY${days === 1 ? "" : "S"}`;
    if (hours >= 1) return `${hours} HR${hours === 1 ? "" : "S"}`;
    return "TODAY";
  };

  return (
    <div className="h-full w-full p-4 flex flex-col gap-3 overflow-hidden font-chakra" id="dossier-root">

      {/* Top-level view tabs: the case archive vs the suspect dossiers. */}
      <div className="flex items-center border-b border-border-hairline/15 pb-2 shrink-0">
        <div className="flex space-x-2">
          {([["cases", "CASE FILES"], ["suspects", "SUSPECTS"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTopTab(id); playPinClick(); }}
              onMouseEnter={() => playHoverEvidence()}
              className={`px-4 py-2 text-xs font-display font-black tracking-widest transition-all ${
                topTab === id
                  ? "bg-cyan-primary/[0.08] text-cyan-text border-b-2 border-cyan-primary shadow-[0_4px_10px_-2px_rgb(var(--rgb-accent) / 0.2)]"
                  : "text-text-dim hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {topTab === "suspects" ? (
        <SuspectsPanel />
      ) : (
      <div className="grid grid-cols-12 content-start gap-4 flex-1 min-h-0 overflow-hidden">

      {/* ================= LEFT SECTION: ARG CASES INDEX ================= */}
      <div className="col-span-12 lg:col-span-4 flex flex-col space-y-4">
        <GlassPanel className="panel-console p-4 flex flex-col h-full" clipSize="md">
          
          {/* Header */}
          <div className="border-b border-border-hairline/25 pb-2 mb-4 flex justify-between items-center">
            <div>
              <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center">
                <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_var(--color-accent-primary)]" />
                <ShinyText text="SECURE CASE ARCHIVE" speed={4} />
              </h3>
              <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
                Load active investigative dossiers
              </p>
            </div>
            
            <button
              onClick={openCreateModal}
              onMouseEnter={() => playHoverEvidence()}
              className="hud-target px-2 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest flex items-center"
              style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
            >
              <Plus className="w-3 h-3 mr-1" />
              NEW CASE
            </button>
          </div>

          {/* List Layout of ARG Cases */}
          {cases.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <FolderPlus className="w-12 h-12 text-cyan-dim opacity-30 mb-2 animate-hex-pulse-flicker" />
              <p className="text-xs text-text-dim/80 font-bold tracking-widest uppercase">No Cases Indexed</p>
              <p className="text-[12px] text-text-dim/50 uppercase max-w-xs mt-1">
                Create your first case to start pinning clues and charting connections.
              </p>
            </div>
          ) : (
            <div className="space-y-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 relative hud-scroll-hidden">
              {/* Archive Indexing Sweep Animation */}
              <motion.div 
                initial={{ top: "-10%" }}
                animate={{ top: "110%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-[2px] bg-cyan-primary/20 shadow-[0_0_15px_rgb(var(--rgb-accent) / 0.4)] z-10 pointer-events-none"
              />

              <AnimatePresence mode="popLayout">
                {orderedCases.map((c, index) => {
                  const isSelected = c.id === activeCaseId;
                  const caseNodes = evidenceNodes.filter(n => n.caseId === c.id);
                  const caseConns = evidenceConnections.filter(conn => conn.caseId === c.id);

                  return (
                    <motion.div
                      layout
                      key={c.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{
                        delay: index * 0.05,
                        type: "spring",
                        stiffness: 100,
                        damping: 15
                      }}
                      draggable
                      title="Drag to reorder"
                      onDragStartCapture={(e: React.DragEvent) => { suppressDragImage(e); setDragCaseId(c.id); setDropCaseId(null); }}
                      onDragOver={(e: React.DragEvent) => handleCaseDragOver(e, c.id)}
                      onDragEndCapture={commitCaseReorder}
                      className={`hud-target relative p-3 pl-6 border select-none flex flex-col text-left group cursor-grab active:cursor-grabbing transition-all duration-300 ${
                        dropCaseId === c.id ? "ring-2 ring-cyan-primary shadow-[0_6px_24px_-4px_rgb(var(--rgb-accent)/0.5)] z-20" : ""
                      } ${dragCaseId === c.id ? "opacity-35" : ""} ${
                        isSelected
                          ? "bg-cyan-primary/[0.04] border-cyan-primary text-text-primary shadow-[0_0_10px_rgb(var(--rgb-accent) / 0.08)]"
                          : "bg-bg-void/40 border-border-hairline/15 text-text-dim hover:border-border-hairline/35 hover:text-text-primary"
                      }`}
                      style={{
                        clipPath: "polygon(0 0, 100% 0, 96% 100%, 0 100%)",
                      }}
                    >
                    {/* Drag affordance — signals the row can be reordered. */}
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-text-dim/40 group-hover:text-cyan-primary/70 transition-colors pointer-events-none">
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex justify-between items-start" onClick={() => selectCase(c.id)}>
                      <div 
                        className="cursor-pointer flex-1 mr-2"
                        onMouseEnter={() => {
                          playHoverEvidence();
                          playReticleLock();
                        }}
                      >
                        <span className="font-display text-[13px] font-extrabold tracking-widest text-cyan-text truncate uppercase block mb-1">
                          {c.title}
                        </span>
                        <p className="font-share text-[12px] leading-relaxed text-text-dim line-clamp-2 italic">
                          "{c.synopsis}"
                        </p>
                      </div>
                      
                      <div className="flex items-center shrink-0 relative z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(c);
                          }}
                          className="text-text-dim hover:text-cyan-text p-1 transition-colors"
                          title="Edit case title, synopsis and threat level"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(c.id);
                          }}
                          className="text-text-dim hover:text-red-threat p-1 transition-colors"
                          title="Delete Case"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-border-hairline/10 flex items-center justify-between" onClick={() => selectCase(c.id)}>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Badge variant={getStatusBadgeVariant(c.status)} size="xs">
                          {c.status}
                        </Badge>
                        <ThreatTag level={c.threatLevel} />
                        <CaseAuthor knightId={c.createdBy} />
                      </div>
                      <div className="font-mono text-[12px] text-text-dim flex gap-3">
                        <span>CLUES: <strong className="text-cyan-text">{caseNodes.length}</strong></span>
                        <span>LINKS: <strong className="text-cyan-text">{caseConns.length}</strong></span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              </AnimatePresence>
            </div>
          )}

          {/* Quick instructions bar */}
          <div className="border-t border-border-hairline/20 pt-3 mt-4 text-[12px] font-share text-text-dim">
            <span className="text-cyan-primary font-bold">TELEMETRY SECURE INTEL:</span> Case databases are safely synced and encrypted.
          </div>
        </GlassPanel>
      </div>

      {/* ================= RIGHT SECTION: DETAILED CASE DOSSIER VIEW ================= */}
      <div className="col-span-12 lg:col-span-8 flex flex-col h-full">
        {!activeCase ? (
          <GlassPanel className="flex-1 flex flex-col items-center justify-center p-6 text-center" clipSize="md" showScanlines={true}>
            <Brain className="w-16 h-16 text-cyan-dim opacity-40 animate-hex-pulse-flicker mb-3" />
            <h3 className="font-display text-sm font-black text-cyan-text tracking-widest uppercase">
              NO DOSSIER FOCUS CONTEXT
            </h3>
            <p className="text-[13px] font-share text-text-dim max-w-sm mt-1 leading-normal uppercase">
              Select a case dossier in the sidebar registry or create a new investigation record to begin telemetry scans.
            </p>
          </GlassPanel>
        ) : (
          <div className="flex-1 flex flex-col relative overflow-hidden group/dossier">
            {/* Biometric-style verification wipe transition overlay */}
            <AnimatePresence>
              {isVerifying && activeCase && (
                <motion.div
                  key={`wipe-${activeCase.id}`}
                  initial={{ clipPath: "inset(0 100% 0 0)" }}
                  animate={{ clipPath: "inset(0 0% 0 0)" }}
                  exit={{ clipPath: "inset(0 0 0 100%)" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 z-50 pointer-events-none bg-cyan-primary/10 backdrop-blur-[2px] flex items-center justify-center"
                >
                  <div className="border border-cyan-primary p-4 bg-bg-void/90 font-display text-xs tracking-[0.2em] text-cyan-primary shadow-[0_0_30px_rgb(var(--rgb-accent) / 0.2)]">
                    VERIFYING ACCESS...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <GlassPanel className="panel-console flex-1 flex flex-col relative overflow-hidden" clipSize="md" showScanlines={true}>
            <div className="flex flex-col md:flex-row h-full">
              
              {/* Left Portion of details (Text layout & notes editing) */}
              <div className="flex-1 p-6 flex flex-col justify-between relative z-20 md:max-w-[62%]">
                <div className="space-y-4 flex-1 flex flex-col">
                  {/* Dossier status header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <select
                        value={activeCase.status}
                        onChange={(e) => {
                          const nextStatus = e.target.value as any;
                          updateCaseStatus(activeCase.id, nextStatus);
                          if (nextStatus === "SOLVED") {
                            playCaseSolvedSwell();
                          } else {
                            playPinClick();
                          }
                        }}
                        className="bg-bg-void border border-border-hairline/30 text-cyan-text text-[12px] font-mono rounded-sm px-1.5 py-0.5 focus:outline-none focus:border-cyan-primary uppercase"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SOLVED">SOLVED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                        <option value="STALLED">STALLED</option>
                      </select>
                      <span className="font-mono text-[12px] text-text-dim tracking-wider uppercase">
                        BFRY_DB: #{activeCase.id.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 font-mono text-[12px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-primary animate-hex-pulse-flicker" />
                      <span className={saveStatus === "SAVING" ? "text-amber-alert" : "text-green-verified"}>
                        {saveStatus === "SAVING" ? "AUTO-SAVING..." : "SYNCED"}
                      </span>
                    </div>
                  </div>

                  {/* Case titles */}
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-black text-text-primary uppercase tracking-widest cyan-glow truncate max-w-sm">
                      <BlurText text={activeCase.title} delay={0.05} />
                    </h2>
                    <p className="font-share text-[13px] text-cyan-dim font-bold tracking-widest uppercase border-b border-border-hairline/25 pb-2.5">
                      CREATED: {new Date(activeCase.createdAt).toLocaleDateString()} // {caseClosedAt[activeCase.id] ? "DURATION" : "ELAPSED"}: {getDuration(activeCase)}{caseClosedAt[activeCase.id] ? " (CLOSED)" : ""}
                    </p>
                  </div>

                  {/* Suspects attached to this case. Click one to jump to the
                      Suspects roster. Attach/detach happens there. */}
                  <div className="shrink-0">
                    <span className="text-[12px] font-bold text-cyan-dim tracking-widest uppercase flex items-center mb-1.5">
                      <Crosshair className="w-3 h-3 mr-1.5" />
                      SUSPECTS {caseSuspects.length > 0 && <span className="text-cyan-text ml-1">({caseSuspects.length})</span>}
                    </span>
                    {caseSuspects.length === 0 ? (
                      <button
                        onClick={() => { setTopTab("suspects"); playPinClick(); }}
                        className="text-[12px] font-share text-text-dim/70 italic hover:text-cyan-text transition-colors"
                      >
                        — none attached · file one in the SUSPECTS tab —
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {caseSuspects.map((s) => {
                          const meta = STATUS_META[s.status];
                          return (
                            <button
                              key={s.id}
                              onClick={() => { setTopTab("suspects"); playPinClick(); }}
                              onMouseEnter={() => playHoverEvidence()}
                              title={`${s.name} · ${meta.label}`}
                              className={`flex items-center gap-1.5 pl-1 pr-2 py-1 border bg-bg-void/50 ${meta.border} hover:bg-cyan-primary/[0.06] transition-colors`}
                            >
                              <SuspectPortrait suspect={s} className="w-6 h-7 shrink-0" />
                              <span className="font-display text-[12px] font-black tracking-wider uppercase text-cyan-text truncate max-w-[120px]">{s.name}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Spec metrics bento cards */}
                  <div className="grid grid-cols-3 gap-2 py-1 font-share text-[13px] shrink-0">
                    <div className="bg-bg-void/60 border border-border-hairline/15 p-2 rounded-sm flex flex-col">
                      <span className="text-text-dim text-[12px] uppercase flex items-center mb-0.5">
                        <Clock className="w-3 h-3 mr-1 text-cyan-dim" />
                        DURATION
                      </span>
                      <span className="text-text-primary font-mono font-bold text-xs uppercase">{getDuration(activeCase)}</span>
                    </div>
                    <div className="bg-bg-void/60 border border-border-hairline/15 p-2 rounded-sm flex flex-col">
                      <span className="text-text-dim text-[12px] uppercase flex items-center mb-0.5">
                        <Database className="w-3 h-3 mr-1 text-cyan-dim" />
                        CLUES FOUND
                      </span>
                      <span className="text-text-primary font-mono font-bold text-xs uppercase">{activeCaseNodes.length} FIL</span>
                    </div>
                    <div className="bg-bg-void/60 border border-border-hairline/15 p-2 rounded-sm flex flex-col col-span-1">
                      <span className="text-text-dim text-[12px] uppercase flex items-center mb-0.5">
                        <Compass className="w-3 h-3 mr-1 text-cyan-dim" />
                        CORRELATIONS
                      </span>
                      <span className="text-cyan-text font-mono font-bold text-xs uppercase">{activeCaseConnections.length} LNK</span>
                    </div>
                  </div>

                  {/* Sub-tabs strip using the bracketed IconTabs component */}
                  <div className="flex items-center justify-between border-t border-border-hairline/15 pt-2.5 shrink-0">
                    <span className="text-[12px] font-bold text-cyan-dim tracking-widest uppercase">
                      CASE SUB-REGISTRIES:
                    </span>
                    <IconTabs tabs={dossierTabs} activeTabId={activeTab} onChange={(id) => setActiveTab(id)} />
                  </div>

                  {/* Content switching based on active subtab */}
                  <div className="bg-bg-void/40 border border-border-hairline/10 p-3 flex-1 flex flex-col min-h-[160px] max-h-[300px]">
                    {activeTab === "info" && (
                      <div className="space-y-2 flex-1 flex flex-col">
                        <div className="flex justify-between items-center">
                          <span className="font-chakra text-[12px] font-extrabold text-cyan-text uppercase tracking-widest block">
                            INVESTIGATION NOTES & JOURNAL
                          </span>
                          <span className="text-[12px] font-mono text-text-dim/60">MD JOURNAL SUPPORTED</span>
                        </div>
                        <textarea
                          placeholder="Document your breakthrough discoveries, passwords, QR codes, cipher keys, or dynamic solving logs here..."
                          value={activeCase.notes}
                          onChange={handleNotesChange}
                          className="w-full flex-1 bg-bg-void/50 border border-border-hairline/15 rounded-sm p-2 text-xs text-text-primary font-sans leading-relaxed focus:outline-none focus:border-cyan-primary resize-none scrollbar-thin"
                        />
                      </div>
                    )}

                    {activeTab === "clues" && (
                      <div className="space-y-2 flex-1 flex flex-col overflow-y-auto scrollbar-thin">
                        <span className="font-chakra text-[12px] font-extrabold text-cyan-text uppercase tracking-widest block">
                          CLUES DISCOVERED REGISTRY
                        </span>
                        {activeCaseNodes.length === 0 ? (
                          <p className="text-[12px] text-text-dim italic">No clue nodes created yet. Deploy notes or photo blocks in the Detective Board.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {activeCaseNodes.map((node) => (
                              <div key={node.id} className="flex justify-between items-center text-[12px] bg-bg-void/80 p-2 border border-border-hairline/10 rounded-sm">
                                <div className="flex flex-col">
                                  <span className="font-mono text-text-primary font-bold">{node.title}</span>
                                  <span className="text-[12px] text-text-dim font-share truncate max-w-[150px]">{node.content}</span>
                                </div>
                                <Badge variant="cyan" size="xs">{node.type}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "links" && (
                      <div className="space-y-2 flex-1 flex flex-col overflow-y-auto scrollbar-thin">
                        <span className="font-chakra text-[12px] font-extrabold text-cyan-text uppercase tracking-widest block">
                          ASSOCIATIVE CORRELATION SCHEMES
                        </span>
                        {activeCaseConnections.length === 0 ? (
                          <p className="text-[12px] text-text-dim italic">No linkages drafted yet. Link clues via right-click 'Connect to...' on the Board.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {activeCaseConnections.map((conn) => {
                              const fromNode = activeCaseNodes.find(n => n.id === conn.fromNodeId);
                              const toNode = activeCaseNodes.find(n => n.id === conn.toNodeId);
                              return (
                                <div key={conn.id} className="text-[12px] bg-bg-void/80 p-2 border border-border-hairline/10 rounded-sm flex flex-col gap-1">
                                  <div className="flex justify-between font-mono">
                                    <span className="text-cyan-dim truncate">{fromNode?.title || "CLUE A"}</span>
                                    <span className="text-text-dim/60">↔</span>
                                    <span className="text-cyan-dim truncate text-right">{toNode?.title || "CLUE B"}</span>
                                  </div>
                                  {conn.label && (
                                    <div className="bg-cyan-primary/5 border border-cyan-primary/10 px-1 py-0.5 rounded-sm text-center text-[12px] font-sans font-bold text-cyan-text uppercase">
                                      LINK: {conn.label}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detail footer panel */}
                <div className="border-t border-border-hairline/20 pt-4 mt-4 flex items-center justify-between text-[13px] font-share text-text-dim shrink-0">
                  <span className="flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-cyan-primary animate-hex-pulse-flicker" />
                    SECURE DECRYPTED METADATA STREAM
                  </span>
                  <span className="font-mono text-[12px]">BELFRY_SYS v4.95</span>
                </div>
              </div>

              {/* Right Portion of details (Radar Schematic) */}
              <div className="flex-1 min-h-[220px] md:h-full relative overflow-hidden bg-bg-void">
                <CaseHologramRadar 
                  nodesCount={activeCaseNodes.length} 
                  connectionsCount={activeCaseConnections.length} 
                />
              </div>

            </div>
          </GlassPanel>
          </div>
        )}
      </div>

      </div>
      )}

      {/* --- CREATE CASE DIALOG MODAL --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-bg-void/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <GlassPanel className="p-4 max-w-sm w-full" clipSize="md" showCornerTicks={true}>
            <div className="flex justify-between items-center border-b border-border-hairline/25 pb-2 mb-3">
              <h3 className="font-display text-[14px] font-black tracking-widest text-cyan-text flex items-center uppercase">
                {editingCaseId ? "AMEND INVESTIGATION DOSSIER" : "BOOT NEW INVESTIGATION DOSSIER"}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-dim hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">DOSSIER TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. INTERCEPTED SIGNAL ANALYSIS"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">INITIAL SYNOPSIS BRIEFING</label>
                <textarea
                  required
                  placeholder="Log the initial briefing of the investigation..."
                  rows={4}
                  value={newSynopsis}
                  onChange={(e) => setNewSynopsis(e.target.value)}
                  className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">INVESTIGATIVE DISCIPLINE STATUS</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-mono focus:outline-none focus:border-cyan-primary uppercase"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SOLVED">SOLVED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                  <option value="STALLED">STALLED</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">
                  THREAT ASSESSMENT
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {THREAT_LEVELS.map((level) => {
                    const active = newThreat === level;
                    const tone = THREAT_TONE[level];
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setNewThreat(level)}
                        onMouseEnter={() => playHoverEvidence()}
                        className={`py-1.5 font-mono text-[12px] font-bold uppercase tracking-wider border transition-all ${
                          active ? tone.activeClass : "border-border-hairline/25 text-text-dim hover:text-text-primary"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-[13px] uppercase font-bold text-text-dim hover:text-text-primary transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  onMouseEnter={() => playHoverEvidence()}
                  className="hud-target px-4 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest"
                  style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
                >
                  INITIALIZE INDEX
                </button>
              </div>
            </form>
          </GlassPanel>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-bg-void/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <GlassPanel className="p-4 max-w-sm w-full border-red-threat/50 shadow-[0_0_15px_rgb(var(--rgb-threat) / 0.25)]" clipSize="md" showCornerTicks={true}>
            <div className="flex justify-between items-center border-b border-red-threat/25 pb-2 mb-3 text-red-threat">
              <h3 className="font-display text-xs font-black tracking-widest flex items-center uppercase">
                <AlertTriangle className="w-4 h-4 mr-2 animate-hex-pulse-flicker" />
                DESTRUCTION THREAT CONFIRMATION
              </h3>
            </div>

            <p className="text-xs text-text-dim leading-relaxed mb-4 font-share uppercase">
              WARNING: You are about to wipe this case file record from Belfry servers. This operation will irrevocably destroy all associated pinned clues, data photos, and correlation lines drafted inside the Detective Board.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-[13px] uppercase font-bold text-text-dim hover:text-text-primary transition-colors"
              >
                ABORT DELETION
              </button>
              <button
                onClick={handleConfirmDelete}
                onMouseEnter={() => playHoverEvidence()}
                className="hud-target hud-target-threat px-4 py-1.5 border border-red-threat/50 text-red-threat hover:bg-red-threat hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest"
                style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
              >
                DELETE FOREVER
              </button>
            </div>
          </GlassPanel>
        </div>
      )}

    </div>
  );
}

/**
 * Who opened this case. Renders nothing for guest-authored cases, since a
 * solo local board has only one author and the mark would be pure noise.
 */
function CaseAuthor({ knightId }: { knightId?: KnightId }) {
  const knight = getKnight(knightId);
  if (!knight) return null;

  return (
    <span
      className="flex items-center gap-1 font-share text-[12px] tracking-[0.12em] uppercase whitespace-nowrap"
      title={`Case opened by ${knight.label}`}
    >
      <img
        src={knight.sigil}
        alt=""
        className="w-3.5 h-3.5 object-contain shrink-0"
        style={{
          transform: `scale(${knight.sigilScale ?? 1})`,
          filter: `drop-shadow(0 0 3px ${knight.accent}99)`,
        }}
      />
      <span className="text-text-dim">BY</span>
      <span style={{ color: knight.accent }}>{knight.label.toUpperCase()}</span>
    </span>
  );
}
