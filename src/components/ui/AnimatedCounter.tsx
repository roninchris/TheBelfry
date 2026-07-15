import React, { useEffect, useState, useRef } from "react";
import { playCountTick } from "../../lib/soundEngine";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export default function AnimatedCounter({ 
  value, 
  duration = 1000, 
  className = "",
  prefix = "",
  suffix = ""
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    
    if (startValue === endValue) return;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) startTimeRef.current = currentTime;
      const progress = Math.min((currentTime - startTimeRef.current) / duration, 1);
      
      const nextValue = Math.floor(progress * (endValue - startValue) + startValue);
      
      if (nextValue !== displayValue) {
        setDisplayValue(nextValue);
        playCountTick();
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = endValue;
        startTimeRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      startTimeRef.current = null;
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}
