import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface SplitTextProps {
  text: string;
  delay?: number;
  duration?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  onAnimationComplete?: () => void;
}

export default function SplitText({
  text,
  delay = 0.03,
  duration = 0.4,
  className = '',
  animateBy = 'letters',
  onAnimationComplete,
}: SplitTextProps) {
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
          initial={{ transform: 'translate3d(0, 30px, 0)', opacity: 0 }}
          animate={isAnimated ? { transform: 'translate3d(0, 0, 0)', opacity: 1 } : {}}
          transition={{
            duration: duration,
            delay: index * delay,
            ease: [0.2, 0.65, 0.3, 0.9],
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
