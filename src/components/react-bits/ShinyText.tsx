import React from 'react';

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export default function ShinyText({
  text,
  disabled = false,
  speed = 5,
  className = '',
}: ShinyTextProps) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`bg-[linear-gradient(120deg,rgba(179,226,230,0.85)_30%,rgba(255,255,255,1)_50%,rgba(179,226,230,0.85)_70%)] bg-[length:200%_100%] bg-clip-text text-transparent animate-shine ${className}`}
      style={{
        animationDuration: disabled ? '0s' : animationDuration,
        display: 'inline-block',
      }}
    >
      {text}
    </span>
  );
}
