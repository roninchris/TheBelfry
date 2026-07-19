import React from "react";

/**
 * Map module glyph — a ground plane seen in perspective, with a viewport cut.
 *
 * Drawn rather than taken from the icon set because none of the stock map
 * glyphs read as *tactical*: they are all folded-paper or pin shapes, which
 * say "directions", not "surveillance plane". The perspective quad carries the
 * same idea as the module itself — a surface being looked down at from above
 * and slightly to the side — and the inner square is the reticle window.
 *
 * Stroke-based and inheriting `currentColor` so it sits in the sidebar next to
 * the lucide icons without looking like a different family.
 */
export default function MapPlaneIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* The plane: wider at the near edge, so it reads as receding. */}
      <path d="M9.2 3.4 L21.4 8.1 L14.8 20.6 L2.6 15.9 Z" />
      {/* Viewport cut, skewed to sit flat on the plane. */}
      <path d="M10.6 9.4 L14.9 11.1 L13.3 14.9 L9 13.2 Z" opacity={0.85} />
      {/* Near-corner tick: the notch that keeps the silhouette from reading
          as a plain rhombus at small sizes. */}
      <path d="M5.6 14.7 L7.4 12.1" opacity={0.5} />
    </svg>
  );
}
