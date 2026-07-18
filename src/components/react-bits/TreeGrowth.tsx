import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface TreeGrowthProps {
  active?: boolean;
  color?: string;
  className?: string;
}

export default function TreeGrowth({ active = true, color = "rgb(var(--rgb-accent) / 0.8)", className = "" }: TreeGrowthProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!active) return null;

  const nodeVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1 }
  };

  const lineVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { pathLength: 1, opacity: 1 }
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg width="200" height="200" viewBox="0 0 200 200" className="overflow-visible">
        {/* Lines */}
        <motion.path
          d="M100 100 L50 50"
          stroke={color}
          strokeWidth="2"
          fill="none"
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={lineVariants}
          transition={{ duration: 0.4, delay: 0.1 }}
        />
        <motion.path
          d="M100 100 L150 50"
          stroke={color}
          strokeWidth="2"
          fill="none"
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={lineVariants}
          transition={{ duration: 0.4, delay: 0.2 }}
        />
        <motion.path
          d="M100 100 L50 150"
          stroke={color}
          strokeWidth="2"
          fill="none"
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={lineVariants}
          transition={{ duration: 0.4, delay: 0.3 }}
        />
        <motion.path
          d="M100 100 L150 150"
          stroke={color}
          strokeWidth="2"
          fill="none"
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={lineVariants}
          transition={{ duration: 0.4, delay: 0.4 }}
        />
        
        <motion.path
          d="M150 50 L180 20"
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={lineVariants}
          transition={{ duration: 0.3, delay: 0.5 }}
        />
        <motion.path
          d="M150 50 L120 20"
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={lineVariants}
          transition={{ duration: 0.3, delay: 0.5 }}
        />
        <motion.path
          d="M50 50 L20 20"
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={lineVariants}
          transition={{ duration: 0.3, delay: 0.4 }}
        />

        {/* Root Node */}
        <motion.circle
          cx="100" cy="100" r="10" fill={color}
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={nodeVariants}
          transition={{ duration: 0.3 }}
        />
        
        {/* Child Nodes */}
        <motion.circle
          cx="50" cy="50" r="6" fill={color}
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={nodeVariants}
          transition={{ duration: 0.3, delay: 0.4 }}
        />
        <motion.circle
          cx="150" cy="50" r="6" fill={color}
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={nodeVariants}
          transition={{ duration: 0.3, delay: 0.5 }}
        />
        <motion.circle
          cx="50" cy="150" r="6" fill={color}
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={nodeVariants}
          transition={{ duration: 0.3, delay: 0.6 }}
        />
        <motion.circle
          cx="150" cy="150" r="6" fill={color}
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={nodeVariants}
          transition={{ duration: 0.3, delay: 0.7 }}
        />
        
        {/* Grandchild Nodes */}
        <motion.circle
          cx="180" cy="20" r="4" fill={color}
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={nodeVariants}
          transition={{ duration: 0.3, delay: 0.7 }}
        />
        <motion.circle
          cx="120" cy="20" r="4" fill={color}
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={nodeVariants}
          transition={{ duration: 0.3, delay: 0.7 }}
        />
        <motion.circle
          cx="20" cy="20" r="4" fill={color}
          initial="hidden"
          animate={shouldReduceMotion ? "visible" : (active ? "visible" : "hidden")}
          variants={nodeVariants}
          transition={{ duration: 0.3, delay: 0.6 }}
        />
      </svg>
    </div>
  );
}
