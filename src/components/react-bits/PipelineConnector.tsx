import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface PipelineConnectorProps {
  active?: boolean;
  color?: string;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export default function PipelineConnector({ 
  active = false, 
  color = "rgba(239, 68, 68, 0.5)", 
  className = "",
  orientation = 'vertical'
}: PipelineConnectorProps) {
  const shouldReduceMotion = useReducedMotion();
  const isHorizontal = orientation === 'horizontal';

  return (
    <div 
      className={`relative flex justify-center items-center ${
        isHorizontal ? 'h-full w-16 shrink-0' : 'h-12 w-full'
      } ${className}`}
    >
      {/* The main wire line */}
      <div 
        className={`absolute bg-red-threat/20 transition-colors duration-300 ${
          isHorizontal 
            ? 'left-0 right-0 h-[2px] top-1/2 -translate-y-1/2' 
            : 'top-0 bottom-0 w-[2px] left-1/2 -translate-x-1/2'
        }`} 
      />
      
      {/* Animated flow pulse */}
      {active && !shouldReduceMotion && (
        <motion.div
          className={`absolute bg-red-threat shadow-[0_0_8px_#ef4444] ${
            isHorizontal ? 'h-[2px]' : 'w-[2px]'
          }`}
          initial={
            isHorizontal 
              ? { left: "-10%", width: "0%" } 
              : { top: "-10%", height: "0%" }
          }
          animate={
            isHorizontal 
              ? { left: "100%", width: ["0%", "20%", "0%"] } 
              : { top: "100%", height: ["0%", "20%", "0%"] }
          }
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Center arrow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-void border border-border-hairline/20 rounded-full p-0.5 z-10">
        <motion.div
          animate={active ? (isHorizontal ? { x: [0, 2, 0] } : { y: [0, 2, 0] }) : {}}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            {isHorizontal ? (
              <path 
                d="M4 2L7 5L4 8" 
                stroke={active ? "rgba(239, 68, 68, 0.8)" : "rgba(239, 68, 68, 0.3)"} 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            ) : (
              <path 
                d="M2 4L5 7L8 4" 
                stroke={active ? "rgba(239, 68, 68, 0.8)" : "rgba(239, 68, 68, 0.3)"} 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            )}
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
