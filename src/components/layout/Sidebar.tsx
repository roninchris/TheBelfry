import React, { useState } from "react";
import { useAppStore } from "../../store/appStore";
import { playNavTick, playHoverBlip } from "../../lib/soundEngine";
import { assetUrl } from "../../lib/assetUrl";
import ShinyText from "../react-bits/ShinyText";
import MapModuleIcon from "../ui/MapModuleIcon";
import {
  Activity,
  Network,
  FolderOpen,
  Binary,
  Hash,
  Eye,
  Waves,
  FileCode,
  GitBranch,
  Database,
  Sliders,
  Shield,
  Compass,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Modules whose work happens on a large canvas, where the rail costs more than
 * it gives. They collapse it on arrival and hand it back on the way out — but
 * only if the collapse was ours, so a manual preference is never overridden.
 */
const CANVAS_MODULES = new Set(["detective-board", "map"]);

export default function Sidebar() {
  const currentModule = useAppStore((state) => state.currentModule);
  const openChallenge = useAppStore((state) => state.openChallenge);
  const currentIdentity = useAppStore((state) => state.currentIdentity);
  const setModule = useAppStore((state) => state.setModule);
  const [isMinimized, setIsMinimized] = useState(false);
  const wasAutoCollapsedRef = React.useRef(false);
  const prevModuleRef = React.useRef(currentModule);

  /**
   * Current collapse state, readable without becoming an effect dependency.
   *
   * This is the whole fix. The auto-collapse effect used to depend on
   * `isMinimized`, so re-opening the rail inside a canvas module re-ran it,
   * found the rail open on a module that wants it shut, and closed it again —
   * making the rail impossible to reopen without leaving the module. Reading
   * the value through a ref keeps the effect keyed on navigation alone.
   */
  const isMinimizedRef = React.useRef(isMinimized);
  isMinimizedRef.current = isMinimized;

  React.useEffect(() => {
    const prevModule = prevModuleRef.current;
    // Only a genuine navigation should move the rail. Anything else is the
    // user's own doing and must be left alone.
    if (prevModule === currentModule) return;
    prevModuleRef.current = currentModule;

    const arriving = CANVAS_MODULES.has(currentModule);
    const departing = CANVAS_MODULES.has(prevModule);

    if (arriving && !departing) {
      // Collapse on arrival, and remember that the collapse was ours so it can
      // be handed back on the way out.
      if (!isMinimizedRef.current) {
        setIsMinimized(true);
        wasAutoCollapsedRef.current = true;
      }
    } else if (departing && !arriving) {
      if (wasAutoCollapsedRef.current) {
        setIsMinimized(false);
        wasAutoCollapsedRef.current = false;
      }
    }
    // Moving between two canvas modules deliberately does nothing: whatever
    // state the rail is in at that point is the state the user chose.
  }, [currentModule]);

  const sections = [
    {
      title: "BATCOMPUTER",
      items: [
        { id: "dashboard", label: "Dashboard", icon: Activity },
        { id: "detective-board", label: "Evidence Board", icon: Network },
        { id: "case-files", label: "Case Files", icon: FolderOpen },
      ],
    },
    {
      title: "INVESTIGATION",
      items: [
        { id: "crypto-lab", label: "The Codex", icon: Binary },
        { id: "encoding-lab", label: "Encoding Deck", icon: Hash },
        { id: "image-forensics", label: "Image Forensics", icon: Eye },
        { id: "audio-forensics", label: "Audio Forensics", icon: Waves },
        { id: "file-analysis", label: "File Analysis", icon: FileCode },
      ],
    },
    {
      title: "TOOLS",
      items: [
        { id: "cyberchef-pipeline", label: "Signal Chain", icon: GitBranch },
        { id: "map", label: "Map", icon: MapModuleIcon },
        { id: "tool-database", label: "Tool Database", icon: Database },
        { id: "settings", label: "Settings", icon: Sliders },
      ],
    },
  ];

  return (
    // On a 1024px-wide screen a fixed 288px rail is 28% of the viewport, which
    // is what makes the shorter/squarer desktop sizes feel so cramped. It steps
    // down below xl and keeps its full width on roomier screens.
    <aside className={`${isMinimized ? 'w-20 xl:w-24' : 'w-56 xl:w-72'} shrink-0 transition-all duration-300 ease-in-out bg-bg-void/90 border-r border-border-hairline/20 flex flex-col h-full font-chakra text-xs tracking-wider uppercase select-none relative z-10`}>
      {/* Minimize Toggle */}
      <button 
        onClick={() => { 
          setIsMinimized(!isMinimized); 
          wasAutoCollapsedRef.current = false;
          playNavTick(); 
        }}
        className="absolute -right-3 top-[104px] w-6 h-12 bg-bg-void border border-cyan-primary/30 rounded-r-md flex items-center justify-center text-cyan-primary hover:bg-cyan-primary/20 z-30"
        style={{ clipPath: "polygon(0 0, 100% 10%, 100% 90%, 0 100%)" }}
      >
        {isMinimized ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Bat logo visual emblem */}
      <div className={`p-4 border-b border-border-hairline/20 flex items-center bg-gradient-to-r from-cyan-primary/[0.03] to-transparent ${isMinimized ? 'justify-center' : 'space-x-3'}`}>
        {/*
          The emblem is the way IN, and only that. Deliberately unlabelled and
          untitled: a guest has no reason to read it as a login, and an
          accidental click closes with Escape or the backdrop.

          Once a knight is signed in it goes inert — ending a session belongs to
          the operative's own sigil in the header (KnightBadge), so there is
          exactly one way out and it is the one carrying your identity. Two
          controls doing the same irreversible thing is how people disconnect by
          accident.
        */}
        <button
          type="button"
          onClick={() => { if (!currentIdentity) openChallenge(); }}
          aria-label="Belfry emblem"
          className={`relative w-14 h-14 flex items-center justify-center bg-cyan-primary/5 border border-cyan-primary/30 rounded-full animate-breathing shrink-0 transition-shadow duration-300 ${
            currentIdentity ? "cursor-default" : "cursor-pointer hover:shadow-[0_0_12px_rgb(var(--rgb-primary) / 0.35)]"
          }`}
        >
          <img src={assetUrl("/assets/icons/belfry_sidebar.png")} alt="" className="w-10 h-10 object-contain filter drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
          <div className="absolute inset-0 border border-dashed border-cyan-primary/10 rounded-full animate-radar-sweep" />
        </button>
        {!isMinimized && (
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="font-display text-sm font-black tracking-widest text-text-primary uppercase cyan-glow leading-tight">
              THE BELFRY
            </h1>
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-5 scrollbar-thin scrollbar-thumb-cyan-dim/20 scrollbar-track-transparent overflow-x-hidden">
        {sections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-2">
            {!isMinimized && (
              <h2 className="text-xs font-bold text-text-dim font-display tracking-widest pl-1 opacity-70 flex items-center whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-cyan-primary/40 mr-1.5 inline-block shrink-0" />
                {sec.title}
              </h2>
            )}
            <div className="space-y-1">
              {sec.items.map((item) => {
                const isActive = currentModule === item.id;
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    title={isMinimized ? item.label : undefined}
                    onClick={() => {
                      setModule(item.id);
                      playNavTick();
                    }}
                    onMouseEnter={() => playHoverBlip()}
                    className={`w-full flex items-center ${isMinimized ? 'justify-center' : 'space-x-3'} p-2 transition-all duration-100 ease-in-out text-left relative group ${
                      isActive
                        ? "text-cyan-text font-bold bg-cyan-primary/[0.04] cyan-glow-pulse"
                        : "text-text-dim hover:text-text-primary hover:bg-cyan-primary/[0.02] cyan-glow-pulse-subtle"
                    }`}
                  >
                    {/* Glowing highlight indicator line */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-cyan-primary transition-all duration-100 ease-in-out origin-center ${
                      isActive 
                        ? "opacity-100 scale-y-100 shadow-[0_0_6px_#09efaf,0_0_15px_rgba(255,254,255,0.4)]" 
                        : "opacity-0 scale-y-0 group-hover:opacity-80 group-hover:scale-y-75 group-hover:shadow-[0_0_5px_#09efaf]"
                    }`} />

                    {/* Angled framed micro-container for icon */}
                    <div
                      className={`relative flex items-center justify-center shrink-0 border transition-all duration-100 ease-in-out ${
                        isMinimized ? "w-14 h-14" : "w-8 h-8"
                      } ${
                        isActive
                          ? "bg-cyan-primary/15 border-cyan-primary/50 text-cyan-primary shadow-[0_0_6px_rgba(9,239,175,0.4),0_0_15px_rgba(255,254,255,0.2)]"
                          : "bg-bg-void/80 border-border-hairline/25 text-text-dim group-hover:border-cyan-primary/30 group-hover:text-cyan-dim"
                      }`}
                      style={{
                        clipPath: isMinimized 
                          ? "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)"
                          : "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                      }}
                    >
                      <IconComponent className={isMinimized ? "w-7 h-7" : "w-5 h-5"} />
                    </div>

                    {!isMinimized && (
                      <span className="font-chakra text-sm tracking-widest font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Identity HUD Badge */}
      <div className={`p-3 bg-bg-void/90 border-t border-border-hairline/20 font-share text-[13px] text-text-dim ${isMinimized ? 'text-center' : ''}`}>
        {!isMinimized ? (
          <>
            <div className="flex justify-between items-center opacity-80 mb-1">
              <span>OPERATIONAL MODE:</span>
              <span className="text-green-verified font-bold animate-hex-pulse-flicker">STEALTH DIRECT</span>
            </div>
            <div className="flex justify-between items-center opacity-80 whitespace-nowrap">
              <span>SYS CORRELATION:</span>
              <span className="font-mono text-cyan-dim font-bold">100% DISCONNECTED</span>
            </div>
          </>
        ) : (
          <div className="text-green-verified font-bold animate-hex-pulse-flicker w-full flex justify-center">
             <Shield className="w-5 h-5" />
          </div>
        )}
      </div>
    </aside>
  );
}
