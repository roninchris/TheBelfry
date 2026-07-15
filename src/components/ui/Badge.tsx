import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: "cyan" | "amber" | "red" | "green" | "dim";
  size?: "xs" | "sm" | "md";
  className?: string;
}

export default function Badge({
  children,
  variant = "cyan",
  size = "sm",
  className = "",
  ...props
}: BadgeProps) {
  const variantStyles = {
    cyan: "bg-cyan-primary/10 border-cyan-primary/40 text-cyan-text cyan-glow",
    amber: "bg-amber-alert/10 border-amber-alert/40 text-amber-alert amber-glow",
    red: "bg-red-threat/10 border-red-threat/40 text-red-threat red-glow",
    green: "bg-green-verified/10 border-green-verified/40 text-green-verified",
    dim: "bg-text-dim/10 border-text-dim/30 text-text-dim",
  };

  const sizeStyles = {
    xs: "text-[11px] px-2 py-0.5 font-share tracking-wider uppercase",
    sm: "text-xs px-2.5 py-1 font-chakra tracking-wider uppercase font-semibold",
    md: "text-sm px-3.5 py-1.5 font-chakra tracking-widest uppercase font-bold",
  };

  return (
    <span
      className={`inline-flex items-center border-l-2 border-y border-r border-solid transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      style={{
        clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)",
      }}
      {...props}
    >
      <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-current animate-hex-pulse-flicker inline-block" />
      {children}
    </span>
  );
}
