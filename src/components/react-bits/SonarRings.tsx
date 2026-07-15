import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface SonarRingsProps {
  active?: boolean;
  rings?: number;
  color?: string;
  className?: string;
}

export default function SonarRings({
  active = true,
  rings = 3,
  color = "rgba(47, 241, 228, 0.5)",
  className = ""
}: SonarRingsProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!active) return null;

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {[...Array(rings)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{ borderColor: color }}
          initial={{ width: 0, height: 0, opacity: 1 }}
          animate={shouldReduceMotion ? { width: '100%', height: '100%', opacity: 0.5 } : {
            width: ['0%', '100%'],
            height: ['0%', '100%'],
            opacity: [1, 0]
          }}
          transition={{
            duration: shouldReduceMotion ? 0 : 3,
            repeat: Infinity,
            delay: i * (3 / rings),
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
}
