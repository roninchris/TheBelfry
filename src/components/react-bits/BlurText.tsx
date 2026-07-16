import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface BlurTextProps {
  text: string;
  delay?: number;
  duration?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  onAnimationComplete?: () => void;
}

export default function BlurText({
  text,
  delay = 0.03,
  duration = 0.4,
  className = '',
  animateBy = 'letters',
  onAnimationComplete,
}: BlurTextProps) {
  // Splitting on a captured group keeps the whitespace as its own element.
  // A plain split(' ') consumes the separator, and since every element renders
  // as an inline-block, the words then run together into one unreadable string.
  const elements =
    animateBy === 'words' ? text.split(/(\s+)/).filter(Boolean) : text.split('');
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    setIsAnimated(true);
  }, []);

  return (
    <span className={`inline ${className}`}>
      {elements.map((char, index) => (
        <motion.span
          key={index}
          initial={{ filter: 'blur(10px)', opacity: 0, y: 5 }}
          animate={isAnimated ? { filter: 'blur(0px)', opacity: 1, y: 0 } : {}}
          transition={{
            duration: duration,
            delay: index * delay,
            ease: 'easeOut',
          }}
          onAnimationComplete={
            index === elements.length - 1 ? onAnimationComplete : undefined
          }
          className="inline-block whitespace-pre"
        >
          {/^\s+$/.test(char) ? '\u00A0'.repeat(char.length) : char}
        </motion.span>
      ))}
    </span>
  );
}
