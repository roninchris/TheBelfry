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
  columns = 22,
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
          opacity: 0.05 + Math.random() * 0.09,
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
