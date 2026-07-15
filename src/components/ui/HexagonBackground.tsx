import React, { useEffect, useState, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

interface HexagonProps {
  cx: number;
  cy: number;
  r: number;
  delay: number;
  duration: number;
  type?: "outline" | "solid" | "dashed";
  opacityRange?: [number, number];
}

const HexItem: React.FC<HexagonProps> = ({
  cx,
  cy,
  r,
  delay,
  duration,
  type = "outline",
  opacityRange = [0.03, 0.22]
}) => {
  const w = r * Math.sqrt(3) / 2;
  const pathData = `M ${cx} ${cy - r} L ${cx + w} ${cy - r / 2} L ${cx + w} ${cy + r / 2} L ${cx} ${cy + r} L ${cx - w} ${cy + r / 2} L ${cx - w} ${cy - r / 2} Z`;

  return (
    <motion.path
      d={pathData}
      fill={type === "solid" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={type === "dashed" ? 1.5 : 1}
      strokeDasharray={type === "dashed" ? "3 3" : undefined}
      initial={{ opacity: opacityRange[0] }}
      animate={{
        opacity: [opacityRange[0], opacityRange[1], opacityRange[0]],
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        delay: delay,
        ease: "easeInOut",
      }}
    />
  );
};

export default function HexagonBackground() {
  const shouldReduceMotion = useReducedMotion();
  const hackingChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*<>[]{}|;:,./?";
  
  const [cornerText, setCornerText] = useState<string[]>(["", "", "", ""]);

  useEffect(() => {
    const generate = () => Array.from({ length: 4 }).map(() => 
      Array.from({ length: 15 }).map(() => hackingChars[Math.floor(Math.random() * hackingChars.length)]).join("")
    );
    
    setCornerText(generate());
    if (shouldReduceMotion) return;

    const interval = setInterval(() => {
      setCornerText(generate());
    }, 100);

    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0 select-none">
      {/* Background Dark Gradient & Subtle Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-bg-void via-bg-void to-[#021015]" />
      <div className="absolute inset-0 bg-scanline-pattern opacity-[0.03] pointer-events-none mix-blend-overlay" />

      {/* Top and Bottom Glow / Monitor Curve */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-cyan-primary/20 to-transparent blur-xl opacity-30" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-cyan-primary/20 to-transparent blur-xl opacity-30" />
      
      {/* Decorative Top/Bottom lines */}
      <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-cyan-primary/30" />
      <div className="absolute bottom-0 left-[20%] right-[20%] h-[1px] bg-cyan-primary/30" />

      {/* Extreme Left Honeycomb HUD Frame */}
      <div className="absolute left-0 top-0 bottom-0 w-32 flex flex-col justify-center opacity-40">
        <svg width="100%" height="100%" className="text-cyan-primary">
          <pattern id="hex-left" x="0" y="0" width="40" height="69.282" patternUnits="userSpaceOnUse">
            {/* Hexagon Path */}
            <path d="M40 17.32L40 51.96L20 63.5L0 51.96L0 17.32L20 5.77Z" fill="none" stroke="currentColor" strokeWidth="0.5" className="opacity-40" />
          </pattern>
          <rect x="-10" y="20%" width="50" height="60%" fill="url(#hex-left)" />
          {/* Sparse detached hexes */}
          <path d="M80 17.32L80 51.96L60 63.5L40 51.96L40 17.32L60 5.77Z" fill="none" stroke="currentColor" strokeWidth="0.5" transform="translate(-20, 250)" className="opacity-30" />
          <path d="M120 17.32L120 51.96L100 63.5L80 51.96L80 17.32L100 5.77Z" fill="none" stroke="currentColor" strokeWidth="1" transform="translate(-40, 450)" className="opacity-50" />
        </svg>
      </div>

      {/* Extreme Right Honeycomb HUD Frame */}
      <div className="absolute right-0 top-0 bottom-0 w-32 flex flex-col justify-center opacity-40 transform scale-x-[-1]">
        <svg width="100%" height="100%" className="text-cyan-primary">
          <rect x="-10" y="20%" width="50" height="60%" fill="url(#hex-left)" />
          {/* Sparse detached hexes */}
          <path d="M80 17.32L80 51.96L60 63.5L40 51.96L40 17.32L60 5.77Z" fill="none" stroke="currentColor" strokeWidth="0.5" transform="translate(-20, 650)" className="opacity-30" />
          <path d="M120 17.32L120 51.96L100 63.5L80 51.96L80 17.32L100 5.77Z" fill="none" stroke="currentColor" strokeWidth="1" transform="translate(-40, 200)" className="opacity-50" />
        </svg>
      </div>

      {/* Scattered Floating Tech Details */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.2]">
        
        {/* Top Left Detached HUD Elements */}
        <div className="absolute top-[20%] left-[10%] w-48 h-48">
          <svg width="100%" height="100%" className="text-cyan-primary">
            <path d="M 0 0 L 50 0 L 80 30" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50" />
            <circle cx="0" cy="0" r="2" fill="currentColor" />
            <circle cx="80" cy="30" r="2" fill="currentColor" />
            
            {/* Faint nested hex */}
            <g transform="translate(100, 50) scale(0.6)">
              <path d="M40 17.32L40 51.96L20 63.5L0 51.96L0 17.32L20 5.77Z" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-40" />
            </g>
          </svg>
        </div>

        {/* Bottom Right Detached HUD Elements */}
        <div className="absolute bottom-[20%] right-[10%] w-48 h-48">
          <svg width="100%" height="100%" className="text-cyan-primary">
            <path d="M 192 192 L 140 192 L 110 160" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50" />
            <circle cx="192" cy="192" r="2" fill="currentColor" />
            <circle cx="110" cy="160" r="2" fill="currentColor" />
            
            <g transform="translate(50, 80) scale(0.8)">
              <path d="M40 17.32L40 51.96L20 63.5L0 51.96L0 17.32L20 5.77Z" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30" />
            </g>
          </svg>
        </div>

        {/* Center Giant Ambient Hexagons */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.03]">
          <svg width="100%" height="100%" viewBox="0 0 100 100" className={`text-cyan-primary ${shouldReduceMotion ? '' : 'animate-[spin_120s_linear_infinite]'}`}>
            <path d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z" fill="none" stroke="currentColor" strokeWidth="0.2" />
          </svg>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] opacity-[0.04]">
          <svg width="100%" height="100%" viewBox="0 0 100 100" className={`text-cyan-primary ${shouldReduceMotion ? '' : 'animate-[spin_90s_linear_infinite_reverse]'}`}>
            <path d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="1 2" />
          </svg>
        </div>

      </div>

      {/* Corner Telemetry / Hacking Chars */}
      <div className="absolute top-8 left-8 font-mono text-[10px] text-cyan-primary/40 space-y-1">
        <div className="animate-hex-pulse-flicker">{cornerText[0]}</div>
        <div className="text-cyan-dim/50 tracking-widest">SYS_CORE: ONLINE [0xFA3]</div>
      </div>
      <div className="absolute top-8 right-8 font-mono text-[10px] text-cyan-primary/40 text-right space-y-1">
        <div className="animate-hex-pulse-flicker">{cornerText[1]}</div>
        <div className="text-cyan-dim/50 tracking-widest">UPLINK_STATUS: SECURE</div>
      </div>
      <div className="absolute bottom-8 left-8 font-mono text-[10px] text-cyan-primary/40 space-y-1">
        <div className="text-cyan-dim/50 tracking-widest">TRACE_ROUTE: MASKED</div>
        <div className="animate-hex-pulse-flicker">{cornerText[2]}</div>
      </div>
      <div className="absolute bottom-8 right-8 font-mono text-[10px] text-cyan-primary/40 text-right space-y-1">
        <div className="text-cyan-dim/50 tracking-widest">OS_VER: BELFRY 2.8.4</div>
        <div className="animate-hex-pulse-flicker">{cornerText[3]}</div>
      </div>
    </div>
  );
}

