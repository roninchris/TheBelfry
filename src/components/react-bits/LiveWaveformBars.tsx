import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface LiveWaveformBarsProps {
  active?: boolean;
  bars?: number;
  color?: string;
  className?: string;
}

export default function LiveWaveformBars({
  active = true,
  bars = 5,
  color = "rgb(47, 241, 228)",
  className = ""
}: LiveWaveformBarsProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={`flex items-center space-x-1.5 h-10 px-2 border-l border-r border-border-hairline/10 ${className}`}>
      {[...Array(bars)].map((_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ height: "20%" }}
          animate={
            active && !shouldReduceMotion
              ? {
                  height: ["20%", "80%", "40%", "100%", "20%"]
                }
              : { height: "20%" }
          }
          transition={{
            duration: 0.8 + Math.random() * 0.5,
            repeat: Infinity,
            delay: Math.random() * 0.5,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
}
