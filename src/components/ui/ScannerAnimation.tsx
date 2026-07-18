import React, { useEffect, useMemo, useRef } from "react";
import { playScanLoop } from "../../lib/soundEngine";

interface ScannerAnimationProps {
  active?: boolean;
  scanLabel?: string;
}

/** Register rows, modelled on the WayneTech port-scan readout. */
const REGISTERS = [
  "OPTICAL SENSOR",
  "INDEX PROCESSOR",
  "ENTROPY SWEEP",
  "SIGNATURE MATCH",
  "HTX DRIVER",
  "CARRIER DECODE",
];

/**
 * Forensic scan overlay.
 *
 * Rebuilt to be panel-shaped. The previous version centred a fixed 306px
 * (w-72) stack of concentric rings inside an overflow-hidden box, so in any
 * panel narrower than that — which is most of them — the rings were sliced off
 * by the container edges and the whole thing read as trapped in its div.
 *
 * Everything here is sized in percentages and `em`, so it fills whatever box it
 * is given at any aspect ratio without clipping. The structure follows the
 * WayneTech console: a sweep crossing the full width, a register list resolving
 * top to bottom, and process bars filling underneath.
 */
export default function ScannerAnimation({
  active = true,
  scanLabel = "SCANNING EVIDENCE STREAM",
}: ScannerAnimationProps) {
  const scanSoundRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (active) {
      if (!scanSoundRef.current) scanSoundRef.current = playScanLoop();
    } else if (scanSoundRef.current) {
      scanSoundRef.current.stop();
      scanSoundRef.current = null;
    }
    return () => {
      if (scanSoundRef.current) {
        scanSoundRef.current.stop();
        scanSoundRef.current = null;
      }
    };
  }, [active]);

  // Staggered timings, stable across re-renders so rows do not resync.
  const rows = useMemo(
    () =>
      REGISTERS.map((label, i) => ({
        label,
        delay: i * 0.42,
        fill: 55 + ((i * 37) % 45),
      })),
    [],
  );

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none overflow-hidden">
      {/* Dim the panel underneath so the readout carries the eye. */}
      <div className="absolute inset-0 bg-bg-void/70 backdrop-blur-[1px]" />

      {/* Full-width sweep. Crosses the whole box rather than orbiting inside it. */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="scan-sweep-bar absolute inset-y-0 w-[35%]" />
      </div>

      {/* Corner brackets, scaled to the box. */}
      <div className="absolute inset-2 pointer-events-none">
        {[
          "top-0 left-0 border-t-2 border-l-2",
          "top-0 right-0 border-t-2 border-r-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "bottom-0 right-0 border-b-2 border-r-2",
        ].map((c) => (
          <span
            key={c}
            className={`absolute w-[1.4em] h-[1.4em] border-accent-primary/70 ${c}`}
          />
        ))}
      </div>

      {/* Register readout. max-w keeps it centred and readable in wide panels;
          percentage width keeps it inside narrow ones. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[6%]">
        <div className="w-full max-w-[340px] space-y-[0.45em]">
          <div className="flex items-baseline justify-between mb-[0.6em]">
            <span className="font-display text-[11px] font-extrabold tracking-[0.2em] text-white uppercase">
              {scanLabel}
            </span>
            <span className="font-share text-[10px] tracking-widest text-accent-primary animate-hex-pulse-flicker">
              ACTIVE
            </span>
          </div>

          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-[0.6em]">
              <span
                className="scan-register-tick w-[0.5em] h-[0.5em] shrink-0 border border-accent-primary/60"
                style={{ animationDelay: `${r.delay}s` }}
              />
              <span className="font-share text-[10px] tracking-[0.14em] text-cyan-text/80 uppercase w-[9em] shrink-0 truncate">
                {r.label}
              </span>
              <span className="relative flex-1 h-[0.45em] bg-bg-void/80 border border-border-hairline/25 overflow-hidden">
                <span
                  className="scan-register-fill absolute inset-y-0 left-0 bg-accent-primary/70"
                  style={{
                    animationDelay: `${r.delay}s`,
                    ["--fill" as string]: `${r.fill}%`,
                  }}
                />
              </span>
              <span
                className="scan-register-state font-share text-[9px] tracking-widest text-green-active w-[4.5em] text-right shrink-0"
                style={{ animationDelay: `${r.delay}s` }}
              >
                OK
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
