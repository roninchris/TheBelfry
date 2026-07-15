import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useAppStore, Case } from "../../store/appStore";
import { playPinClick, playCaseSolvedSwell, playHoverEvidence, playReticleLock, playUnpinTear } from "../../lib/soundEngine";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import IconTabs from "../../components/ui/IconTabs";
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
            <text x="100" y="113" textAnchor="middle" className="font-orbitron text-[10px] fill-current opacity-60">EMPTY DATABASE</text>
          </g>
        )}
      </svg>
      
      {/* Scope Reticle HUD overlays */}
      <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-cyan-primary/50" />
      <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-cyan-primary/50" />
      <div className="absolute bottom-16 left-4 w-4 h-4 border-b border-l border-cyan-primary/50" />
      <div className="absolute bottom-16 right-4 w-4 h-4 border-b border-r border-cyan-primary/50" />
      
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center space-x-1 text-[10px] font-mono tracking-widest bg-bg-void/80 px-2 py-0.5 border border-border-hairline/25 text-cyan-text">
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
    addLog
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<string>("info");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSynopsis, setNewSynopsis] = useState("");
  const [newStatus, setNewStatus] = useState<Case["status"]>("ACTIVE");

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

  const getStatusBadgeVariant = (status: Case["status"]) => {
    switch (status) {
      case "ACTIVE": return "cyan";
      case "SOLVED": return "green";
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

  const handleCreateCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addCase({
      title: newTitle.trim(),
      synopsis: newSynopsis.trim(),
      status: newStatus
    });
    setNewTitle("");
    setNewSynopsis("");
    setNewStatus("ACTIVE");
    setShowCreateModal(false);
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

  const getDaysElapsed = (createdAt: string) => {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    return elapsedDays === 0 ? "TODAY" : `${elapsedDays} DAYS`;
  };

  return (
    <div className="h-full w-full p-4 grid grid-cols-12 gap-4 overflow-y-auto font-chakra" id="dossier-root">
      
      {/* ================= LEFT SECTION: ARG CASES INDEX ================= */}
      <div className="col-span-12 lg:col-span-4 flex flex-col space-y-4">
        <GlassPanel className="p-4 flex flex-col h-full" clipSize="md">
          
          {/* Header */}
          <div className="border-b border-border-hairline/25 pb-2 mb-4 flex justify-between items-center">
            <div>
              <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center">
                <span className="w-1.5 h-3 bg-cyan-primary mr-2 transform -skew-x-12 inline-block shadow-[0_0_6px_#2ff1e4]" />
                <ShinyText text="SECURE CASE ARCHIVE" speed={4} />
              </h3>
              <p className="text-[10.5px] font-share text-text-dim tracking-wide uppercase mt-0.5">
                Load active investigative dossiers
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-2 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[10.5px] font-black uppercase tracking-widest flex items-center"
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
              <p className="text-[10.5px] text-text-dim/50 uppercase max-w-xs mt-1">
                Create your first ARG case dossier to start pinning clues and charting connections.
              </p>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 relative">
              {/* Archive Indexing Sweep Animation */}
              <motion.div 
                initial={{ top: "-10%" }}
                animate={{ top: "110%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-[2px] bg-cyan-primary/20 shadow-[0_0_15px_rgba(47,241,228,0.4)] z-10 pointer-events-none"
              />

              <AnimatePresence mode="popLayout">
                {cases.map((c, index) => {
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
                      className={`relative p-3 border transition-all duration-300 flex flex-col text-left group ${
                        isSelected
                          ? "bg-cyan-primary/[0.04] border-cyan-primary text-text-primary shadow-[0_0_10px_rgba(0,243,255,0.08)]"
                          : "bg-bg-void/40 border-border-hairline/15 text-text-dim hover:border-border-hairline/35 hover:text-text-primary"
                      }`}
                      style={{
                        clipPath: "polygon(0 0, 100% 0, 96% 100%, 0 100%)",
                      }}
                    >
                    <div className="flex justify-between items-start" onClick={() => selectCase(c.id)}>
                      <div 
                        className="cursor-pointer flex-1 mr-2"
                        onMouseEnter={() => {
                          playHoverEvidence();
                          playReticleLock();
                        }}
                      >
                        <span className="font-orbitron text-[11px] font-extrabold tracking-widest text-cyan-text truncate uppercase block mb-1">
                          {c.title}
                        </span>
                        <p className="font-share text-[10.5px] leading-relaxed text-text-dim line-clamp-2 italic">
                          "{c.synopsis}"
                        </p>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(c.id);
                        }}
                        className="text-text-dim hover:text-red-threat p-1 transition-colors relative z-10"
                        title="Delete Case"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-border-hairline/10 flex items-center justify-between" onClick={() => selectCase(c.id)}>
                      <div className="flex gap-2">
                        <Badge variant={getStatusBadgeVariant(c.status)} size="xs">
                          {c.status}
                        </Badge>
                      </div>
                      <div className="font-mono text-[10px] text-text-dim flex gap-3">
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
          <div className="border-t border-border-hairline/20 pt-3 mt-4 text-[10.5px] font-share text-text-dim">
            <span className="text-cyan-primary font-bold">TELEMETRY SECURE INTEL:</span> Case databases are safely synced in standard browser LocalStorage and segment nodes survive reload.
          </div>
        </GlassPanel>
      </div>

      {/* ================= RIGHT SECTION: DETAILED CASE DOSSIER VIEW ================= */}
      <div className="col-span-12 lg:col-span-8 flex flex-col h-full">
        {!activeCase ? (
          <GlassPanel className="flex-1 flex flex-col items-center justify-center p-6 text-center" clipSize="md" showScanlines={true}>
            <Brain className="w-16 h-16 text-cyan-dim opacity-40 animate-hex-pulse-flicker mb-3" />
            <h3 className="font-orbitron text-sm font-black text-cyan-text tracking-widest uppercase">
              NO DOSSIER FOCUS CONTEXT
            </h3>
            <p className="text-[11px] font-share text-text-dim max-w-sm mt-1 leading-normal uppercase">
              Select an ARG case dossier in the sidebar registry or create a new investigation record to begin telemetry scans.
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
                  <div className="border border-cyan-primary p-4 bg-bg-void/90 font-orbitron text-xs tracking-[0.2em] text-cyan-primary shadow-[0_0_30px_rgba(47,241,228,0.2)]">
                    VERIFYING ACCESS...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <GlassPanel className="flex-1 flex flex-col relative overflow-hidden" clipSize="md" showScanlines={true}>
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
                        className="bg-bg-void border border-border-hairline/30 text-cyan-text text-[10.5px] font-mono rounded-sm px-1.5 py-0.5 focus:outline-none focus:border-cyan-primary uppercase"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SOLVED">SOLVED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                        <option value="STALLED">STALLED</option>
                      </select>
                      <span className="font-mono text-[10.5px] text-text-dim tracking-wider uppercase">
                        ARG_DB: #{activeCase.id.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 font-mono text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-primary animate-hex-pulse-flicker" />
                      <span className={saveStatus === "SAVING" ? "text-amber-alert" : "text-green-verified"}>
                        {saveStatus === "SAVING" ? "AUTO-SAVING..." : "SYNCED"}
                      </span>
                    </div>
                  </div>

                  {/* Case titles */}
                  <div className="space-y-1">
                    <h2 className="font-orbitron text-lg font-black text-text-primary uppercase tracking-widest cyan-glow truncate max-w-sm">
                      <BlurText text={activeCase.title} delay={0.05} />
                    </h2>
                    <p className="font-share text-[11px] text-cyan-dim font-bold tracking-widest uppercase border-b border-border-hairline/25 pb-2.5">
                      CREATED: {new Date(activeCase.createdAt).toLocaleDateString()} // ELAPSED: {getDaysElapsed(activeCase.createdAt)}
                    </p>
                  </div>

                  {/* Spec metrics bento cards */}
                  <div className="grid grid-cols-3 gap-2 py-1 font-share text-[11px] shrink-0">
                    <div className="bg-bg-void/60 border border-border-hairline/15 p-2 rounded-sm flex flex-col">
                      <span className="text-text-dim text-[10px] uppercase flex items-center mb-0.5">
                        <Clock className="w-3 h-3 mr-1 text-cyan-dim" />
                        DURATION
                      </span>
                      <span className="text-text-primary font-mono font-bold text-xs uppercase">{getDaysElapsed(activeCase.createdAt)}</span>
                    </div>
                    <div className="bg-bg-void/60 border border-border-hairline/15 p-2 rounded-sm flex flex-col">
                      <span className="text-text-dim text-[10px] uppercase flex items-center mb-0.5">
                        <Database className="w-3 h-3 mr-1 text-cyan-dim" />
                        CLUES FOUND
                      </span>
                      <span className="text-text-primary font-mono font-bold text-xs uppercase">{activeCaseNodes.length} FIL</span>
                    </div>
                    <div className="bg-bg-void/60 border border-border-hairline/15 p-2 rounded-sm flex flex-col col-span-1">
                      <span className="text-text-dim text-[10px] uppercase flex items-center mb-0.5">
                        <Compass className="w-3 h-3 mr-1 text-cyan-dim" />
                        CORRELATIONS
                      </span>
                      <span className="text-cyan-text font-mono font-bold text-xs uppercase">{activeCaseConnections.length} LNK</span>
                    </div>
                  </div>

                  {/* Sub-tabs strip using the bracketed IconTabs component */}
                  <div className="flex items-center justify-between border-t border-border-hairline/15 pt-2.5 shrink-0">
                    <span className="text-[10.5px] font-bold text-cyan-dim tracking-widest uppercase">
                      ARG SUB-REGISTRIES:
                    </span>
                    <IconTabs tabs={dossierTabs} activeTabId={activeTab} onChange={(id) => setActiveTab(id)} />
                  </div>

                  {/* Content switching based on active subtab */}
                  <div className="bg-bg-void/40 border border-border-hairline/10 p-3 flex-1 flex flex-col min-h-[160px] max-h-[300px]">
                    {activeTab === "info" && (
                      <div className="space-y-2 flex-1 flex flex-col">
                        <div className="flex justify-between items-center">
                          <span className="font-chakra text-[10.5px] font-extrabold text-cyan-text uppercase tracking-widest block">
                            INVESTIGATION NOTES & JOURNAL
                          </span>
                          <span className="text-[10px] font-mono text-text-dim/60">MD JOURNAL SUPPORTED</span>
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
                        <span className="font-chakra text-[10.5px] font-extrabold text-cyan-text uppercase tracking-widest block">
                          CLUES DISCOVERED REGISTRY
                        </span>
                        {activeCaseNodes.length === 0 ? (
                          <p className="text-[10.5px] text-text-dim italic">No clue nodes created yet. Deploy notes or photo blocks in the Detective Board.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {activeCaseNodes.map((node) => (
                              <div key={node.id} className="flex justify-between items-center text-[10.5px] bg-bg-void/80 p-2 border border-border-hairline/10 rounded-sm">
                                <div className="flex flex-col">
                                  <span className="font-mono text-text-primary font-bold">{node.title}</span>
                                  <span className="text-[10px] text-text-dim font-share truncate max-w-[150px]">{node.content}</span>
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
                        <span className="font-chakra text-[10.5px] font-extrabold text-cyan-text uppercase tracking-widest block">
                          ASSOCIATIVE CORRELATION SCHEMES
                        </span>
                        {activeCaseConnections.length === 0 ? (
                          <p className="text-[10.5px] text-text-dim italic">No linkages drafted yet. Link clues via right-click 'Connect to...' on the Board.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {activeCaseConnections.map((conn) => {
                              const fromNode = activeCaseNodes.find(n => n.id === conn.fromNodeId);
                              const toNode = activeCaseNodes.find(n => n.id === conn.toNodeId);
                              return (
                                <div key={conn.id} className="text-[10.5px] bg-bg-void/80 p-2 border border-border-hairline/10 rounded-sm flex flex-col gap-1">
                                  <div className="flex justify-between font-mono">
                                    <span className="text-cyan-dim truncate">{fromNode?.title || "CLUE A"}</span>
                                    <span className="text-text-dim/60">↔</span>
                                    <span className="text-cyan-dim truncate text-right">{toNode?.title || "CLUE B"}</span>
                                  </div>
                                  {conn.label && (
                                    <div className="bg-cyan-primary/5 border border-cyan-primary/10 px-1 py-0.5 rounded-sm text-center text-[10px] font-sans font-bold text-cyan-text uppercase">
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
                <div className="border-t border-border-hairline/20 pt-4 mt-4 flex items-center justify-between text-[11px] font-share text-text-dim shrink-0">
                  <span className="flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-cyan-primary animate-hex-pulse-flicker" />
                    SECURE DECRYPTED METADATA STREAM
                  </span>
                  <span className="font-mono text-[10.5px]">BELFRY_SYS v4.95</span>
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

      {/* --- CREATE CASE DIALOG MODAL --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-bg-void/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <GlassPanel className="p-4 max-w-sm w-full" clipSize="md" showCornerTicks={true}>
            <div className="flex justify-between items-center border-b border-border-hairline/25 pb-2 mb-3">
              <h3 className="font-orbitron text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                BOOT NEW INVESTIGATION DOSSIER
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-dim hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">DOSSIER TITLE / ARG NAME</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. RED QUEEN PUZZLE LOG"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">INITIAL SYNOPSIS BRIEFING</label>
                <textarea
                  required
                  placeholder="What is this ARG about? Summarize the current puzzle path or overarching theme."
                  rows={4}
                  value={newSynopsis}
                  onChange={(e) => setNewSynopsis(e.target.value)}
                  className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">INVESTIGATIVE DISCIPLINE STATUS</label>
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

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-[11px] uppercase font-bold text-text-dim hover:text-text-primary transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[11px] font-black uppercase tracking-widest"
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
          <GlassPanel className="p-4 max-w-sm w-full border-red-threat/50 shadow-[0_0_15px_rgba(255,59,78,0.25)]" clipSize="md" showCornerTicks={true}>
            <div className="flex justify-between items-center border-b border-red-threat/25 pb-2 mb-3 text-red-threat">
              <h3 className="font-orbitron text-xs font-black tracking-widest flex items-center uppercase">
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
                className="px-3 py-1.5 text-[11px] uppercase font-bold text-text-dim hover:text-text-primary transition-colors"
              >
                ABORT DELETION
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 border border-red-threat/50 text-red-threat hover:bg-red-threat hover:text-bg-void transition-colors text-[11px] font-black uppercase tracking-widest"
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
