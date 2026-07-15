import React, { useEffect, useRef } from "react";
import ParticleReveal from "./ParticleReveal";
import { Cpu, Terminal } from "lucide-react";
import { playBinaryScanLoop } from "../../lib/soundEngine";
import BinaryRain from "../react-bits/BinaryRain";
import TreeGrowth from "../react-bits/TreeGrowth";

interface BinaryScannerProps {
  active?: boolean;
  scanLabel?: string;
}

export default function BinaryScanner({
  active = true,
  scanLabel = "DECOMPILING BINARY",
}: BinaryScannerProps) {
  const scanSoundRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (active) {
      if (!scanSoundRef.current) {
        scanSoundRef.current = playBinaryScanLoop();
      }
    } else {
      if (scanSoundRef.current) {
        scanSoundRef.current.stop();
        scanSoundRef.current = null;
      }
    }
    return () => {
      if (scanSoundRef.current) {
        scanSoundRef.current.stop();
        scanSoundRef.current = null;
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none flex items-center justify-center bg-bg-void/95">
      
      {/* Background Binary Rain via React Bits */}
      <BinaryRain density={20} color="rgba(47, 241, 228, 0.15)" />

      {/* Structure / Dependency Tree via React Bits */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <TreeGrowth active={active} color="rgba(47, 241, 228, 0.4)" className="w-80 h-80" />
      </div>

      <div className="relative z-30 bg-bg-void/90 p-4 border border-cyan-primary/40 flex items-center justify-center shadow-[0_0_15px_#2ff1e4]">
        <ParticleReveal active={active} duration={1200} icon={Terminal} className="scale-125" />
      </div>

      <div className="absolute bottom-4 right-4 flex items-center space-x-2 font-share text-[11px] text-cyan-primary tracking-widest bg-bg-void/90 px-2 py-1 border border-cyan-primary/30">
        <span className="w-2 h-2 rounded-full bg-cyan-primary animate-ping-cyan" />
        <span className="animate-hex-pulse-flicker font-bold">{scanLabel}</span>
      </div>
    </div>
  );
}
