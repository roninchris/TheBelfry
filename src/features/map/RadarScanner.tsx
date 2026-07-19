import React, { useId, useMemo } from "react";

/**
 * Ambient 3D radar sweep — decoration only.
 *
 * Carries no data: nothing here is measured, and no contact corresponds to
 * anything plotted on the map. It sits beneath a panel of real coordinates, so
 * it is deliberately abstract — no bearings, no ranges, no counts. A fabricated
 * figure next to a genuine readout would undermine both.
 *
 * The dish is drawn in perspective rather than as a flat top-down circle: rings
 * are ellipses on a tilted plane, and the sweep arm rotates *within* that plane,
 * so it foreshortens as it comes toward the viewer. That is what separates this
 * from the usual flat radar clock-hand.
 */

const VIEW_W = 300;
const VIEW_H = 170;

/** Centre of the dish, in viewBox units. */
const CX = 150;
const CY = 104;

/** Plane tilt: rings are this much flatter vertically than horizontally. */
const SQUASH = 0.34;

/** Ring radii, outermost first. */
const RINGS = [128, 96, 64, 32];

interface Contact {
  /** Angle around the dish, radians. */
  angle: number;
  /** Distance from centre, 0..1 of the outer ring. */
  dist: number;
  size: number;
  /** Fraction of the sweep cycle at which this contact gets painted. */
  phase: number;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function RadarScanner({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `radar-sweep-${uid}`;
  const fadeId = `radar-fade-${uid}`;
  const glowId = `radar-glow-${uid}`;

  /**
   * Contacts are placed once and never move.
   *
   * Each is lit only as the arm passes its bearing, which is what makes the
   * sweep feel like it is *finding* things rather than a rotating decoration
   * over a static dot field.
   */
  const contacts = useMemo<Contact[]>(() => {
    const rnd = mulberry32(20260719);
    return Array.from({ length: 11 }, () => {
      const angle = rnd() * Math.PI * 2;
      return {
        angle,
        dist: 0.22 + rnd() * 0.74,
        size: 1.5 + rnd() * 2.2,
        // Bearing determines when the arm reaches it, so the flash is in step
        // with the rotation rather than on an unrelated timer.
        phase: (angle / (Math.PI * 2)) % 1,
      };
    });
  }, []);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* The sweep wedge: hot at the leading edge, trailing to nothing. */}
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgb(var(--rgb-accent))" stopOpacity="0" />
          <stop offset="0.72" stopColor="rgb(var(--rgb-accent))" stopOpacity="0.10" />
          <stop offset="1" stopColor="rgb(var(--rgb-accent))" stopOpacity="0.42" />
        </linearGradient>

        <radialGradient id={glowId}>
          <stop offset="0" stopColor="rgb(var(--rgb-accent))" stopOpacity="0.16" />
          <stop offset="1" stopColor="rgb(var(--rgb-accent))" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-bg-void)" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="var(--color-bg-void)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Everything sits on the tilted plane. Scaling the group vertically is
          what puts the dish into perspective — the sweep inherits it, so the
          arm foreshortens correctly instead of tracing a true circle. */}
      <g transform={`translate(${CX} ${CY}) scale(1 ${SQUASH})`}>
        <circle r={RINGS[0]} fill={`url(#${glowId})`} />

        {RINGS.map((r, i) => (
          <circle
            key={r}
            r={r}
            fill="none"
            stroke="rgb(var(--rgb-primary) / 0.3)"
            strokeWidth={i === 0 ? 1.6 : 1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Bearing spokes every 30°. */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={0}
              y1={0}
              x2={Math.cos(a) * RINGS[0]}
              y2={Math.sin(a) * RINGS[0]}
              stroke="rgb(var(--rgb-primary) / 0.14)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Contacts. Each flashes as the arm crosses its bearing. */}
        {contacts.map((c, i) => (
          <circle
            key={i}
            className="radar-contact"
            cx={Math.cos(c.angle) * RINGS[0] * c.dist}
            cy={Math.sin(c.angle) * RINGS[0] * c.dist}
            r={c.size}
            fill="rgb(var(--rgb-accent))"
            style={{ animationDelay: `${(c.phase * 4).toFixed(2)}s` }}
          />
        ))}

        {/* The sweep arm, rotating in-plane. */}
        <g className="radar-sweep">
          <path
            d={`M 0 0 L ${RINGS[0]} ${-RINGS[0] * 0.42} A ${RINGS[0]} ${RINGS[0]} 0 0 1 ${RINGS[0]} ${RINGS[0] * 0.42} Z`}
            fill={`url(#${gradId})`}
          />
          <line
            x1={0}
            y1={0}
            x2={RINGS[0]}
            y2={0}
            stroke="rgb(var(--rgb-accent) / 0.85)"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
        </g>

        <circle r={2.4} fill="rgb(var(--rgb-accent))" />
      </g>

      {/* Vertical rise off the dish — a few structure spikes at contact points,
          drawn outside the squashed group so they stand up out of the plane. */}
      {contacts.slice(0, 5).map((c, i) => {
        const x = CX + Math.cos(c.angle) * RINGS[0] * c.dist;
        const y = CY + Math.sin(c.angle) * RINGS[0] * c.dist * SQUASH;
        const h = 10 + c.size * 5;
        return (
          <line
            key={`riser-${i}`}
            className="radar-contact"
            x1={x}
            y1={y}
            x2={x}
            y2={y - h}
            stroke="rgb(var(--rgb-accent) / 0.55)"
            strokeWidth={0.9}
            style={{ animationDelay: `${(c.phase * 4).toFixed(2)}s` }}
          />
        );
      })}

      {/* Softens the top edge so the dish sits in the panel. */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={`url(#${fadeId})`} />
    </svg>
  );
}
