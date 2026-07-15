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
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
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
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}
