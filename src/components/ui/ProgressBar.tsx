import React, { useEffect, useState } from "react";

interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  variant?: "cyan" | "amber" | "red" | "green";
  showValue?: boolean;
  segmented?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  label,
  variant = "cyan",
  showValue = true,
  segmented = true,
  className = "",
}: ProgressBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Add a tiny delay to trigger CSS transition on load
    const timer = setTimeout(() => {
      setWidth(value);
    }, 150);
    return () => clearTimeout(timer);
  }, [value]);

  const variantColors = {
    cyan: "bg-cyan-primary shadow-[0_0_8px_var(--color-accent-primary)]",
    amber: "bg-amber-alert shadow-[0_0_8px_var(--color-amber-alert)]",
    red: "bg-red-threat shadow-[0_0_8px_var(--color-red-threat)]",
    green: "bg-green-verified shadow-[0_0_8px_#35e58a]",
  };

  const textColors = {
    cyan: "text-cyan-primary",
    amber: "text-amber-alert",
    red: "text-red-threat",
    green: "text-green-verified",
  };

  return (
    <div className={`space-y-1.5 font-share ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs tracking-wider uppercase text-text-dim">
          {label && <span className="truncate">{label}</span>}
          {showValue && (
            <span className={`font-mono text-xs ${textColors[variant]} font-semibold`}>
              {width.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {/* Bar Container */}
      <div className="relative h-2.5 bg-bg-void/80 border border-border-hairline/25 p-0.5 overflow-hidden">
        {/* Glow track underlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-primary/5 to-transparent pointer-events-none" />

        {/* Dynamic bar */}
        <div
          className={`h-full transition-all duration-1000 cubic-bezier(0.175, 0.885, 0.32, 1.275) ${variantColors[variant]}`}
          style={{ width: `${width}%` }}
        >
          {/* Scanning sweep reflection on the bar */}
          <div className="w-full h-full relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
          </div>
        </div>

        {/* Segmented notches overlay */}
        {segmented && (
          <div className="absolute inset-0 flex justify-between pointer-events-none px-1">
            {Array.from({ length: 15 }).map((_, idx) => (
              <div key={idx} className="w-[1px] h-full bg-bg-void/40" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
