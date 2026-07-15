import React, { useMemo } from "react";
import { useAppStore } from "../../store/appStore";
import { AlertTriangle, Database, RefreshCw, FileText } from "lucide-react";

export default React.memo(function StatusBar() {
  const cases = useAppStore((state) => state.cases);
  const activeCaseId = useAppStore((state) => state.activeCaseId);
  const logs = useAppStore((state) => state.logs);
  
  const activeCase = useMemo(() => cases.find(c => c.id === activeCaseId), [cases, activeCaseId]);
  const lastLogText = useMemo(() => (logs.length > 0 ? logs[logs.length - 1].text : "SYSTEM COMM-LINK STANDBY"), [logs]);

  return (
    <footer className="h-8 border-t border-border-hairline/20 bg-bg-void flex items-center justify-between px-4 font-share text-[11px] text-text-dim tracking-wider uppercase relative z-10 select-none">
      {/* Left: Active feed status ticker */}
      <div className="flex items-center space-x-3 max-w-lg truncate">
        <span className="flex items-center text-cyan-text">
          <RefreshCw className="w-3 h-3 mr-1.5 animate-radar-sweep" />
          COMM FEED:
        </span>
        <span className="text-text-primary/80 font-mono truncate text-[10.5px]">
          {lastLogText}
        </span>
      </div>

      {/* Center: Case profile link */}
      <div className="hidden md:flex items-center space-x-4">
        <span className="flex items-center font-mono">
          <Database className="w-3 h-3 mr-1.5 text-cyan-dim" />
          INDEXED: <strong className="text-text-primary ml-1">{cases.length} ACTIVE CASE DOSSIERS</strong>
        </span>
        <span className="text-border-hairline/30">|</span>
        <span className="flex items-center text-text-primary">
          <FileText className="w-3 h-3 mr-1.5 text-cyan-dim" />
          FOCUS CONTEXT: <strong className="text-cyan-text ml-1">{activeCase ? activeCase.title : "N/A"}</strong>
        </span>
      </div>

      {/* Right: Security level state banner */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center bg-red-threat/10 border border-red-threat/30 text-red-threat px-2 py-0.5 animate-hex-pulse-flicker"
             style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}>
          <AlertTriangle className="w-3 h-3 mr-1 text-red-threat shadow-[0_0_8px_rgba(255,59,78,0.5)]" />
          <span className="font-mono font-black text-[10.5px] tracking-widest leading-none">THREAT LEVEL // CODE RED</span>
        </div>
      </div>
    </footer>
  );
});
