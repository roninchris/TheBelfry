import React, { useEffect, useRef, useState } from "react";
import GlassPanel from "./GlassPanel";

interface TerminalLine {
  id: string;
  timestamp: string;
  type: "info" | "warning" | "success" | "raw";
  sender: string;
  text: string;
}

interface TerminalProps {
  lines: TerminalLine[];
  maxLines?: number;
  className?: string;
}

export default function Terminal({
  lines,
  maxLines = 100,
  className = "",
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [displayedLines, setDisplayedLines] = useState<TerminalLine[]>([]);

  // Smooth auto-scroll to the bottom of the log list
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [displayedLines]);

  // Handle line additions with staggered typewriter animation simulation
  useEffect(() => {
    setDisplayedLines(lines.slice(-maxLines));
  }, [lines, maxLines]);

  return (
    <GlassPanel
      className={`p-3.5 flex flex-col h-full select-text bg-bg-void/90 text-[13px] font-share leading-relaxed ${className}`}
      clipSize="md"
      showCornerTicks={true}
    >
      {/* Terminal Titlebar header */}
      <div className="flex justify-between items-center pb-2 mb-2 border-b border-border-hairline/15 text-text-dim uppercase tracking-widest text-[13px]">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-primary animate-ping-cyan" />
          <span>FORENSIC LOGS // EVIDENCE CONSOLE</span>
        </div>
        <span className="font-mono text-[12px]">SECURE COMM-LINK</span>
      </div>

      {/* Terminal Rows Area */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-dim scrollbar-track-bg-void"
      >
        {displayedLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-text-dim space-y-1.5">
            <span className="font-mono opacity-40 text-sm">-- NO SYSTEM DEPOSITIONS RECORDED --</span>
            <span className="text-[13px]">AWAITING EVIDENCE INGESTION VIA TERMINAL INTAKE</span>
          </div>
        ) : (
          displayedLines.map((line) => {
            let typeColor = "text-text-primary";
            let typePrefix = "::";

            if (line.type === "success") {
              typeColor = "text-green-verified font-medium";
              typePrefix = "[✓]";
            } else if (line.type === "warning") {
              typeColor = "text-amber-alert font-medium";
              typePrefix = "[!]";
            } else if (line.type === "raw") {
              typeColor = "text-cyan-dim font-mono opacity-80";
              typePrefix = ">>";
            }

            return (
              <div key={line.id} className="font-mono break-all leading-tight hover:bg-cyan-primary/5 px-1 py-0.5 transition-colors">
                <span className="text-text-dim mr-2 select-none">[{line.timestamp}]</span>
                <span className="text-cyan-primary mr-1.5 uppercase select-none">[{line.sender}]</span>
                <span className={`${typeColor}`}>
                  <span className="mr-1 opacity-60 select-none">{typePrefix}</span>
                  {line.text}
                </span>
              </div>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
}
