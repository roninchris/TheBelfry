import React from "react";
import { LucideIcon } from "lucide-react";
import { playHoverEvidence, playNavTick } from "../../lib/soundEngine";

interface TabItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface IconTabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function IconTabs({
  tabs,
  activeTabId,
  onChange,
  className = "",
}: IconTabsProps) {
  return (
    <div className={`flex items-center space-x-2 bg-bg-void/60 p-1 border border-border-hairline/10 rounded-sm ${className}`} id="icon-tabs-container">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => {
              onChange(tab.id);
              playNavTick();
            }}
            onMouseEnter={() => playHoverEvidence()}
            className={`relative flex items-center justify-center w-8 h-8 transition-all duration-300 group`}
            title={tab.label}
          >
            {/* Corner clipped border background */}
            <div
              className={`absolute inset-0 border transition-all duration-300 ${
                isActive
                  ? "bg-cyan-primary/20 border-cyan-primary text-cyan-primary shadow-[0_0_6px_rgb(var(--rgb-accent) / 0.3)]"
                  : "bg-bg-void border-border-hairline/20 text-text-dim hover:border-cyan-primary/40 hover:text-text-primary"
              }`}
              style={{
                clipPath:
                  "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
              }}
            />

            {/* Glowing active indicator dot */}
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-cyan-primary rounded-full" />
            )}

            {/* The Icon itself */}
            <Icon
              className={`w-3.5 h-3.5 relative z-10 transition-transform ${
                isActive ? "scale-110" : "group-hover:scale-110"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
