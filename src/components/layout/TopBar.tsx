import React, { useEffect, useState } from "react";
import { Shield, Radio, Wifi, Lock } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import ShinyText from "../react-bits/ShinyText";
import KnightBadge from "../ui/KnightBadge";

export default function TopBar() {
  const currentModule = useAppStore((state) => state.currentModule);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toTimeString().split(' ')[0]);
      setDate(now.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '.'));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getModuleTitle = () => {
    switch (currentModule) {
      case "dashboard": return "FORENSIC DIAGNOSTICS // ACTIVE COMMAND";
      case "detective-board": return "EVIDENCE BOARD // LINK SYSTEM";
      case "case-files": return "CASE SYSTEM FILES // INTEL CORRELATION";
      case "crypto-lab": return "THE CODEX // CIPHER ANALYSIS";
      case "encoding-lab": return "ENCODING DECK // FORMAT TRANSLATOR";
      case "image-forensics": return "IMAGE FORENSICS // CANVAS STYLES";
      case "audio-forensics": return "SPECTRAL WAVELENGTH ANALYZER";
      case "file-analysis": return "RAW SECTOR PARSER";
      case "cyberchef-pipeline": return "SIGNAL CHAIN // OPERATION SEQUENCE";
      case "tool-database": return "DIAGNOSTIC INSTRUMENTS CATALOG";
      case "settings": return "TELEMETRY & HARDWARE CALIBRATION";
      default: return "THE BELFRY SYSTEM";
    }
  };

  return (
    <header className="h-14 border-b border-border-hairline/20 bg-bg-void/90 flex items-center justify-between px-6 font-chakra relative z-10 select-none">
      {/* Edge vignette line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-primary/20 to-transparent pointer-events-none" />

      {/* Left: Belfry systems title branding */}
      <div className="flex items-center space-x-4">
        <div className="flex items-baseline space-x-2">
          <span className="font-orbitron text-xs font-black tracking-widest text-text-primary uppercase flex items-center animate-hologram-flicker">
            <span className="w-1.5 h-3 bg-cyan-primary mr-1.5 transform -skew-x-12 inline-block shadow-[0_0_8px_#2ff1e4]" />
            BATCOMPUTER
          </span>
          <span className="font-share text-[13px] text-text-dim tracking-wider uppercase font-medium">
            BELFRY SYSTEMS // FORENSIC PLATFORM
          </span>
        </div>
      </div>

      {/* Center: Module Focus Title */}
      <div className="hidden lg:flex items-center space-x-2 font-orbitron font-extrabold tracking-widest text-sm text-cyan-text cyan-glow">
        <span className="text-xs text-text-dim opacity-70">//</span>
        <h2 key={currentModule} className="animate-data-assemble">{getModuleTitle()}</h2>
        <span className="text-xs text-text-dim opacity-70">//</span>
      </div>

      {/* Right: Telemetry metrics, date, encrypted state */}
      <div className="flex items-center space-x-5 font-share text-xs text-text-dim tracking-wider uppercase">
        {/* Connection status */}
        <div className="flex items-center space-x-1.5 border border-cyan-primary/25 bg-cyan-primary/[0.03] px-2 py-0.5"
             style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}>
          <Radio className="w-4 h-4 text-cyan-primary animate-[pulse_3s_infinite]" />
          <div className="flex items-end space-x-0.5 h-3">
            <span className="w-0.5 h-1.5 bg-cyan-primary/80 animate-signal-bar-tick" style={{ animationDelay: '0s' }} />
            <span className="w-0.5 h-2.5 bg-cyan-primary/80 animate-signal-bar-tick" style={{ animationDelay: '0.2s' }} />
            <span className="w-0.5 h-3.5 bg-cyan-primary/80 animate-signal-bar-tick" style={{ animationDelay: '0.4s' }} />
          </div>
          <ShinyText text="ENCRYPTED" speed={4} className="text-[13px] font-bold text-cyan-primary tracking-widest font-mono" />
        </div>

        {/* Tactical status details */}
        <div className="hidden sm:flex items-center space-x-3 text-xs">
          <span className="flex items-center">
            <Shield className="w-4 h-4 mr-1 text-green-verified" /> SECURE
          </span>
          <span className="flex items-center">
            <Lock className="w-4 h-4 mr-1 text-cyan-dim" /> COGNIZANCE-V9
          </span>
        </div>

        {/* System Clock */}
        <div className="flex items-center space-x-2 border-l border-border-hairline/20 pl-4 font-mono font-medium text-text-primary text-sm">
          <span>{date}</span>
          <span className="text-text-dim opacity-40">|</span>
          <span className="text-cyan-primary font-bold tracking-widest bg-cyan-primary/5 px-1.5 py-0.5 border border-cyan-primary/20">{time}</span>
        </div>

        {/* Active operative — absent for guests */}
        <KnightBadge />
      </div>
    </header>
  );
}
