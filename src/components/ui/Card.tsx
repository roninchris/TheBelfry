import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  headerAccent?: "cyan" | "amber" | "red" | "green" | "none";
  className?: string;
}

export default function Card({
  children,
  title,
  subtitle,
  action,
  headerAccent = "cyan",
  className = "",
  ...props
}: CardProps) {
  const accentBorderColor = {
    cyan: "border-cyan-primary/50",
    amber: "border-amber-alert/50",
    red: "border-red-threat/50",
    green: "border-green-verified/50",
    none: "border-border-hairline/25",
  };

  return (
    <div
      className={`bg-bg-panel/75 backdrop-blur-sm border border-border-hairline/20 p-4 relative flex flex-col h-full bat-panel-clip ${className}`}
      {...props}
    >
      {/* Top right subtle angle corner ticks */}
      <div className="absolute top-0 right-0 w-4 h-4 bg-gradient-to-bl from-cyan-primary/10 to-transparent pointer-events-none" />

      {/* Card Header */}
      {(title || subtitle || action) && (
        <div className="flex justify-between items-start mb-3 pb-2 border-b border-border-hairline/20">
          <div className="space-y-0.5">
            {title && (
              <h3 className="font-chakra text-xs font-bold uppercase tracking-wider text-text-primary flex items-center">
                {headerAccent !== "none" && (
                  <span className={`w-1.5 h-3 bg-current mr-2 transform -skew-x-12 inline-block ${
                    headerAccent === "cyan" ? "text-cyan-primary shadow-[0_0_6px_#2ff1e4]" :
                    headerAccent === "amber" ? "text-amber-alert shadow-[0_0_6px_#ff9d2e]" :
                    headerAccent === "red" ? "text-red-threat shadow-[0_0_6px_#ff3b4e]" :
                    "text-green-verified shadow-[0_0_6px_#35e58a]"
                  }`} />
                )}
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="font-share text-[13px] text-text-dim/80 tracking-wide uppercase">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="ml-2 z-10">{action}</div>}
        </div>
      )}

      {/* Card Body */}
      <div className="flex-1 text-xs text-text-primary/90">
        {children}
      </div>

      {/* Corner bracket ticks */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-dim/40 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-dim/40 pointer-events-none" />
    </div>
  );
}
