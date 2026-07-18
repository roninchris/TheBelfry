import React from "react";
import { motion, useReducedMotion } from "motion/react";

interface BinaryRainProps {
  density?: number;
  color?: string;
  className?: string;
}

export default function BinaryRain({ 
  density = 15, 
  color = "rgb(var(--rgb-accent) / 0.4)", 
  className = "" 
}: BinaryRainProps) {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) return null;

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden mix-blend-screen ${className}`}>
      {[...Array(density)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-[12px] font-mono whitespace-pre-wrap leading-tight"
          style={{
            color: color,
            left: `${(i / density) * 100}%`,
            width: '10px',
            writingMode: 'vertical-rl'
          }}
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: "100%", opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear"
          }}
        >
          {Array.from({ length: 20 + Math.floor(Math.random() * 20) })
            .map(() => (Math.random() > 0.5 ? "1" : "0"))
            .join("")}
        </motion.div>
      ))}
    </div>
  );
}
