import React, { useMemo } from "react";

const GLYPHS = "ABCDEF0123456789/\\<>[]{}|:;=+*#$%&";

interface AmbientTelemetryProps {
  /** Number of glyph columns across the viewport. */
  columns?: number;
  /** Leans the field in while the system is working (colour + speed shift). */
  active?: boolean;
  className?: string;
}

/**
 * Persistent glyph columns drifting behind the whole console — the ambient
 * "readout" layer of the Batcomputer. Distinct from BinaryRain, which is a
 * short-lived in-module effect during scans: this one never stops, sits at low
 * opacity, and is masked to the left/right margins so it frames content instead
 * of competing with it.
 *
 * The glyph strings are generated once and never change; only `transform`
 * animates (see .telemetry-column in index.css), so this costs no re-renders.
 */
export default function AmbientTelemetry({
  // The mask hides the middle ~48%, so roughly half of these actually land in
  // the visible margins — hence the higher count than the visible density.
  columns = 38,
  active = false,
  className = "",
}: AmbientTelemetryProps) {
  // Seeded once per mount. Re-randomising on every render would defeat the
  // whole point of keeping this layer off the main thread.
  const streams = useMemo(
    () =>
      Array.from({ length: columns }).map((_, i) => {
        // Doubled string + a -50%→0 translate gives a seamless loop. The half
        // must exceed viewport height on its own or the loop shows gaps —
        // 110 glyphs at ~11px is ~1200px, clear of typical desktop heights.
        const half = Array.from({ length: 110 })
          .map(() => GLYPHS[Math.floor(Math.random() * GLYPHS.length)])
          .join("");
        return {
          text: half + half,
          left: (i / columns) * 100 + (Math.random() * 2 - 1),
          duration: 45 + Math.random() * 55,
          breathe: 6 + Math.random() * 8,
          delay: -Math.random() * 60,
          size: 10 + Math.round(Math.random() * 3),
          // Composited against the #020912 void, anything below ~0.15 is within
          // noise of the background and reads as empty. Keep the ceiling under
          // ~0.4 so the glyphs stay behind content rather than beside it.
          opacity: 0.16 + Math.random() * 0.22,
        };
      }),
    [columns],
  );

  return (
    <div
      className={`telemetry-field z-0 ${className}`}
      data-intensity={active ? "active" : "idle"}
      aria-hidden="true"
    >
      {streams.map((s, i) => (
        <div
          key={i}
          className="telemetry-column"
          style={
            {
              left: `${s.left}%`,
              fontSize: `${s.size}px`,
              opacity: s.opacity,
              "--telemetry-duration": `${s.duration}s`,
              "--telemetry-breathe": `${s.breathe}s`,
              "--telemetry-delay": `${s.delay}s`,
            } as React.CSSProperties
          }
        >
          {s.text}
        </div>
      ))}
    </div>
  );
}
