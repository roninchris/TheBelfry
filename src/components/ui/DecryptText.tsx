import { useState, useEffect } from "react";
import { playDecypheringLoop, stopDecypheringLoop, playSuccessChime } from "../../lib/soundEngine";

interface DecryptTextProps {
  text: string;
  duration?: number; // Total duration in ms
  scrambleSet?: string;
  trigger?: any;
  className?: string;
  silent?: boolean;
}

const DEFAULT_SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*<>/\\";

export default function DecryptText({
  text,
  duration = 900,
  scrambleSet = DEFAULT_SCRAMBLE,
  trigger,
  className = "",
  silent = false,
}: DecryptTextProps) {
  const [displayChars, setDisplayChars] = useState<{ char: string; resolved: boolean }[]>([]);

  useEffect(() => {
    if (!text) {
      setDisplayChars([]);
      return;
    }

    const chars = text.split("");
    const totalChars = chars.length;

    // Calculate individual lock times (in ms) for each character position
    const lockTimes = chars.map((char, index) => {
      if (char === " ") return 0;
      // Stagger lock-in based on position with some randomized jitter
      const baseDelay = (index / totalChars) * (duration * 0.7);
      const jitter = Math.random() * (duration * 0.3);
      return baseDelay + jitter;
    });

    const maxLockTime = Math.max(...lockTimes, duration);
    const startTime = performance.now();

    // Initialize with fully scrambled characters
    const initial = chars.map((char, index) => {
      if (char === " ") {
        return { char: " ", resolved: true };
      }
      const randomChar = scrambleSet[Math.floor(Math.random() * scrambleSet.length)];
      return { char: randomChar, resolved: false };
    });
    setDisplayChars(initial);

    let animationFrameId: number;
    playDecypheringLoop();
    let hasResolved = false;

    const tick = () => {
      const elapsed = performance.now() - startTime;

      const updated = chars.map((char, index) => {
        if (char === " ") {
          return { char: " ", resolved: true };
        }
        if (elapsed >= lockTimes[index]) {
          return { char, resolved: true };
        }
        const randomChar = scrambleSet[Math.floor(Math.random() * scrambleSet.length)];
        return { char: randomChar, resolved: false };
      });

      setDisplayChars(updated);

      if (elapsed < maxLockTime) {
        animationFrameId = requestAnimationFrame(tick);
      } else {
        // Final fallback to ensure all characters are perfectly locked
        setDisplayChars(chars.map((char) => ({ char, resolved: true })));
        if (!hasResolved) {
          hasResolved = true;
          stopDecypheringLoop();
          if (!silent) {
            playSuccessChime();
          }
        }
      }
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      stopDecypheringLoop();
    };
  }, [text, duration, scrambleSet, trigger]);

  return (
    <span className={`font-mono inline ${className}`} id="decrypt-scramble-wrapper">
      {displayChars.map((item, index) => (
        <span
          key={index}
          id={`decrypt-char-${index}`}
          className={
            item.resolved
              ? "text-text-primary transition-all duration-150"
              : "text-cyan-dim/70 font-bold"
          }
        >
          {item.char}
        </span>
      ))}
    </span>
  );
}
