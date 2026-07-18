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

/**
 * Content already revealed, keyed by trigger + text.
 *
 * Module scope on purpose: it has to outlive the component. Switching modules
 * unmounts the page, so returning to it remounted every DecryptText and
 * replayed the scramble over unchanged data — a stale scan result re-animated
 * (and re-chimed) as though a fresh scan had just completed, which read as the
 * app inventing a result out of nowhere. The decrypt should fire when data
 * arrives, not every time you look at it.
 */
const revealed = new Set<string>();

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

    // Already seen this exact content for this trigger — show it settled and
    // skip the animation and the sound entirely.
    const revealKey = `${String(trigger)}::${text}`;
    if (revealed.has(revealKey)) {
      setDisplayChars(chars.map((char) => ({ char, resolved: true })));
      return;
    }
    revealed.add(revealKey);

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
    let lastPaint = 0;

    const settle = () => {
      if (hasResolved) return;
      hasResolved = true;
      // Guarantee the final state regardless of how the loop ended.
      setDisplayChars(chars.map((char) => ({ char, resolved: true })));
      stopDecypheringLoop();
      if (!silent) playSuccessChime();
    };

    const tick = () => {
      const elapsed = performance.now() - startTime;

      if (elapsed >= maxLockTime) {
        settle();
        return;
      }

      // Repaint at ~24fps rather than every frame. The scramble is illegible
      // either way, but at 60fps this pushed a setState per frame per instance
      // — and the dashboard mounts one per result name and per details string,
      // so a multi-result scan was driving hundreds of React renders a second.
      if (elapsed - lastPaint >= 42) {
        lastPaint = elapsed;
        setDisplayChars(
          chars.map((char, index) => {
            if (char === " ") return { char: " ", resolved: true };
            if (elapsed >= lockTimes[index]) return { char, resolved: true };
            const randomChar = scrambleSet[Math.floor(Math.random() * scrambleSet.length)];
            return { char: randomChar, resolved: false };
          }),
        );
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    // Backstop. requestAnimationFrame does not run in a backgrounded tab, so a
    // purely rAF-driven settle left the text scrambled forever if the user
    // switched away mid-decrypt — it never recovered on return.
    const backstop = setTimeout(settle, maxLockTime + 120);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(backstop);
      stopDecypheringLoop();
    };
  }, [text, duration, scrambleSet, trigger, silent]);

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
