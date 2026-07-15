import React from "react";

interface VignetteBackdropProps {
  className?: string;
  intensity?: "light" | "medium" | "dark";
}

export default function VignetteBackdrop({
  className = "",
  intensity = "medium",
}: VignetteBackdropProps) {
  const intensityMap = {
    light: "rgba(2, 9, 18, 0.4)",
    medium: "rgba(2, 9, 18, 0.75)",
    dark: "rgba(2, 9, 18, 0.95)",
  };

  const endColor = intensityMap[intensity];

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-0 mix-blend-multiply select-none transition-all duration-300 ${className}`}
      style={{
        background: `radial-gradient(circle at 50% 50%, transparent 20%, ${endColor} 100%)`,
      }}
      id="vignette-backdrop-overlay"
    />
  );
}
