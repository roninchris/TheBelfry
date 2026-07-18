import React from "react";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  showCornerTicks?: boolean;
  showScanlines?: boolean;
  glow?: boolean;
  hoverGlow?: boolean;
  clipSize?: "sm" | "md" | "none";
  className?: string;
  /**
   * Classes for the inner content wrapper.
   *
   * Children do not live directly inside the panel element — they sit in a
   * plain block wrapper, so `flex flex-col` on `className` styles that wrapper
   * and never reaches the children. Any `flex-1` a caller puts on its own
   * content is therefore inert, which is why panels have repeatedly grown to
   * their content instead of bounding it. Pass `contentClassName="flex flex-col"`
   * to make the wrapper a flex container so `flex-1`/`min-h-0` work as written.
   */
  contentClassName?: string;
}

export default function GlassPanel({
  children,
  showCornerTicks = true,
  showScanlines = false,
  glow = false,
  hoverGlow = false,
  clipSize = "md",
  className = "",
  contentClassName = "",
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
      {/* Top-edge Glass Sheens */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none z-10" />
      <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-[0.5px] pointer-events-none z-10" />

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

      {/* Main Content */}
      <div className={`relative z-10 w-full h-full min-h-0 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
