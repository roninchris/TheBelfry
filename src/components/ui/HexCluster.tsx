import React from "react";
import { motion } from "motion/react";
import { useAppStore } from "../../store/appStore";
import { playHoverEvidence } from "../../lib/soundEngine";
import AnimatedCounter from "./AnimatedCounter";
import { Shield, Brain, Cpu, Database, Fingerprint, Lock, Activity, Link2, Folder, CheckSquare } from "lucide-react";

interface HexNode {
  id: string;
  label: string;
  current: number;
  max: number;
  icon: React.ComponentType<{ className?: string }>;
}

export default function HexCluster() {
  const { cases, evidenceNodes, evidenceConnections } = useAppStore();

  // Calculate real-time case metrics for the Synergy Grid
  const totalEvidence = evidenceNodes.length;
  const totalConnections = evidenceConnections.length;
  const activeCasesCount = cases.filter(c => c.status === "ACTIVE").length;
  const solvedCasesCount = cases.filter(c => c.status === "SOLVED").length;

  const activeCaseId = useAppStore(state => state.activeCaseId);
  const activeCaseNodesCount = evidenceNodes.filter(n => n.caseId === activeCaseId).length;

  // Center node: Core Evidence Items
  const maxEvidence = 50; 

  const nodes: HexNode[] = [
    {
      id: "center",
      label: "TOTAL EVIDENCE",
      current: totalEvidence,
      max: maxEvidence,
      icon: Database,
    },
    {
      id: "active-cases",
      label: "ACTIVE CASES",
      current: activeCasesCount,
      max: 8,
      icon: Folder,
    },
    {
      id: "solved-cases",
      label: "SOLVED CASES",
      current: solvedCasesCount,
      max: Math.max(cases.length, 1),
      icon: CheckSquare,
    },
    {
      id: "correlations",
      label: "CORRELATIONS",
      current: totalConnections,
      max: 30,
      icon: Link2,
    },
    {
      id: "active-clues",
      label: "ACTIVE FOCUS CLUES",
      current: activeCaseNodesCount,
      max: 15,
      icon: Fingerprint,
    },
    {
      id: "database-size",
      label: "CASES INDEXED",
      current: cases.length,
      max: 12,
      icon: Cpu,
    },
    {
      id: "uplink-integrity",
      label: "UPLINK FLOW",
      current: cases.length > 0 ? 100 : 0,
      max: 100,
      icon: Activity,
    },
  ];

  // Precision spacing for Pointy-topped Honeycomb layout
  // Center is at (150, 135)
  const cx0 = 150;
  const cy0 = 135;
  const rHex = 34;
  const d = rHex * Math.sqrt(3); // ~58.9 distance between centers

  // Pointy-topped hexagon angles: 30, 90, 150, 210, 270, 330
  const layout = [
    { cx: cx0, cy: cy0 }, // Center node (index 0)
    { cx: cx0 + d * Math.cos((30 * Math.PI) / 180), cy: cy0 + d * Math.sin((30 * Math.PI) / 180) }, // Node 1 (30 deg)
    { cx: cx0 + d * Math.cos((90 * Math.PI) / 180), cy: cy0 + d * Math.sin((90 * Math.PI) / 180) }, // Node 2 (90 deg)
    { cx: cx0 + d * Math.cos((150 * Math.PI) / 180), cy: cy0 + d * Math.sin((150 * Math.PI) / 180) }, // Node 3 (150 deg)
    { cx: cx0 + d * Math.cos((210 * Math.PI) / 180), cy: cy0 + d * Math.sin((210 * Math.PI) / 180) }, // Node 4 (210 deg)
    { cx: cx0 + d * Math.cos((270 * Math.PI) / 180), cy: cy0 + d * Math.sin((270 * Math.PI) / 180) }, // Node 5 (270 deg)
    { cx: cx0 + d * Math.cos((330 * Math.PI) / 180), cy: cy0 + d * Math.sin((330 * Math.PI) / 180) }, // Node 6 (330 deg)
  ];

  // Helper to construct a pointy-topped hexagon SVG path
  const getHexPath = (cx: number, cy: number, r: number) => {
    const w = (r * Math.sqrt(3)) / 2;
    return `M ${cx} ${cy - r} L ${cx + w} ${cy - r / 2} L ${cx + w} ${cy + r / 2} L ${cx} ${cy + r} L ${cx - w} ${cy + r / 2} L ${cx - w} ${cy - r / 2} Z`;
  };

  const hexPerimeter = rHex * 6; // 204

  return (
    <div className="relative flex flex-col items-center justify-center p-3 bg-bg-void/40 border border-border-hairline/15 rounded-sm select-none overflow-visible" id="hex-cluster-container">
      {/* Absolute background scanning grids */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

      {/* Title */}
      <div className="w-full border-b border-border-hairline/20 pb-1 mb-2.5 flex justify-between items-center">
        <span className="font-display text-[13px] font-black text-cyan-primary tracking-widest uppercase flex items-center">
          <span className="w-1.5 h-1.5 bg-cyan-primary mr-1.5 inline-block" />
          BELFRY SYNERGY GRID
        </span>
        <span className="font-share text-[12px] text-text-dim">SYS: ACTIVE METRICS</span>
      </div>

      {/* Honeycomb SVG Drawing Stage */}
      <div className="relative w-full aspect-[300/255] min-h-[220px] overflow-visible">
        <svg
          viewBox="0 0 300 255"
          className="absolute inset-0 w-full h-full text-cyan-primary/25 pointer-events-none overflow-visible"
        >
          {/* 1. Draw connection lines between neighbors first (underneath nodes) */}
          {/* Inner radiating lines from center (0) to outer (1..6) */}
          {Array.from({ length: 6 }).map((_, i) => {
            const tgt = layout[i + 1];
            return (
              <motion.line
                key={`line-rad-${i}`}
                x1={cx0}
                y1={cy0}
                x2={tgt.cx}
                y2={tgt.cy}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="2 3"
                className="text-cyan-primary opacity-60"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: i * 0.15 }}
              />
            );
          })}

          {/* Perimeter connections between surrounding nodes */}
          {[
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 6],
            [6, 1],
          ].map(([a, b], i) => {
            const ptA = layout[a];
            const ptB = layout[b];
            return (
              <line
                key={`line-perm-${i}`}
                x1={ptA.cx}
                y1={ptA.cy}
                x2={ptB.cx}
                y2={ptB.cy}
                stroke="currentColor"
                strokeWidth="0.8"
                className="opacity-25"
              />
            );
          })}

          {/* 2. Render each of the 7 hexagon nodes */}
          {nodes.map((node, idx) => {
            const { cx, cy } = layout[idx];
            const progressRatio = node.current / node.max;
            const strokeOffset = hexPerimeter - hexPerimeter * Math.min(Math.max(progressRatio, 0), 1);
            const isCenter = idx === 0;

            return (
              <g
                key={node.id}
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={() => playHoverEvidence()}
              >
                {/* Hex background slot */}
                <path
                  d={getHexPath(cx, cy, rHex)}
                  fill={isCenter ? "rgb(var(--rgb-accent) / 0.05)" : "rgba(2, 9, 18, 0.85)"}
                  stroke="rgb(var(--rgb-accent) / 0.12)"
                  strokeWidth="1.5"
                />

                {/* Animated Concentric Glowing Rings around center items */}
                {isCenter && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={rHex + 8}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    strokeDasharray="4 8"
                    className="text-cyan-primary opacity-30 animate-[spin_20s_linear_infinite]"
                  />
                )}

                {/* Pointy-topped Hexagon Progress Indicator Border */}
                <motion.path
                  d={getHexPath(cx, cy, rHex)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isCenter ? "2" : "1.5"}
                  className="text-cyan-primary cyan-glow"
                  strokeDasharray={hexPerimeter}
                  initial={{ strokeDashoffset: hexPerimeter }}
                  animate={{ strokeDashoffset: strokeOffset }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />

                {/* Micro dots at points of hexagons */}
                {isCenter && (
                  <circle
                    cx={cx}
                    cy={cy - rHex}
                    r="2.5"
                    fill="currentColor"
                    className="text-cyan-primary cyan-glow animate-hex-pulse-flicker"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* HTML Labels & Icons Overlayed perfectly over the nodes */}
        {nodes.map((node, idx) => {
          const { cx, cy } = layout[idx];
          const isCenter = idx === 0;
          const Icon = node.icon;

          return (
            <div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none"
              style={{
                left: `${(cx / 300) * 100}%`,
                top: `${(cy / 255) * 100}%`,
                width: `${rHex * 1.5}px`,
                height: `${rHex * 1.5}px`,
              }}
            >
              {/* Icon */}
              <Icon
                className={`text-cyan-primary ${
                  isCenter ? "w-5 h-5 cyan-glow mb-1" : "w-3.5 h-3.5 opacity-80"
                }`}
              />

              {/* Progress Count text */}
              <div className="font-mono text-[12px] font-bold text-text-primary mt-0.5 tracking-tight leading-none">
                <AnimatedCounter value={node.current} duration={800} />/{node.max}
              </div>

              {/* Short Label */}
              <span className="font-chakra text-[12px] text-text-dim tracking-wider font-extrabold uppercase mt-0.5 text-center truncate w-full leading-none">
                {node.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Dynamic Summary Strip */}
      <div className="w-full bg-cyan-primary/[0.02] border border-cyan-primary/10 p-2 mt-2 font-share text-[12px] text-text-dim text-center">
        <span className="text-cyan-primary font-bold">TOTAL DATABASE DENSITY:</span>{" "}
        <span className="text-text-primary font-mono">
          {totalEvidence} RECOVERY VECTORS
        </span>
      </div>
    </div>
  );
}
