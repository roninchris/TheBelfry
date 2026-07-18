import React, { useMemo } from "react";

/** Flat-top hex geometry for a given circumradius. */
function hexPath(cx: number, cy: number, r: number) {
  const h = (r * Math.sqrt(3)) / 2;
  return `M ${cx} ${cy - r} L ${cx + h} ${cy - r / 2} L ${cx + h} ${cy + r / 2} L ${cx} ${cy + r} L ${cx - h} ${cy + r / 2} L ${cx - h} ${cy - r / 2} Z`;
}

interface HoneycombFieldProps {
  /** Hex circumradius in px. */
  radius?: number;
  className?: string;
}

/**
 * A genuinely tessellated honeycomb across the whole viewport — the structural
 * "material" of the Batcomputer, as opposed to the two narrow edge strips in
 * HexagonBackground.
 *
 * Density is uniform, but a CSS mask weights it heavily toward the left/right
 * margins and fades the centre, so the tessellation frames module content
 * rather than sitting behind text. A sparse subset of cells is "energized":
 * filled and pulsing, which is what keeps the grid reading as a live surface
 * instead of wallpaper.
 */
export default function HoneycombField({
  radius = 34,
  className = "",
}: HoneycombFieldProps) {
  // Generated once — this is atmosphere, it must not re-render.
  const { cells, energized, vw, vh } = useMemo(() => {
    // Oversized fixed canvas + preserveAspectRatio="none" would distort the
    // hexes, so instead the SVG is sized generously and simply overflows.
    const vw = 2200;
    const vh = 1400;
    const h = (radius * Math.sqrt(3)) / 2;
    const colStep = h * 2;
    const rowStep = radius * 1.5;

    const cells: { d: string; cx: number; cy: number }[] = [];
    for (let row = 0; row * rowStep < vh + radius * 2; row++) {
      for (let col = 0; col * colStep < vw + colStep; col++) {
        const cx = col * colStep + (row % 2 ? h : 0);
        const cy = row * rowStep;
        cells.push({ d: hexPath(cx, cy, radius), cx, cy });
      }
    }

    // ~4% of cells light up, biased toward the edges where the mask lets them
    // actually be seen.
    const energized = cells
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => {
        const edgeBias = Math.abs(c.cx / vw - 0.5) > 0.3 ? 0.09 : 0.015;
        return Math.random() < edgeBias;
      })
      .map(({ c, i }) => ({
        ...c,
        delay: Math.random() * 9,
        duration: 4 + Math.random() * 6,
        key: i,
      }));

    return { cells, energized, vw, vh };
  }, [radius]);

  return (
    <div
      className={`honeycomb-field pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full text-cyan-primary"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* The whole lattice is one concatenated path. Rendering ~1100 separate
            <path> elements tripled the page's DOM node count for zero visual
            difference — the geometry is identical either way. */}
        <path
          className="honeycomb-lattice"
          d={cells.map((c) => c.d).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.1}
        />
        {energized.map((c) => (
          <path
            key={`e${c.key}`}
            className="honeycomb-cell-live"
            d={c.d}
            style={
              {
                "--cell-delay": `${c.delay}s`,
                "--cell-duration": `${c.duration}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </svg>
    </div>
  );
}
