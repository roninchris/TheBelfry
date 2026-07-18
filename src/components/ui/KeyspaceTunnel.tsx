import React from "react";

interface KeyspaceTunnelProps {
  /** Gates in flight. More reads denser, not faster. */
  gates?: number;
  className?: string;
}

const CYCLE_SECONDS = 7;

/**
 * Ambient keyspace tunnel for brute-force mode.
 *
 * Purely decorative: it is sweeping nothing, reports nothing, and is not
 * interactive. It fills the sidebar while a run has not produced candidates.
 *
 * Built on real CSS 3D — a perspective container with a preserve-3d scene —
 * rather than a flat SVG pretending at depth. Each gate is a square that flies
 * from far Z toward the viewer while rotating, on a staggered negative delay so
 * the tunnel is already full on first paint instead of building up. Everything
 * is transform/opacity, so it composites on the GPU.
 *
 * Deliberately a different *kind* of motion from HolographicProjector: that one
 * rotates an object you look at, this one moves the viewer through a space.
 */
export default function KeyspaceTunnel({
  gates = 12,
  className = "",
}: KeyspaceTunnelProps) {
  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}
      style={{ perspective: "460px" }}
      aria-hidden="true"
    >
      {/* Depth haze — hides the point where gates pop in at the far end. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgb(var(--rgb-alert, 255 157 46) / 0.10) 0%, transparent 62%)",
        }}
      />

      <div className="keyspace-scene absolute inset-0 flex items-center justify-center">
        {Array.from({ length: gates }).map((_, i) => (
          <div
            key={i}
            className="keyspace-gate absolute"
            style={{
              width: "58%",
              aspectRatio: "1",
              border: "1px solid var(--color-amber-alert)",
              boxShadow:
                "0 0 14px -4px var(--color-amber-alert), inset 0 0 18px -8px var(--color-amber-alert)",
              // Alternating square/diamond keeps the tunnel from looking like
              // one extruded shape.
              ["--gate-spin" as string]: `${i % 2 === 0 ? 0 : 45}deg`,
              // Negative delay: the tunnel starts already populated.
              animationDelay: `${-(CYCLE_SECONDS / gates) * i}s`,
            }}
          />
        ))}

        {/* Corner rails running down the tunnel, so travel is legible even
            between gates. */}
        {[
          ["0%", "0%"],
          ["100%", "0%"],
          ["0%", "100%"],
          ["100%", "100%"],
        ].map(([x, y], i) => (
          <div
            key={`rail-${i}`}
            className="absolute w-px pointer-events-none"
            style={{
              left: x,
              top: y,
              height: "140%",
              transform: `translate(-50%, -50%) rotateX(88deg) translateZ(-${140 + i * 4}px)`,
              background:
                "linear-gradient(to bottom, transparent, var(--color-amber-alert), transparent)",
              opacity: 0.18,
            }}
          />
        ))}
      </div>

      {/* Vanishing point */}
      <div
        className="keyspace-core absolute rounded-full pointer-events-none"
        style={{
          width: "12%",
          aspectRatio: "1",
          background:
            "radial-gradient(circle, var(--color-amber-alert) 0%, transparent 70%)",
        }}
      />

      {/* Framing brackets, so it sits in the panel as an instrument rather than
          a loose graphic. */}
      {[
        ["top-2 left-2", "border-t border-l"],
        ["top-2 right-2", "border-t border-r"],
        ["bottom-2 left-2", "border-b border-l"],
        ["bottom-2 right-2", "border-b border-r"],
      ].map(([pos, edge], i) => (
        <div
          key={`bracket-${i}`}
          className={`absolute w-3 h-3 pointer-events-none ${pos} ${edge}`}
          style={{ borderColor: "var(--color-amber-alert)", opacity: 0.4 }}
        />
      ))}
    </div>
  );
}
