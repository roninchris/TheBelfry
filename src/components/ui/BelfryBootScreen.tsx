import React, { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { getAudioContext, playSystemBoot } from "../../lib/soundEngine";

interface BelfryBootScreenProps {
  onComplete: () => void;
}

const MARK_SRC = "url(/assets/icons/iconbelfry.png)";

/**
 * Telemetry gibberish. Generated rather than hardcoded, and re-rolled on a
 * timer while the sequence runs, so the readout looks like a live feed instead
 * of one fixed string sitting on screen.
 */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SYMBOLS = "/*&;:|!.,+-_><[]{}#%";

function randomFrom(set: string, n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += set[Math.floor(Math.random() * set.length)];
  return out;
}

function makeTelemetry(): string {
  const seg = () => randomFrom(GLYPHS, 3 + Math.floor(Math.random() * 5));
  const sym = () => randomFrom(SYMBOLS, 1 + Math.floor(Math.random() * 2));
  return `//${sym()}${seg()} ${seg()}${sym()}${seg()} ${sym()} ${seg()}_${Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0")}`;
}

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
  const [telemetry, setTelemetry] = useState(() => makeTelemetry());
  const [subCode, setSubCode] = useState(() => makeTelemetry());

  // Re-roll the readouts while the sequence runs. Idle is left static so the
  // waiting screen is calm and only the boot itself looks busy.
  useEffect(() => {
    if (!hasStarted) return;
    const iv = setInterval(() => {
      setTelemetry(makeTelemetry());
      setSubCode(makeTelemetry());
    }, 110);
    return () => clearInterval(iv);
  }, [hasStarted]);

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

      {/* Top telemetry strip — only once the machine is actually doing something. */}
      {hasStarted && (
        <div className="absolute top-6 inset-x-0 text-center pointer-events-none">
          <span className="font-mono text-[13px] tracking-[0.35em] text-cyan-primary/45 uppercase">
            {telemetry}
          </span>
        </div>
      )}

      {/* ===== THE MARK ===== */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[min(46vh,420px)] aspect-[3/4]">
          {/* Idle: the whole mark breathes at low opacity. Once started this
              becomes the unlit bed that the lit layer is revealed over. */}
          <div
            className={`absolute inset-0 dot-matrix-mark text-cyan-primary ${
              hasStarted ? "opacity-[0.15]" : "boot-idle-breathe"
            }`}
            style={{ ["--mark-src" as string]: MARK_SRC, ["--dot-pitch" as string]: "9px" }}
          />
          {/* Lit dots, revealed upward from the base as the sequence advances,
              so the tower powers on rather than simply fading in. */}
          {hasStarted && (
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
          )}
        </div>
      </div>

      {/* ===== TITLE BANNER =====
          Deliberately absent until the operator commits. Before the click the
          screen is just a dormant mark and an invitation; the banner and its
          beam are the response to that click. */}
      {hasStarted && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
          <div className="relative px-14 py-3">
            {/* The beam. Struck outward from the centre on start, then held with
                a slow bloom — a light source rather than a painted gradient. */}
            <div className="boot-beam absolute inset-y-0 -inset-x-[42vw] pointer-events-none">
              <div
                className="boot-beam-core absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgb(var(--rgb-accent) / 0.05) 18%, rgb(var(--rgb-accent) / 0.30) 42%, rgb(var(--rgb-accent) / 0.42) 50%, rgb(var(--rgb-accent) / 0.30) 58%, rgb(var(--rgb-accent) / 0.05) 82%, transparent 100%)",
                  filter: "blur(6px)"
                }}
              />
              {/* Hot filament through the middle of the beam */}
              <div
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgb(var(--rgb-accent) / 0.7) 45%, #fff 50%, rgb(var(--rgb-accent) / 0.7) 55%, transparent 100%)",
                  boxShadow: "0 0 14px 2px rgb(var(--rgb-accent) / 0.55)"
                }}
              />
            </div>

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
              <div className="font-display text-4xl md:text-6xl font-black tracking-[0.14em] text-white uppercase leading-none mt-0.5 drop-shadow-[0_0_18px_rgb(var(--rgb-accent)/0.5)]">
                THE BELFRY
              </div>
              <div className="font-mono text-[12px] tracking-[0.25em] text-white/45 uppercase mt-1.5 truncate">
                {subCode}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== STATUS FOOTER ===== */}
      {hasStarted && (
        <div className="absolute bottom-10 inset-x-0 px-10 pointer-events-none">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end justify-between font-mono text-[12px] tracking-[0.2em] uppercase mb-2">
              <span className="text-cyan-primary/70 truncate">
                {BOOT_MESSAGES[statusIndex]}
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
      )}

      {/* ===== INVITATION =====
          Centred on the mark before start, because that is the only thing the
          screen is asking for at that point. Once running it demotes to a small
          skip hint at the edge so it stops competing with the banner. */}
      {!hasStarted ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={shouldReduceMotion ? { opacity: 0.85 } : { opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center pointer-events-none"
        >
          <span className="font-display text-sm md:text-base font-black tracking-[0.4em] text-cyan-primary uppercase drop-shadow-[0_0_12px_rgb(var(--rgb-accent)/0.6)]">
            CLICK TO INITIATE SYSTEM BOOT
          </span>
        </motion.div>
      ) : (
        <div className="absolute bottom-4 inset-x-0 text-center font-mono text-[12px] tracking-[0.3em] text-text-dim/70 uppercase pointer-events-none">
          CLICK ANYWHERE TO SKIP
        </div>
      )}
    </div>
  );
}
