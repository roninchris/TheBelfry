import React from "react";

/**
 * Map module glyph — a heading chevron.
 *
 * Drawn rather than taken from the icon set because the stock map glyphs are
 * all folded-paper or pin shapes, which say "directions" rather than
 * "tactical". The chevron reads as a bearing marker: the thing on the plane
 * that tells you which way you are facing, which is what this module is for.
 *
 * The notch in the trailing edge is what keeps it from reading as a plain
 * triangle at rail size — it is the difference between an arrowhead and a
 * wedge, and at 20px it is doing most of the work.
 *
 * Stroke-based and inheriting `currentColor` so it sits beside the lucide
 * icons in the sidebar without looking like a different family.
 */
export default function MapModuleIcon({ className = "" }: { className?: string }) {
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
      <path d="M12 2.6 L20.4 20.6 L12 16.2 L3.6 20.6 Z" />
    </svg>
  );
}
