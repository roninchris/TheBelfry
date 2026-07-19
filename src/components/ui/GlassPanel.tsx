import React from "react";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  showCornerTicks?: boolean;
  showScanlines?: boolean;
  glow?: boolean;
  hoverGlow?: boolean;
  clipSize?: "sm" | "md" | "none";
  className?: string;
}

/**
 * Children render directly inside the panel element.
 *
 * They used to sit in a plain block wrapper, which meant `flex flex-col` on a
 * caller's `className` styled that wrapper and never reached the children — so
 * every `flex-1` written inside a panel was inert, and panels grew to their
 * content instead of bounding it. An audit found 46 panels carrying that
 * pattern. Rather than opt each one in through a prop, the wrapper is gone, so
 * a caller's flex classes now apply to the children they were always meant for.
 *
 * The decorations are all absolutely positioned, so they stay out of the flex
 * flow. They also render before the children, which is what keeps content
 * painted above them now that nothing carries an explicit stacking context.
 */
export default function GlassPanel({
  children,
  showCornerTicks = true,
  showScanlines = false,
  glow = false,
  hoverGlow = false,
  clipSize = "md",
  className = "",
  ...props
}: GlassPanelProps) {
  const clipClass = 
    clipSize === "md" 
      ? "bat-panel-clip" 
      : clipSize === "sm" 
        ? "bat-panel-clip-sm" 
        : "";

  return (
    <div
      className={`relative bg-bg-panel backdrop-blur-xl border border-border-hairline/20 text-text-primary ${clipClass} ${
        glow ? "cyan-glow-border" : ""
      } ${
        hoverGlow ? "hover:border-cyan-primary/40 hover:cyan-glow-border transition-all duration-300" : ""
      } ${className}`}
      {...props}
    >
      {/* Top-edge Glass Sheens. z-0, not z-10: with the content wrapper gone the
          children carry no stacking context of their own, so a z-10 sheen would
          paint over the top few pixels of real content. */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none z-0" />
      <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-[0.5px] pointer-events-none z-0" />

      {/* Background CRT scanline texture */}
      {showScanlines && (
        <div className="absolute inset-0 crt-scanlines opacity-10 pointer-events-none" />
      )}

      {/* Futuristic Grid Accent underlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-primary/[0.01] to-transparent pointer-events-none" />

      {/* L-shaped corner brackets (camera-reticle style) */}
      {showCornerTicks && (
        <>
          {/* Top Left */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-primary/50 pointer-events-none" />
          {/* Top Right */}
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-primary/50 pointer-events-none" />
          {/* Bottom Left */}
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-primary/50 pointer-events-none" />
          {/* Bottom Right */}
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-primary/50 pointer-events-none" />
        </>
      )}

      {children}
    </div>
  );
}
