import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getAudioContext, playSystemBoot } from "../../lib/soundEngine";

interface BelfryBootScreenProps {
  onComplete: () => void;
}

export default function BelfryBootScreen({ onComplete }: BelfryBootScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const bootSoundRef = useRef<{ stop: () => void } | void>(null);

  const bootMessages = [
    "INITIALIZING COLD BOOT SEQUENCE...",
    "LOADING KERNEL BELFRY_OS_v2.8.4",
    "ESTABLISHING SECURE TUNNEL TO BELFRY CORE...",
    "DECRYPTING CORE MODULES...",
    "MOUNTING FORENSIC DATA VOLUMES...",
    "ORACLE LINK STABILIZED.",
    "BEYOND_SIGHT PROTOCOLS ACTIVE.",
    "USER_IDENTITY: DETECTIVE",
    "SYSTEM READY."
  ];

  const startBoot = () => {
    setHasStarted(true);
    getAudioContext();
    bootSoundRef.current = playSystemBoot(true);
  };

  useEffect(() => {
    if (!hasStarted) return;
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < bootMessages.length) {
        setLogs(prev => [...prev, bootMessages[currentIdx]]);
        setProgress(((currentIdx + 1) / bootMessages.length) * 100);
        currentIdx++;
      } else {
        clearInterval(interval);
        setTimeout(() => setIsDone(true), 200);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [hasStarted]);

  const handleSkip = () => {
    if (!hasStarted) return; // Prevent skipping before start
    if (bootSoundRef.current) bootSoundRef.current.stop();
    getAudioContext(); // Initialize audio
    onComplete();
  };

  if (isDone) {
    setTimeout(handleSkip, 200);
  }

  if (!hasStarted) {
    return (
      <div 
        className="fixed inset-0 z-[100] bg-bg-void flex flex-col items-center justify-center font-mono cursor-pointer select-none"
        onClick={startBoot}
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="w-32 h-32 relative flex items-center justify-center mb-8">
          <img src="/assets/icons/iconbelfry.png" alt="Belfry Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgb(var(--rgb-accent) / 0.7)]" />
        </div>
        <motion.div
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-cyan-primary text-sm font-bold tracking-[0.3em] uppercase"
        >
          CLICK TO INITIATE SYSTEM BOOT
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-bg-void flex flex-col items-center justify-center font-mono overflow-hidden select-none cursor-pointer"
      onClick={handleSkip}
    >
      {/* Background glitch effect */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="w-full h-full bg-grid-pattern animate-hex-pulse-flicker" />
      </div>

      <div className="w-full max-w-lg p-8 space-y-8 relative">
        {/* Animated Spire Logo */}
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1 }}
            className="w-24 h-24 relative flex items-center justify-center"
          >
            <img src="/assets/icons/iconbelfry.png" alt="Belfry Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgb(var(--rgb-accent) / 0.5)]" />
            <div className="absolute inset-0 bg-cyan-primary/10 animate-hex-pulse-flicker mix-blend-screen pointer-events-none" />
          </motion.div>
          <motion.h1 
            initial={{ letterSpacing: "1em", opacity: 0 }}
            animate={{ letterSpacing: "0.4em", opacity: 1 }}
            transition={{ duration: 1.5 }}
            className="text-cyan-primary text-2xl font-black font-orbitron tracking-[0.4em] ml-[0.4em]"
          >
            BELFRY
          </motion.h1>
        </div>

        {/* Boot Logs */}
        <div className="space-y-1 h-32 overflow-hidden border-l border-cyan-primary/20 pl-4">
          <AnimatePresence>
            {logs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[13px] text-cyan-dim flex items-center"
              >
                <span className="text-cyan-primary mr-2 opacity-50">{">"}</span>
                {log}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-1 bg-cyan-primary/10 w-full relative">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-cyan-primary shadow-[0_0_8px_var(--color-accent-primary)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between text-[12px] text-cyan-dim font-bold tracking-widest">
            <span>SYS_LOAD: {Math.round(progress)}%</span>
            <span>OS_v2.8.4</span>
          </div>
        </div>

        {/* Skip Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={shouldReduceMotion ? { opacity: 0.5 } : { opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center text-[12px] text-text-dim uppercase tracking-[0.2em] pt-4"
        >
          CLICK ANYWHERE TO SKIP INITIALIZATION
        </motion.div>
      </div>
      
      {/* HUD scanning line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-cyan-primary/30 shadow-[0_0_10px_var(--color-accent-primary)] animate-scanline-vertical pointer-events-none" />
    </motion.div>
  );
}
