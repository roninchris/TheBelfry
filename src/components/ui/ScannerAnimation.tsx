import React, { useEffect, useRef } from "react";
import ParticleReveal from "./ParticleReveal";
import { Fingerprint, Cpu, Search, Eye } from "lucide-react";
import { playScanLoop } from "../../lib/soundEngine";

interface ScannerAnimationProps {
  active?: boolean;
  scanLabel?: string;
}

export default function ScannerAnimation({
  active = true,
  scanLabel = "SCANNING EVIDENCE STREAM",
}: ScannerAnimationProps) {
  const scanSoundRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (active) {
      if (!scanSoundRef.current) {
        scanSoundRef.current = playScanLoop();
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

  // Let's determine a suitable icon to pass to ParticleReveal
  const isImageScan = scanLabel.toUpperCase().includes("PNG") || scanLabel.toUpperCase().includes("IMAGE") || scanLabel.toUpperCase().includes("STEGO");
  const isAudioScan = scanLabel.toUpperCase().includes("WAV") || scanLabel.toUpperCase().includes("AUDIO") || scanLabel.toUpperCase().includes("CLAY");
  const scanIcon = isImageScan ? Eye : isAudioScan ? Cpu : Fingerprint;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none flex items-center justify-center">
      {/* Laser beam sweep overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-primary/0 via-cyan-primary/5 to-cyan-primary/15 animate-[beamSweep_3s_infinite]" />
      
      {/* Tactical radar coordinate sweep overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-72 h-72 border border-cyan-primary/10 rounded-full flex items-center justify-center animate-[spin_25s_linear_infinite]">
          {/* Radar ticks */}
          <div className="absolute w-full h-[1px] bg-cyan-primary/15" />
          <div className="absolute h-full w-[1px] bg-cyan-primary/15" />
          <div className="w-56 h-56 border border-dashed border-cyan-primary/20 rounded-full" />
          <div className="w-36 h-36 border border-cyan-primary/25 rounded-full" />
          
          {/* Radar sweeping hand */}
          <div className="absolute top-0 left-1/2 w-[1px] h-1/2 bg-gradient-to-b from-cyan-primary/80 to-transparent origin-bottom" 
               style={{ transform: 'rotate(45deg)' }} />
        </div>
      </div>

      {/* Wireframe Particle Reveal in Center */}
      <div className="relative z-30">
        <ParticleReveal active={active} duration={1200} icon={scanIcon} className="scale-90" />
      </div>

      {/* Cyberpunk grid glitch indicator corner overlay */}
      <div className="absolute bottom-4 right-4 flex items-center space-x-2 font-share text-[13px] text-cyan-primary tracking-widest bg-bg-void/90 px-2 py-1 border border-cyan-primary/30">
        <span className="w-2 h-2 rounded-full bg-cyan-primary animate-ping-cyan" />
        <span className="animate-hex-pulse-flicker">{scanLabel}</span>
      </div>

      {/* Outer pulsing framing ticks */}
      <div className="absolute inset-0 border border-cyan-primary/10 animate-[pulse_2s_infinite]" />
    </div>
  );
}

