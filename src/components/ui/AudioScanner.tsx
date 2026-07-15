import React, { useEffect, useRef } from "react";
import ParticleReveal from "./ParticleReveal";
import { Activity } from "lucide-react";
import { playAudioScanLoop } from "../../lib/soundEngine";
import SonarRings from "../react-bits/SonarRings";

interface AudioScannerProps {
  active?: boolean;
  scanLabel?: string;
}

export default function AudioScanner({
  active = true,
  scanLabel = "ANALYZING FREQUENCIES",
}: AudioScannerProps) {
  const scanSoundRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (active) {
      if (!scanSoundRef.current) {
        scanSoundRef.current = playAudioScanLoop();
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
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none flex items-center justify-center">
      {/* Audio Waveform Effect */}
      <div className="absolute inset-0 flex items-center justify-center space-x-2 opacity-30">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i} 
            className="w-2 bg-cyan-primary rounded-full animate-hex-pulse-flicker" 
            style={{ 
              height: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.5}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`
            }} 
          />
        ))}
      </div>

      {/* Sonar rings via React Bits */}
      <div className="absolute inset-0 flex items-center justify-center opacity-70">
        <SonarRings active={active} rings={4} color="rgba(47, 241, 228, 0.4)" className="w-80 h-80" />
      </div>

      <div className="relative z-30 bg-bg-void/80 p-6 rounded-full border border-cyan-primary/30">
        <ParticleReveal active={active} duration={1200} icon={Activity} className="scale-125" />
      </div>

      <div className="absolute bottom-4 right-4 flex items-center space-x-2 font-share text-[11px] text-cyan-primary tracking-widest bg-bg-void/90 px-2 py-1 border border-cyan-primary/30">
        <span className="w-2 h-2 rounded-full bg-cyan-primary animate-ping-cyan" />
        <span className="animate-hex-pulse-flicker font-bold">{scanLabel}</span>
      </div>
    </div>
  );
}
