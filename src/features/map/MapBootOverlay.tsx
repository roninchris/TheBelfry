import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { getMapOpenDuration, playMapOpen } from "../../lib/soundEngine";

/**
 * Map deployment sequence.
 *
 * Plays once on arrival: the console unfolding a tactical plane rather than a
 * page transitioning. Four beats — strike, unfold, frame, hand off — paced to
 * the length of the opening sting so the visual lands with the sound instead
 * of drifting against it. That pacing is read from the decoded buffer, never
 * hardcoded, which is the same discipline the boot screen settled on.
 */

/** Used until the sample has decoded, and if it never does. */
const FALLBACK_MS = 900;

interface MapBootOverlayProps {
  onComplete: () => void;
}

export default function MapBootOverlay({ onComplete }: MapBootOverlayProps) {
  // Locked on first render: a duration that changed mid-sequence would restart
  // the timings underneath the animation.
  const durationMs = useMemo(() => {
    const seconds = getMapOpenDuration();
    return seconds ? seconds * 1000 : FALLBACK_MS;
  }, []);

  const [phase, setPhase] = useState(0);

  /**
   * One-way latch on completion.
   *
   * The boot screen shipped a bug where every re-render queued another
   * handoff; a ref that only ever flips forward is what stops that class of
   * problem, so it is worth carrying here too.
   */
  const doneRef = useRef(false);

  /**
   * The sting fires once per mount, never twice.
   *
   * StrictMode deliberately runs effects twice on the same fiber (mount →
   * cleanup → mount) to surface exactly this kind of non-idempotent side
   * effect, and it did: the opening sound played twice. A ref survives that
   * simulated remount, so the second pass is a no-op.
   */
  const stingRef = useRef(false);

  // `onComplete` is read through a ref so it can never appear in this effect's
  // dependencies. It used to, and an unstable callback from the parent re-ran
  // the whole sequence — restarting the timers and replaying the sound.
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    if (!stingRef.current) {
      stingRef.current = true;
      playMapOpen();
    }

    // Beat boundaries as fractions of the sting.
    const marks: [number, number][] = [
      [0.16, 1], // unfold
      [0.42, 2], // frame + grid
      [0.72, 3], // reticle settles
    ];
    const timers = marks.map(([at, next]) =>
      window.setTimeout(() => setPhase(next), durationMs * at)
    );

    const finish = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      completeRef.current();
    }, durationMs);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [durationMs]);

  const unit = durationMs / 1000;

  return (
    <motion.div
      className="absolute inset-0 z-50 bg-bg-void overflow-hidden pointer-events-none"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Beat 1 — the strike. A single hairline snaps across the centre. */}
      <motion.div
        className="absolute left-0 right-0 top-1/2 h-[1px] origin-center"
        style={{ background: "rgb(var(--rgb-accent))", boxShadow: "0 0 12px rgb(var(--rgb-accent))" }}
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: 1, opacity: phase >= 2 ? 0.25 : 1 }}
        transition={{ duration: unit * 0.16, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Beat 2 — the plane unfolds from that line. */}
      <motion.div
        className="absolute inset-0"
        initial={{ clipPath: "inset(50% 0% 50% 0%)" }}
        animate={{ clipPath: phase >= 1 ? "inset(0% 0% 0% 0%)" : "inset(50% 0% 50% 0%)" }}
        transition={{ duration: unit * 0.26, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Perspective mesh — the ground plane arriving. */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--rgb-primary) / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--rgb-primary) / 0.35) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 78%)",
          }}
        />

        {/* Sweep passing over the mesh as it lands. */}
        <motion.div
          className="absolute inset-y-0 w-1/3"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(var(--rgb-accent) / 0.16), transparent)",
          }}
          initial={{ x: "-40%" }}
          animate={{ x: phase >= 1 ? "220%" : "-40%" }}
          transition={{ duration: unit * 0.5, ease: "linear" }}
        />
      </motion.div>

      {/* Beat 3 — the frame snaps to the corners. */}
      {[
        "top-6 left-6 border-t-2 border-l-2",
        "top-6 right-6 border-t-2 border-r-2",
        "bottom-6 left-6 border-b-2 border-l-2",
        "bottom-6 right-6 border-b-2 border-r-2",
      ].map((pos, i) => (
        <motion.div
          key={i}
          className={`absolute w-12 h-12 border-cyan-primary ${pos}`}
          initial={{ opacity: 0, scale: 1.6 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 1.6 }}
          transition={{ duration: unit * 0.18, ease: [0.16, 1, 0.3, 1], delay: i * unit * 0.02 }}
        />
      ))}

      {/* Reticle converging on centre. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="relative w-40 h-40"
          initial={{ opacity: 0, scale: 1.8, rotate: -25 }}
          animate={{
            opacity: phase >= 2 ? 1 : 0,
            scale: phase >= 3 ? 1 : 1.8,
            rotate: phase >= 3 ? 0 : -25,
          }}
          transition={{ duration: unit * 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-0 rounded-full border border-cyan-primary/40" />
          <div className="absolute inset-[22%] rounded-full border border-cyan-primary/70" />
          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] -translate-x-1/2 bg-cyan-primary/50" />
          <div className="absolute top-1/2 left-0 right-0 h-[1px] -translate-y-1/2 bg-cyan-primary/50" />
          <div className="absolute left-1/2 top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 border border-cyan-primary bg-cyan-primary/30" />
        </motion.div>
      </div>

      {/* Beat 4 — designation. */}
      <motion.div
        className="absolute inset-x-0 bottom-[22%] text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: phase >= 3 ? 1 : 0, y: phase >= 3 ? 0 : 8 }}
        transition={{ duration: unit * 0.16 }}
      >
        <div className="font-display text-lg font-black tracking-[0.55em] text-cyan-text uppercase">
          Map
        </div>
        <div className="font-mono text-[11px] text-cyan-text/45 tracking-[0.3em] uppercase mt-1">
          Tactical plane deployed
        </div>
      </motion.div>
    </motion.div>
  );
}
