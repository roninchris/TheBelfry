import React, { useEffect, useMemo, useRef } from "react";

const GLYPHS = "0123456789ABCDEF";

interface DataWallProps {
  /** Character cell size in px. Larger = sparser field. */
  cell?: number;
  /** Peak opacity of the brightest characters. Keep this low. */
  intensity?: number;
  className?: string;
}

/**
 * Ambient character field — a fine grid of glyphs mutating in place.
 *
 * Deliberately a background texture, not content: small type, low opacity, and
 * it fills whatever box it is given without pushing layout. Earlier this
 * component scrolled full-width log lines, which read as a foreground element
 * competing with the panel it was supposed to sit behind.
 *
 * Only a handful of cells change per tick and each is written via textContent,
 * so there is no React state and no re-render. The loop stops while the tab is
 * hidden and respects reduced-motion.
 */
export default function DataWall({
  cell = 14,
  intensity = 0.16,
  className = "",
}: DataWallProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Fixed pool of cells; the grid reflows to the container via CSS.
  const seeds = useMemo(
    () =>
      Array.from({ length: 420 }).map(() => ({
        ch: GLYPHS[(Math.random() * 16) | 0],
        // Per-cell brightness so the field has depth rather than reading flat.
        o: 0.25 + Math.random() * 0.75,
      })),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer = 0;
    const tick = () => {
      if (!document.hidden) {
        const cells = host.children;
        const n = cells.length;
        // Mutate a small slice each pass — the point is a slow shimmer, not
        // a wall of noise.
        const changes = Math.max(1, Math.round(n * 0.04));
        for (let i = 0; i < changes; i++) {
          const el = cells[(Math.random() * n) | 0] as HTMLElement;
          if (el) el.textContent = GLYPHS[(Math.random() * 16) | 0];
        }
      }
      timer = window.setTimeout(tick, 110);
    };
    timer = window.setTimeout(tick, 110);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`data-wall ${className}`}
      style={
        {
          gridTemplateColumns: `repeat(auto-fill, minmax(${cell}px, 1fr))`,
          "--wall-intensity": String(intensity),
        } as React.CSSProperties
      }
    >
      {seeds.map((s, i) => (
        <span key={i} style={{ opacity: s.o }}>
          {s.ch}
        </span>
      ))}
    </div>
  );
}
