import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LucideIcon } from "lucide-react";
import { playHoverEvidence } from "../../lib/soundEngine";

export interface RadialDialItem {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

interface RadialDialProps {
  items: RadialDialItem[];
  onSelect?: (item: RadialDialItem) => void;
  className?: string;
  initialSelectedId?: string;
}

export default function RadialDial({
  items,
  onSelect,
  className = "",
  initialSelectedId,
}: RadialDialProps) {
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedId || (items[0]?.id || "")
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const activeIndex = selectedIndex !== -1 ? selectedIndex : 0;
  const activeItem = items[activeIndex];

  const handleSelect = (item: RadialDialItem) => {
    setSelectedId(item.id);
    if (onSelect) {
      onSelect(item);
    }
  };

  const centerCoords = { x: 150, y: 150 };
  const radius = 95; // Radius for placing items

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`} id="radial-dial-container">
      <div className="relative w-[280px] h-[280px] flex items-center justify-center">
        {/* SVG Background Rings and Segment Indicators */}
        <svg
          viewBox="0 0 300 300"
          className="absolute inset-0 w-full h-full text-cyan-primary/20 pointer-events-none"
        >
          {/* Outer dashed ring */}
          <circle
            cx="150"
            cy="150"
            r="135"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 6"
            className="animate-[spin_60s_linear_infinite]"
          />

          {/* Outer thin ring */}
          <circle
            cx="150"
            cy="150"
            r="125"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="opacity-40"
          />

          {/* Perimeter Tech tick marks */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            const x1 = 150 + 125 * Math.cos((angle * Math.PI) / 180);
            const y1 = 150 + 125 * Math.sin((angle * Math.PI) / 180);
            const x2 = 150 + 131 * Math.cos((angle * Math.PI) / 180);
            const y2 = 150 + 131 * Math.sin((angle * Math.PI) / 180);
            return (
              <line
                key={`tick-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="1"
                className="opacity-50"
              />
            );
          })}

          {/* Middle guiding circle */}
          <circle
            cx="150"
            cy="150"
            r="95"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="1 15"
            className="opacity-30"
          />

          {/* Inner ring bordering center */}
          <circle
            cx="150"
            cy="150"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="opacity-40"
          />

          {/* Active selection rotating sweep arc */}
          {items.map((_, i) => {
            const angle = (i * 360) / items.length - 90;
            const isActive = i === activeIndex;
            return isActive ? (
              <motion.circle
                key={`active-arc-${i}`}
                cx="150"
                cy="150"
                r="108"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="30 180"
                className="text-cyan-primary cyan-glow"
                animate={{ rotate: angle }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
              />
            ) : null;
          })}

          {/* Connecting line indicators from center to buttons */}
          {items.map((_, i) => {
            const angle = (i * 360) / items.length - 90;
            const rad = (angle * Math.PI) / 180;
            const x1 = 150 + 56 * Math.cos(rad);
            const y1 = 150 + 56 * Math.sin(rad);
            const x2 = 150 + 82 * Math.cos(rad);
            const y2 = 150 + 82 * Math.sin(rad);
            const isActive = i === activeIndex;
            return (
              <line
                key={`conn-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth={isActive ? "1.5" : "0.5"}
                className={isActive ? "text-cyan-primary opacity-80" : "opacity-30"}
              />
            );
          })}
        </svg>

        {/* Center Readout Text Panel (using clip path corner ticks) */}
        <div
          className="absolute w-[100px] h-[100px] rounded-full flex flex-col items-center justify-center bg-bg-void/90 border border-cyan-primary/30 text-center p-2 z-10 overflow-hidden"
          style={{
            boxShadow: "inset 0 0 10px rgb(var(--rgb-accent) / 0.15)",
          }}
        >
          {/* Subtle tech lines inside the center */}
          <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
          <AnimatePresence mode="wait">
            {activeItem && (
              <motion.div
                key={activeItem.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center"
              >
                <span className="font-orbitron text-[12px] font-black text-cyan-primary tracking-widest uppercase">
                  ACTIVE
                </span>
                <span className="font-chakra text-[13px] font-extrabold text-text-primary tracking-wider uppercase truncate max-w-[85px] leading-tight my-0.5">
                  {activeItem.label}
                </span>
                <span className="font-share text-[12px] text-cyan-dim/80 uppercase tracking-widest leading-none">
                  MODE READY
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ring of Interactive Button Slots */}
        {items.map((item, i) => {
          const angle = (i * 360) / items.length - 90;
          const rad = (angle * Math.PI) / 180;
          const x = centerCoords.x + radius * Math.cos(rad);
          const y = centerCoords.y + radius * Math.sin(rad);

          const isActive = item.id === selectedId;
          const isHovered = item.id === hoveredId;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => {
                setHoveredId(item.id);
                playHoverEvidence();
              }}
              onMouseLeave={() => setHoveredId(null)}
              className="absolute w-10 h-10 -ml-5 -mt-5 flex items-center justify-center transition-all duration-300 z-20 group"
              style={{
                left: `${(x / 300) * 100}%`,
                top: `${(y / 300) * 100}%`,
              }}
            >
              {/* Button BG & Clips */}
              <div
                className={`absolute inset-0 border transition-all duration-300 ${
                  isActive
                    ? "bg-cyan-primary/20 border-cyan-primary text-cyan-primary shadow-[0_0_8px_rgb(var(--rgb-accent) / 0.4)]"
                    : isHovered
                    ? "bg-cyan-primary/5 border-cyan-primary/50 text-cyan-primary"
                    : "bg-bg-void/90 border-border-hairline/30 text-text-dim"
                }`}
                style={{
                  clipPath:
                    "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                }}
              />

              {/* Inner Mini Dot or Reticle */}
              {isActive && (
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-cyan-primary rounded-full animate-ping-cyan" />
              )}

              {/* Icon */}
              <Icon
                className={`w-4 h-4 relative z-10 transition-transform duration-300 ${
                  isActive ? "scale-110" : "group-hover:scale-110"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Description HUD panel directly beneath the wheel */}
      <div className="w-full mt-3 px-3 py-2 bg-bg-void/50 border border-border-hairline/10 text-center relative"
           style={{ clipPath: "polygon(0 0, 100% 0, 95% 100%, 0 100%)" }}>
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-primary/30" />
        <AnimatePresence mode="wait">
          {activeItem && (
            <motion.div
              key={`desc-${activeItem.id}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              <h4 className="font-chakra text-[13px] font-black text-cyan-primary uppercase tracking-widest">
                {activeItem.label}
              </h4>
              <p className="font-share text-[12px] text-text-dim leading-snug uppercase mt-0.5 max-h-[30px] overflow-hidden">
                {activeItem.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
