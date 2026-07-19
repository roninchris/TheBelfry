import React, { useState, useEffect, useRef, useMemo } from "react";
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

/**
 * Partially-resolved text. The reference assembles its lettering out of noise
 * rather than fading it in — at 40% through you can read "IN...ON" of
 * "INCOMING TRANSMISSION" with garbage between. Characters lock in from a
 * scattered order, not left to right, so the word appears to precipitate.
 */
function resolveText(full: string, ratio: number, order: number[]): string {
  if (ratio >= 1) return full;
  const lockCount = Math.floor(full.length * Math.max(0, ratio));
  const locked = new Set(order.slice(0, lockCount));
  return full
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      if (locked.has(i)) return ch;
      return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    })
    .join("");
}

function makeTelemetry(): string {
  const seg = () => randomFrom(GLYPHS, 3 + Math.floor(Math.random() * 5));
  const sym = () => randomFrom(SYMBOLS, 1 + Math.floor(Math.random() * 2));
  return `//${sym()}${seg()} ${seg()}${sym()}${seg()} ${sym()} ${seg()}_${Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0")}`;
}

const LABEL_TEXT = "SYSTEM INITIALIZING";

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

/**
 * Edge chips. In the reference these are not a uniform ruler — they are
 * irregular vertical dashes of varying length, brightness and spacing, which is
 * what stops the frame reading as a evenly-ticked scale.
 */
function EdgeTicks({ position, seed }: { position: "top" | "bottom"; seed: number[] }) {
  return (
    <div
      className={`absolute inset-x-0 ${position === "top" ? "top-0" : "bottom-0"} h-20 overflow-hidden pointer-events-none select-none`}
      aria-hidden="true"
    >
      {seed.map((v, i) => {
        const left = (i / seed.length) * 100 + (v % 3) * 0.4;
        const height = 6 + (v % 5) * 7;
        const bright = v % 7 === 0;
        return (
          <span
            key={i}
            className="absolute w-px bg-white"
            style={{
              left: `${left}%`,
              [position]: `${(v % 4) * 9}px`,
              height: `${height}px`,
              opacity: bright ? 0.75 : 0.2 + (v % 3) * 0.12
            }}
          />
        );
      })}
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

  // Fixed per mount so the frame furniture does not reshuffle on every render.
  const tickSeed = useMemo(
    () => Array.from({ length: 46 }, () => Math.floor(Math.random() * 100)),
    []
  );
  // Scattered lock-in order for the label's characters.
  const labelOrder = useMemo(() => {
    const idx = LABEL_TEXT.split("").map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, []);

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
        setTimeout(() => setIsDone(true), 600);
      }
      // Paced so the staged build (seed -> mark -> frame -> label -> title) is
      // actually legible; at 150ms the whole sequence was over in 1.3s and the
      // phases blurred into one another. Skippable at any point.
    }, 230);

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

  /**
   * Staged reveal, matching the reference's order: a light seed alone, then the
   * mark, then the frame, then the label assembling out of noise, and only then
   * the title. Previously everything appeared at once on click, which skipped
   * the entire build.
   */
  const showBeam = progress > 8;
  const showMark = progress > 12;
  const showBrackets = progress > 32;
  const showLabel = progress > 42;
  const showTitle = progress > 68;

  const labelRatio = Math.max(0, Math.min(1, (progress - 42) / 26));
  const label = resolveText(LABEL_TEXT, labelRatio, labelOrder);

  // Beam widens from the centre seed as the sequence climbs.
  const beamScale = Math.max(0.04, Math.min(1, (progress - 6) / 55));

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

      {showMark && (
        <>
          <EdgeTicks position="top" seed={tickSeed} />
          <EdgeTicks position="bottom" seed={tickSeed} />
          <SideScale side="left" />
          <SideScale side="right" />
        </>
      )}

      {/* The seed: a single sliver of light at dead centre, which is all the
          reference shows on its first frame before anything else exists. */}
      {hasStarted && !showMark && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="h-px w-24"
            style={{
              background: "linear-gradient(90deg, transparent, #fff, transparent)",
              boxShadow: "0 0 18px 3px rgb(var(--rgb-accent) / 0.7)"
            }}
          />
          <div className="absolute h-5 w-px bg-white/70" />
        </div>
      )}

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
            style={{
              ["--mark-src" as string]: MARK_SRC,
              ["--dot-pitch" as string]: "9px",
              visibility: hasStarted && !showMark ? "hidden" : "visible"
            }}
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
      {showBeam && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
          <div className="relative px-14 py-3">
            {/* The beam grows out of the centre seed rather than appearing at
                full width — scaleX is driven by progress so it widens with the
                sequence, matching the reference's slit-to-band build. */}
            <div
              className="absolute inset-y-0 -inset-x-[42vw] pointer-events-none"
              style={{ transform: `scaleX(${beamScale})`, transformOrigin: "center" }}
            >
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

            {/* Corner brackets snap in before the lettering does. */}
            {showBrackets &&
              [
                "top-0 left-0 border-t border-l",
                "top-0 right-0 border-t border-r",
                "bottom-0 left-0 border-b border-l",
                "bottom-0 right-0 border-b border-r"
              ].map((pos, i) => (
                <span key={i} className={`absolute w-5 h-5 border-white/80 ${pos}`} />
              ))}

            {/* min sizes hold the banner's footprint steady while the lines
                arrive, so the brackets do not jump as text appears. */}
            <div className="relative text-center min-w-[19rem] md:min-w-[26rem]">
              <div className="h-6 flex items-center justify-center">
                {showLabel && (
                  <span className="font-display text-sm md:text-base tracking-[0.42em] text-white/90 uppercase">
                    {settled ? "SYSTEM OPERATIONAL" : label}
                  </span>
                )}
              </div>

              <div className="h-10 md:h-14 flex items-center justify-center">
                {showTitle && (
                  <span className="font-display text-4xl md:text-6xl font-black tracking-[0.14em] text-white uppercase leading-none drop-shadow-[0_0_18px_rgb(var(--rgb-accent)/0.5)]">
                    THE BELFRY
                  </span>
                )}
              </div>

              <div className="h-4 flex items-center justify-center">
                {showLabel && (
                  <span className="font-mono text-[12px] tracking-[0.25em] text-white/45 uppercase truncate">
                    {subCode}
                  </span>
                )}
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
