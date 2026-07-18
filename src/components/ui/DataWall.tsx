import React, { useMemo } from "react";

const HEX = "0123456789ABCDEF";
const OPS = [
  "MEM",
  "SEG",
  "PTR",
  "REG",
  "BUS",
  "CHK",
  "XOR",
  "LSB",
  "SIG",
  "ENT",
  "DEC",
  "IDX",
];

function rand<T>(arr: ArrayLike<T>): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/** One line of plausible machine chatter: address, opcode, payload, status. */
function buildLine() {
  const addr = Array.from({ length: 6 })
    .map(() => rand(HEX))
    .join("");
  const op = rand(OPS);
  const payload = Array.from({ length: 4 + Math.floor(Math.random() * 6) })
    .map(() =>
      Array.from({ length: 2 })
        .map(() => rand(HEX))
        .join(""),
    )
    .join(" ");
  const state = Math.random() > 0.82 ? "FAULT" : Math.random() > 0.5 ? "OK" : "IDLE";
  return { text: `0x${addr}  ${op}  ${payload}`, state };
}

interface DataWallProps {
  /** Number of scrolling rows. */
  lines?: number;
  className?: string;
}

/**
 * Horizontal machine-chatter wall — the scrolling code blocks from the Arkham
 * console reference, for filling dead panel space.
 *
 * Complements AmbientTelemetry rather than repeating it: that one runs vertical
 * glyph columns in the screen margins, this one runs horizontal log lines
 * inside a container. Same discipline — lines are generated once and only
 * `transform` animates, so there is no JS loop and no re-render.
 *
 * Purely decorative: it is aria-hidden and carries no real telemetry, so it
 * must never be the only thing occupying a region that should hold content.
 */
export default function DataWall({ lines = 14, className = "" }: DataWallProps) {
  const rows = useMemo(
    () =>
      Array.from({ length: lines }).map((_, i) => {
        // Doubled so the -50% -> 0 translate loops seamlessly.
        const half = Array.from({ length: 3 })
          .map(() => buildLine().text)
          .join("     ");
        const l = buildLine();
        return {
          text: `${half}     ${half}`,
          state: l.state,
          duration: 28 + Math.random() * 46,
          delay: -Math.random() * 40,
          reverse: i % 3 === 1,
          opacity: 0.12 + Math.random() * 0.16,
        };
      }),
    [lines],
  );

  return (
    <div className={`data-wall ${className}`} aria-hidden="true">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`data-wall-row ${r.reverse ? "data-wall-row--rev" : ""}`}
          style={
            {
              opacity: r.opacity,
              "--wall-duration": `${r.duration}s`,
              "--wall-delay": `${r.delay}s`,
            } as React.CSSProperties
          }
        >
          <span className={r.state === "FAULT" ? "text-red-threat/70" : undefined}>
            {r.text}
          </span>
        </div>
      ))}
    </div>
  );
}
