import React from "react";

interface RegistrationFrameProps {
  children?: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export default function RegistrationFrame({
  children,
  className = "",
  glow = false,
}: RegistrationFrameProps) {
  return (
    <div className={`relative ${className}`} id="registration-frame-wrapper">
      {/* Content wrapper */}
      <div className="relative z-10 w-full h-full">{children}</div>

      {/* Decorative view-finder overlays (pointer-events-none) */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden" id="registration-decorators">
        {/* Corner Brackets */}
        <div
          className={`absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-cyan-primary/50 ${
            glow ? "shadow-[0_0_8px_rgb(var(--rgb-accent) / 0.3)]" : ""
          }`}
        />
        <div
          className={`absolute top-1 right-1 w-2.5 h-2.5 border-t border-r border-cyan-primary/50 ${
            glow ? "shadow-[0_0_8px_rgb(var(--rgb-accent) / 0.3)]" : ""
          }`}
        />
        <div
          className={`absolute bottom-1 left-1 w-2.5 h-2.5 border-b border-l border-cyan-primary/50 ${
            glow ? "shadow-[0_0_8px_rgb(var(--rgb-accent) / 0.3)]" : ""
          }`}
        />
        <div
          className={`absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r border-cyan-primary/50 ${
            glow ? "shadow-[0_0_8px_rgb(var(--rgb-accent) / 0.3)]" : ""
          }`}
        />

        {/* Dotted Edge Ticks */}
        {/* Top */}
        <div className="absolute top-1 left-5 right-5 h-1">
          <svg width="100%" height="100%" className="block">
            <line
              x1="0"
              y1="50%"
              x2="100%"
              y2="50%"
              stroke="rgb(var(--rgb-accent) / 0.35)"
              strokeDasharray="1 3"
              strokeWidth="1"
            />
          </svg>
        </div>
        {/* Bottom */}
        <div className="absolute bottom-1 left-5 right-5 h-1">
          <svg width="100%" height="100%" className="block">
            <line
              x1="0"
              y1="50%"
              x2="100%"
              y2="50%"
              stroke="rgb(var(--rgb-accent) / 0.35)"
              strokeDasharray="1 3"
              strokeWidth="1"
            />
          </svg>
        </div>
        {/* Left */}
        <div className="absolute top-5 bottom-5 left-1 w-1">
          <svg width="100%" height="100%" className="block">
            <line
              x1="50%"
              y1="0"
              x2="50%"
              y2="100%"
              stroke="rgb(var(--rgb-accent) / 0.35)"
              strokeDasharray="1 3"
              strokeWidth="1"
            />
          </svg>
        </div>
        {/* Right */}
        <div className="absolute top-5 bottom-5 right-1 w-1">
          <svg width="100%" height="100%" className="block">
            <line
              x1="50%"
              y1="0"
              x2="50%"
              y2="100%"
              stroke="rgb(var(--rgb-accent) / 0.35)"
              strokeDasharray="1 3"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Tiny registration crosses/markers */}
        <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[12px] font-mono text-cyan-primary/35">
          +
        </span>
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[12px] font-mono text-cyan-primary/35">
          +
        </span>
      </div>
    </div>
  );
}
