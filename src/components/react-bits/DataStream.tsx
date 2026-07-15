import React from 'react';
import { motion } from 'motion/react';

interface DataStreamProps {
  text: string;
  speed?: number;
  className?: string;
  active?: boolean;
}

export default function DataStream({
  text,
  speed = 15,
  className = '',
  active = true
}: DataStreamProps) {
  // A flowing text effect that looks like data moving through a pipeline
  return (
    <div className={`relative overflow-hidden w-full whitespace-nowrap flex items-center ${className}`}>
      {active && text.length > 50 ? (
        <motion.div
          className="flex space-x-8"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
        >
          <span>{text}</span>
          <span>{text}</span>
        </motion.div>
      ) : (
        <span className="truncate">{text}</span>
      )}
    </div>
  );
}
