import React, { useEffect, useRef } from "react";
import ParticleReveal from "./ParticleReveal";
import { Eye, Focus } from "lucide-react";
import { playImageScanLoop } from "../../lib/soundEngine";

interface ImageScannerProps {
  active?: boolean;
  scanLabel?: string;
}

export default function ImageScanner({
  active = true,
  scanLabel = "SCANNING IMAGE",
}: ImageScannerProps) {
  if (!active) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none flex items-center justify-center">
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(47,241,228,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(47,241,228,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
      
      {/* Scanning Laser */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-primary shadow-[0_0_10px_#2ff1e4] animate-[scan_2s_linear_infinite]" />

      {/* Target Crosshair */}
      <div className="absolute w-64 h-64 border-2 border-dashed border-cyan-primary/40 rounded-sm flex items-center justify-center animate-hex-pulse-flicker">
        <div className="absolute w-full h-[1px] bg-cyan-primary/20" />
        <div className="absolute h-full w-[1px] bg-cyan-primary/20" />
        
        {/* Corners */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-primary" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-primary" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-primary" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-primary" />
      </div>

      <div className="relative z-30">
        <ParticleReveal active={active} duration={1200} icon={Focus} className="scale-125" />
      </div>

      {/* Cyberpunk grid glitch indicator corner overlay */}
      <div className="absolute bottom-4 right-4 flex items-center space-x-2 font-share text-[11px] text-cyan-primary tracking-widest bg-bg-void/90 px-2 py-1 border border-cyan-primary/30">
        <span className="w-2 h-2 rounded-full bg-cyan-primary animate-ping-cyan" />
        <span className="animate-hex-pulse-flicker font-bold">{scanLabel}</span>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
