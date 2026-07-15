import React from "react";
import { motion, useReducedMotion } from "motion/react";

export default function FactoryThroughputBar({ 
  active, 
  direction = "right" 
}: { 
  active: boolean; 
  direction?: "left" | "right" 
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="w-full flex flex-col space-y-0.5 py-0.5 opacity-80">
      {[0, 1, 2].map((lane) => (
        <div 
          key={lane} 
          className={`w-full h-1 bg-bg-void overflow-hidden relative border-y border-border-hairline/5 flex items-center ${
            lane === 1 ? "opacity-100" : "opacity-40"
          }`}
        >
          {active && !shouldReduceMotion ? (
            <motion.div
              className="flex space-x-1.5 whitespace-nowrap absolute left-0"
              initial={{ x: direction === "right" ? "-33.33%" : "0%" }}
              animate={{ 
                x: direction === "right" ? ["-33.33%", "0%"] : ["0%", "-33.33%"] 
              }}
              transition={{ 
                duration: 1.5 + lane * 0.4, 
                ease: "linear", 
                repeat: Infinity,
                delay: lane * -0.3
              }}
            >
              {[...Array(60)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-0.5 skew-x-[-25deg] ${
                    lane === 1 ? "bg-cyan-primary/70 shadow-[0_0_4px_#2ff1e4]" : "bg-cyan-primary/40"
                  }`} 
                />
              ))}
            </motion.div>
          ) : (
            <div className={`flex space-x-1.5 whitespace-nowrap absolute ${active ? "opacity-40" : "opacity-10"}`}>
              {[...Array(60)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-0.5 skew-x-[-25deg] ${active ? "bg-cyan-primary" : "bg-text-dim"}`} 
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
