import React, { useState } from "react";
import { useAppStore } from "../../store/appStore";
import GlassPanel from "./GlassPanel";
import Badge from "./Badge";
import { ShieldAlert, RefreshCw, Cpu, WifiOff, Lock } from "lucide-react";

interface OfflineModuleProps {
  moduleName: string;
  description: string;
}

export default function OfflineModulePanel({ moduleName, description }: OfflineModuleProps) {
  const { addLog } = useAppStore();
  const [booting, setBooting] = useState(false);

  const handleBootDiagnostics = () => {
    setBooting(true);
    addLog(`INITIATING CONSOLE HANDSHAKE FOR [${moduleName.toUpperCase()}]`, "warning", "SYS-BOOT");
    
    setTimeout(() => {
      addLog(`ALLOCATING SECURE RAM SECTORS (0x7FFF8000)`, "info", "CPU-V9");
    }, 400);

    setTimeout(() => {
      addLog(`RESOLVING DECRYPTOR INTERFACE DEPENDENCIES... DONE`, "success", "SYS");
    }, 800);

    setTimeout(() => {
      addLog(`HANDSHAKE COMPLETE: MODULE IS READY BUT GOTHAM ROUTE IS CURRENTLY BLOCKED`, "warning", "SYS");
      setBooting(false);
    }, 1200);
  };

  return (
    <div className="h-full w-full p-6 flex items-center justify-center select-none font-chakra relative">
      <div className="absolute inset-0 bg-gradient-to-br from-red-threat/[0.01] to-transparent pointer-events-none" />

      <GlassPanel className="max-w-2xl w-full p-8 text-center space-y-6" clipSize="md">
        {/* Module warning header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-14 h-14 bg-red-threat/10 border border-red-threat/30 rounded-full flex items-center justify-center animate-hex-pulse-flicker">
            <WifiOff className="w-6 h-6 text-red-threat shadow-[0_0_12px_#ff3b4e]" />
          </div>
          <Badge variant="red" size="md">CONNECTION REFUSED</Badge>
        </div>

        {/* Info panel */}
        <div className="space-y-2">
          <h2 className="font-orbitron text-lg font-black tracking-widest text-text-primary uppercase">
            {moduleName} // MODULE DISCONNECTED
          </h2>
          <p className="text-xs text-text-dim tracking-wide max-w-lg mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Diagnostics block */}
        <div className="bg-bg-void/80 border border-border-hairline/25 p-4 rounded-none font-share text-xs text-left text-text-dim space-y-2.5">
          <div className="flex justify-between border-b border-border-hairline/15 pb-1 text-[11px]">
            <span>DIAGNOSTIC STATUS RECEPTOR</span>
            <span className="text-red-threat font-bold">GRID OFFLINE</span>
          </div>
          <div className="flex justify-between items-center">
            <span>CORE REGISTRY ADDR:</span>
            <span className="font-mono text-cyan-dim font-bold">0x00FF8B4019</span>
          </div>
          <div className="flex justify-between items-center">
            <span>CRYPTO INTEGRITY:</span>
            <span className="text-green-verified font-bold">100% UNTOUCHED</span>
          </div>
          <div className="flex justify-between items-center">
            <span>DECODER DEPENDENCY:</span>
            <span className="text-amber-alert font-bold">STANDBY FOR GRID BOOT</span>
          </div>
        </div>

        {/* Call to actions */}
        <div className="pt-2 flex justify-center space-x-4">
          <button
            onClick={handleBootDiagnostics}
            disabled={booting}
            className={`font-orbitron font-black text-xs uppercase tracking-widest py-2.5 px-6 border transition-all duration-300 flex items-center space-x-2 ${
              booting
                ? "bg-amber-alert/10 border-amber-alert/50 text-amber-alert cursor-wait"
                : "bg-red-threat/10 border-red-threat/40 text-red-threat hover:bg-red-threat hover:text-bg-void hover:shadow-[0_0_12px_rgba(255,59,78,0.4)] cursor-pointer"
            }`}
            style={{
              clipPath: "polygon(6px 0, 100% 0, 92% 100%, 0 100%)"
            }}
          >
            {booting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-radar-sweep" />
                <span>BOOTING PORT HANDSHAKE...</span>
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" />
                <span>RESTORE ENCRYPTED COMM-LINK</span>
              </>
            )}
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
