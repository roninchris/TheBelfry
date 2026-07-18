import React from "react";

interface HolographicProjectorProps {
  /** Meridians in the rotating volume. More reads denser, not faster. */
  meridians?: number;
  className?: string;
}

/**
 * Ambient holographic volume.
 *
 * Purely decorative: it is projecting nothing, reports nothing, and is not
 * interactive. It exists to keep an otherwise dead panel feeling powered.
 *
 * The volume is a stack of ellipses sharing one centre. Each meridian is
 * animated on scaleX (see .holo-meridian) with a staggered delay, so the stack
 * sweeps around a vertical axis and reads as a rotating wireframe sphere
 * without any 3D maths or canvas. Everything is CSS transform/opacity, so it
 * composites on the GPU and costs nothing next to the rest of the module.
 */
export default function HolographicProjector({
  meridians = 9,
  className = "",
}: HolographicProjectorProps) {
  const cx = 100;
  const cy = 100;
  const r = 62;

  // Latitude rings: evenly spaced slices through the sphere, so their radii
  // follow the circle rather than being spaced by eye.
  const latitudes = [-0.75, -0.45, 0, 0.45, 0.75].map((t) => ({
    cy: cy + t * r,
    rx: r * Math.sqrt(1 - t * t),
    ry: r * 0.13 * Math.sqrt(1 - t * t) + 2,
  }));

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full text-cyan-primary holo-jitter"
        aria-hidden="true"
      >
        <defs>
          {/* Emitter glow under the volume */}
          <radialGradient id="holo-base-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          {/* Projection cone rising from the emitter */}
          <linearGradient id="holo-cone" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="holo-band-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          {/* Clips the drifting band to the sphere so it never spills */}
          <clipPath id="holo-volume-clip">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>

        {/* Projection cone + emitter pad */}
        <path d={`M ${cx - 46} 180 L ${cx - 26} ${cy} L ${cx + 26} ${cy} L ${cx + 46} 180 Z`} fill="url(#holo-cone)" />
        <ellipse cx={cx} cy={180} rx={52} ry={9} fill="url(#holo-base-glow)" />
        <ellipse cx={cx} cy={180} rx={30} ry={5} fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50" />
        <ellipse cx={cx} cy={180} rx={38} ry={7} fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="3 5" className="opacity-30" />

        {/* Equator + outer silhouette */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="0.9" className="opacity-35" />
        <circle cx={cx} cy={cy} r={r} fill="currentColor" className="opacity-[0.04]" />

        {/* Latitude rings — static; the meridians supply the rotation */}
        {latitudes.map((lat, i) => (
          <ellipse
            key={`lat-${i}`}
            cx={cx}
            cy={lat.cy}
            rx={lat.rx}
            ry={lat.ry}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.7"
            className="opacity-25"
          />
        ))}

        {/* Rotating meridians */}
        {Array.from({ length: meridians }).map((_, i) => (
          <ellipse
            key={`mer-${i}`}
            cx={cx}
            cy={cy}
            rx={r}
            ry={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            className="holo-meridian opacity-40"
            style={{ animationDelay: `${-(14 / meridians) * i}s` }}
          />
        ))}

        {/* Vertical axis */}
        <line x1={cx} y1={cy - r - 8} x2={cx} y2={cy + r + 8} stroke="currentColor" strokeWidth="0.5" className="opacity-20" />

        {/* Build band drifting through the volume */}
        <g clipPath="url(#holo-volume-clip)">
          <rect x={cx - r} y={cy - 2} width={r * 2} height="3" fill="url(#holo-band-fill)" className="holo-band" />
        </g>

        {/* Core */}
        <circle cx={cx} cy={cy} r="3" fill="currentColor" className="opacity-80" />
        <circle cx={cx} cy={cy} r="9" fill="none" stroke="currentColor" strokeWidth="0.6" className="opacity-30" />

        {/* Containment brackets — corners of the projection field */}
        {[
          [30, 30, 1, 1],
          [170, 30, -1, 1],
          [30, 150, 1, -1],
          [170, 150, -1, -1],
        ].map(([bx, by, sx, sy], i) => (
          <path
            key={`bracket-${i}`}
            d={`M ${bx} ${by + sy * 11} L ${bx} ${by} L ${bx + sx * 11} ${by}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="opacity-35"
          />
        ))}
      </svg>
    </div>
  );
}
