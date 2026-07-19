import React, { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { getAudioContext, playSystemBoot } from "../../lib/soundEngine";

interface BelfryBootScreenProps {
  onComplete: () => void;
}

const MARK_SRC = "url(/assets/icons/iconbelfry.png)";

/** Header/footer telemetry strings. Fixed, not randomised, so the screen does
 *  not appear to be reporting different readings on every load. */
const HEADER_CODE = "///*&DFL/JKH/474SDIK/JB01 / 16.8 + P.A.I.D.H E / 00.347";

const BOOT_MESSAGES = [
  "INITIALIZING COLD BOOT SEQUENCE",
  "LOADING KERNEL BELFRY_OS_v2.8.4",
  "ESTABLISHING SECURE TUNNEL TO BELFRY CORE",
  "DECRYPTING CORE MODULES",
  "MOUNTING FORENSIC DATA VOLUMES",
  "ORACLE LINK STABILIZED",
  "BEYOND_SIGHT PROTOCOLS ACTIVE",
  "USER_IDENTITY: DETECTIVE",
  "SYSTEM READY"
];

/** Ruler ticks along the top and bottom edges. */
function EdgeTicks({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      className={`absolute inset-x-0 ${position === "top" ? "top-0" : "bottom-0"} h-6 overflow-hidden pointer-events-none select-none`}
      aria-hidden="true"
    >
      <div className="boot-edge-ticks flex items-start gap-[19px] px-2 w-[200%]">
        {Array.from({ length: 160 }).map((_, i) => (
          <span
            key={i}
            className={`shrink-0 w-px bg-cyan-primary ${
              i % 8 === 0 ? "h-4 opacity-45" : "h-2 opacity-20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Vertical scale marks at the left and right edges. */
function SideScale({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={`absolute ${side === "left" ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none select-none`}
      aria-hidden="true"
    >
      {[14, 26, 40, 26, 14].map((h, i) => (
        <span
          key={i}
          className="w-px bg-cyan-primary"
          style={{ height: `${h}px`, opacity: i === 2 ? 0.5 : 0.22 }}
        />
      ))}
    </div>
  );
}

export default function BelfryBootScreen({ onComplete }: BelfryBootScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const bootSoundRef = useRef<{ stop: () => void } | void>(null);
  const hasCompletedRef = useRef(false);

  const startBoot = () => {
    setHasStarted(true);
    getAudioContext();
    bootSoundRef.current = playSystemBoot(true);
  };

  useEffect(() => {
    if (!hasStarted) return;
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < BOOT_MESSAGES.length) {
        setStatusIndex(currentIdx);
        setProgress(((currentIdx + 1) / BOOT_MESSAGES.length) * 100);
        currentIdx++;
      } else {
        clearInterval(interval);
        setTimeout(() => setIsDone(true), 200);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [hasStarted]);

  // Completion is one-way: a later re-render, or a click landing in the same
  // tick, must not fire onComplete twice.
  const handleSkip = () => {
    if (!hasStarted) return;
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    if (bootSoundRef.current) bootSoundRef.current.stop();
    getAudioContext();
    onComplete();
  };

  useEffect(() => {
    if (!isDone) return;
    const timer = setTimeout(handleSkip, 200);
    return () => clearTimeout(timer);
  }, [isDone]);

  const settled = progress >= 100;

  return (
    <div
      className="fixed inset-0 z-[100] bg-bg-void overflow-hidden select-none cursor-pointer font-display"
      onClick={hasStarted ? handleSkip : startBoot}
    >
      {/* Depth: a cold pool of light behind the mark, then scanlines over it. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 45%, rgb(var(--rgb-accent) / 0.10) 0%, transparent 70%)"
        }}
      />
      <div className="absolute inset-0 crt-scanlines opacity-[0.18] pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />

      <EdgeTicks position="top" />
      <EdgeTicks position="bottom" />
      <SideScale side="left" />
      <SideScale side="right" />

      {/* Top telemetry strip */}
      <div className="absolute top-6 inset-x-0 text-center pointer-events-none">
        <span className="font-mono text-[13px] tracking-[0.35em] text-cyan-primary/45 uppercase">
          {HEADER_CODE}
        </span>
      </div>

      {/* ===== THE MARK ===== */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[min(46vh,420px)] aspect-[3/4]">
          {/* Unlit dot bed */}
          <div
            className="absolute inset-0 dot-matrix-mark text-cyan-primary/15"
            style={{ ["--mark-src" as string]: MARK_SRC, ["--dot-pitch" as string]: "9px" }}
          />
          {/* Lit dots, revealed upward from the base as the sequence advances,
              so the tower powers on rather than simply fading in. */}
          <div
            className={`absolute inset-0 dot-matrix-mark text-cyan-primary ${settled ? "boot-mark-live" : ""}`}
            style={{
              ["--mark-src" as string]: MARK_SRC,
              ["--dot-pitch" as string]: "9px",
              // No CSS transition on the reveal. clip-path transitions are
              // driven by the same frame loop as animations, so they do not
              // advance while the tab is backgrounded — the tower would stay
              // fully dark for the whole sequence and then pop. The sequence
              // already steps every 150ms, which reads as a climb on its own.
              clipPath: `inset(${100 - progress}% 0 0 0)`,
              filter: "drop-shadow(0 0 10px rgb(var(--rgb-accent) / 0.55))"
            }}
          />
        </div>
      </div>

      {/* ===== TITLE BANNER ===== */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
        <div className="relative px-14 py-3">
          {/* Light bar behind the lettering, as in the reference */}
          <div
            className="absolute inset-y-0 -inset-x-[38vw]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgb(var(--rgb-accent) / 0.16) 35%, rgb(var(--rgb-accent) / 0.16) 65%, transparent 100%)"
            }}
          />
          {/* Corner brackets */}
          {[
            "top-0 left-0 border-t border-l",
            "top-0 right-0 border-t border-r",
            "bottom-0 left-0 border-b border-l",
            "bottom-0 right-0 border-b border-r"
          ].map((pos, i) => (
            <span key={i} className={`absolute w-4 h-4 border-white/70 ${pos}`} />
          ))}

          <div className="relative text-center">
            <div className="font-display text-sm md:text-base tracking-[0.42em] text-white/90 uppercase">
              {settled ? "SYSTEM OPERATIONAL" : "SYSTEM INITIALIZING"}
            </div>
            <div className="font-display text-4xl md:text-6xl font-black tracking-[0.14em] text-white uppercase leading-none mt-0.5">
              THE BELFRY
            </div>
            <div className="font-mono text-[12px] tracking-[0.25em] text-white/45 uppercase mt-1.5 truncate">
              {HEADER_CODE}
            </div>
          </div>
        </div>
      </div>

      {/* ===== STATUS FOOTER ===== */}
      <div className="absolute bottom-10 inset-x-0 px-10 pointer-events-none">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end justify-between font-mono text-[12px] tracking-[0.2em] uppercase mb-2">
            <span className="text-cyan-primary/70 truncate">
              {hasStarted ? BOOT_MESSAGES[statusIndex] : "AWAITING OPERATOR"}
            </span>
            <span className="text-cyan-primary/50 tabular-nums shrink-0 ml-4">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-px w-full bg-cyan-primary/15 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-cyan-primary shadow-[0_0_10px_var(--color-accent-primary)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Prompt / skip hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={shouldReduceMotion ? { opacity: 0.55 } : { opacity: [0.3, 0.75, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-4 inset-x-0 text-center font-mono text-[12px] tracking-[0.3em] text-text-dim uppercase pointer-events-none"
      >
        {hasStarted ? "CLICK ANYWHERE TO SKIP" : "CLICK TO INITIATE SYSTEM BOOT"}
      </motion.div>
    </div>
  );
}
