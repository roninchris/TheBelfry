import React, { useEffect, useMemo, useRef } from "react";
import { playScanLoop } from "../../lib/soundEngine";

interface ScannerAnimationProps {
  active?: boolean;
  scanLabel?: string;
}

const GLYPHS = "0123456789ABCDEF";

/**
 * Forensic scan overlay — a byte lattice resolving under analysis.
 *
 * A grid of cells churns through random nibbles and then locks, column band by
 * column band, behind a travelling resolve front. It is the shape of the work
 * the scan is actually doing (raw bytes going from noise to identified) rather
 * than a generic progress list or radar, and it is modular by construction, so
 * it fills any panel at any aspect ratio.
 *
 * Cells are driven by CSS custom properties and a single interval that writes
 * textContent directly — no per-cell React state, no rAF loop, and the churn
 * stops entirely while the tab is hidden.
 */
export default function ScannerAnimation({
  active = true,
  scanLabel = "SCANNING EVIDENCE STREAM",
}: ScannerAnimationProps) {
  const scanSoundRef = useRef<{ stop: () => void } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

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

  // Churn the unlocked cells. Direct textContent writes: this ticks fast, and
  // as React state it would re-render ~140 nodes several times a second.
  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let timer = 0;
    const tick = () => {
      if (!document.hidden && gridRef.current) {
        const cells = gridRef.current.querySelectorAll<HTMLElement>("[data-churn]");
        for (const c of cells) {
          // Skip most cells each pass so the field shimmers unevenly rather
          // than repainting as one solid block.
          if (Math.random() > 0.35) continue;
          c.textContent = GLYPHS[(Math.random() * 16) | 0];
        }
      }
      timer = window.setTimeout(tick, 90);
    };
    timer = window.setTimeout(tick, 90);
    return () => clearTimeout(timer);
  }, [active]);

  const cells = useMemo(
    () =>
      Array.from({ length: 168 }).map((_, i) => ({
        col: i % 24,
        seed: GLYPHS[(Math.random() * 16) | 0],
        // Lock order follows the column, with jitter so the front is ragged.
        delay: (i % 24) * 0.09 + Math.random() * 0.12,
      })),
    [],
  );

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none overflow-hidden">
      <div className="absolute inset-0 bg-bg-void/80 backdrop-blur-[1px]" />

      {/* Resolve front sweeping across the lattice. */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="byte-resolve-front absolute inset-y-0 w-[18%]" />
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-[5%] py-[4%] gap-[0.8em]">
        <div className="w-full max-w-[520px] flex items-baseline justify-between">
          <span className="font-display text-[13px] font-extrabold tracking-[0.2em] text-white uppercase truncate">
            {scanLabel}
          </span>
          <span className="font-share text-[12px] tracking-widest text-accent-primary shrink-0 ml-3 animate-hex-pulse-flicker">
            RESOLVING
          </span>
        </div>

        {/* The lattice. grid-cols-24 via inline style so it does not depend on
            a Tailwind arbitrary-column class existing. */}
        <div
          ref={gridRef}
          className="byte-lattice w-full max-w-[520px]"
          style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
        >
          {cells.map((c, i) => (
            <span
              key={i}
              data-churn=""
              className="byte-cell"
              style={{ animationDelay: `${c.delay}s` }}
            >
              {c.seed}
            </span>
          ))}
        </div>

        <div className="w-full max-w-[520px] flex items-center justify-between font-share text-[12px] tracking-widest text-cyan-text/60 uppercase">
          <span>Byte lattice</span>
          <span className="byte-readout text-accent-primary" />
        </div>
      </div>
    </div>
  );
}
