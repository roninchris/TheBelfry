import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";
import { playParticleAssembly } from "../../lib/soundEngine";

interface ParticleRevealProps {
  active?: boolean;
  duration?: number; // Total duration in ms
  icon?: LucideIcon;
  className?: string;
  size?: number;
}

interface Particle {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  delay: number;
  size: number;
}

export default function ParticleReveal({
  active = true,
  duration = 1000,
  icon: Icon,
  className = "",
  size = 64,
}: ParticleRevealProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;

    playParticleAssembly();

    const numParticles = 45;
    const computedParticles: Particle[] = [];

    // Define coordinates on a concentric ring/hexagon boundary to assemble into
    for (let i = 0; i < numParticles; i++) {
      // Scatter initial particles in a wide field
      const angle = Math.random() * Math.PI * 2;
      const startDistance = 140 + Math.random() * 80;
      const startX = 150 + Math.cos(angle) * startDistance;
      const startY = 150 + Math.sin(angle) * startDistance;

      // Target assembly coordinates (forming a neat hex-outline of radius 45 in the center)
      const targetAngle = (i * Math.PI * 2) / numParticles;
      const targetRadius = 45 + (i % 2 === 0 ? 0 : 8); // Concentric ring teeth
      const targetX = 150 + Math.cos(targetAngle) * targetRadius;
      const targetY = 150 + Math.sin(targetAngle) * targetRadius;

      computedParticles.push({
        id: i,
        startX,
        startY,
        targetX,
        targetY,
        delay: Math.random() * 0.4, // Staggered delays up to 400ms
        size: Math.random() * 2 + 1.5,
      });
    }

    setParticles(computedParticles);
  }, [active]);

  if (!active) return null;

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`} id="particle-reveal-container">
      <svg
        viewBox="0 0 300 300"
        className="w-[280px] h-[280px] text-cyan-primary pointer-events-none"
      >
        {/* Assemble lines (glowing circuit lines connecting particles dynamically) */}
        {particles.slice(0, 15).map((p, idx) => (
          <motion.line
            key={`reveal-line-${idx}`}
            x1={p.startX}
            y1={p.startY}
            x2={p.targetX}
            y2={p.targetY}
            stroke="currentColor"
            strokeWidth="0.5"
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{
              opacity: [0, 0.4, 0],
              pathLength: [0, 1, 0.8],
              x1: [p.startX, p.targetX],
              y1: [p.startY, p.targetY],
            }}
            transition={{
              duration: duration / 1000,
              delay: p.delay,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Wireframe structure (drawing lines between adjacent target points) */}
        {particles.length > 0 && particles.map((p, idx) => {
          const nextP = particles[(idx + 1) % particles.length];
          return (
            <motion.line
              key={`wireframe-edge-${idx}`}
              x1={p.targetX}
              y1={p.targetY}
              x2={nextP.targetX}
              y2={nextP.targetY}
              stroke="currentColor"
              strokeWidth="0.75"
              className="text-cyan-primary/25 pointer-events-none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 0.1, 0.45, 0.25] }}
              transition={{
                duration: duration / 1000,
                delay: Math.max(p.delay, nextP.delay),
                ease: "easeInOut"
              }}
            />
          );
        })}

        {/* Scattered Particles assembling */}
        {particles.map((p) => (
          <motion.circle
            key={`particle-${p.id}`}
            r={p.size}
            fill="currentColor"
            className="cyan-glow text-cyan-primary"
            initial={{
              cx: p.startX,
              cy: p.startY,
              opacity: 0,
              scale: 0.2,
            }}
            animate={{
              cx: p.targetX,
              cy: p.targetY,
              opacity: [0, 1, 0.9, 0],
              scale: [0.2, 1.3, 1, 0.2],
            }}
            transition={{
              duration: duration / 1000,
              delay: p.delay,
              ease: "easeOut",
            }}
          />
        ))}

        {/* Glowing holographic base reticle at assembly point */}
        <motion.circle
          cx="150"
          cy="150"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="6 12"
          className="opacity-40"
          initial={{ scale: 1.4, rotate: -45, opacity: 0 }}
          animate={{ scale: 1.0, rotate: 180, opacity: 0.6 }}
          transition={{ duration: duration / 1000, ease: "easeOut" }}
        />

        {/* Outer targeting frame brackets forming around center */}
        {[0, 90, 180, 270].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 150 + 60 * Math.cos(rad);
          const y1 = 150 + 60 * Math.sin(rad);
          const x2 = 150 + 60 * Math.cos(rad + 0.15);
          const y2 = 150 + 60 * Math.sin(rad + 0.15);
          return (
            <motion.path
              key={`bracket-${i}`}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.8, scale: 1 }}
              transition={{ duration: duration / 1000, ease: "easeOut" }}
            />
          );
        })}

        {/* Final icon drawing itself or fading in on completion */}
        {Icon && (
          <foreignObject x="118" y="118" width="64" height="64" className="overflow-visible">
            <motion.div
              initial={{ opacity: 0, scale: 0.5, filter: "brightness(0)" }}
              animate={{
                opacity: [0, 0.2, 0.9, 1],
                scale: [0.5, 0.8, 1.1, 1],
                filter: ["brightness(0)", "brightness(1.5)", "brightness(1)"],
              }}
              transition={{
                duration: duration / 1000,
                ease: "easeOut",
                delay: 0.25,
              }}
              className="w-16 h-16 flex items-center justify-center text-cyan-primary"
            >
              <Icon className="w-12 h-12 cyan-glow" />
            </motion.div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}
