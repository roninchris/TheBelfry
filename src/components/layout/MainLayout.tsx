import React from "react";
import { useAppStore } from "../../store/appStore";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import StatusBar from "./StatusBar";
import HexagonBackground from "../ui/HexagonBackground";
import AmbientTelemetry from "../ui/AmbientTelemetry";
import HoneycombField from "../ui/HoneycombField";
import NotesPanel from "../ui/NotesPanel";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  // The ambient field leans in while a forensic scan is running, so the console
  // visibly reacts to work rather than idling at one level.
  const isScanning = useAppStore((s) => s.isScanning);

  return (
    <div className="relative w-screen h-screen flex flex-col bg-bg-void text-text-primary overflow-hidden font-chakra">
      <div className="bat-bg"></div>
      <div className="circuit-overlay"></div>
      
      {/* Dynamic Hexagon background with pulsing effects */}
      <HexagonBackground />

      {/* Tessellated honeycomb lattice framing the workspace */}
      <HoneycombField />

      {/* Ambient glyph telemetry drifting in the left/right margins */}
      <AmbientTelemetry active={isScanning} />

      {/* Immersive HUD Grids and Edge vignettes */}
      <div className="absolute inset-0 hud-bg-grid opacity-100 z-0 pointer-events-none" />
      <div className="absolute inset-0 hud-vignette z-0 pointer-events-none" />

      {/* Drifting subtle atmospheric scanlines - GPU-composited, no JS animation loop */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.06] overflow-hidden">
        <div className="absolute -top-full left-0 w-full h-[200%] crt-scanlines animate-scanline-drift" />
      </div>

      {/* Decorative top visual scanline band with two-layered neon cyan glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-primary/20 shadow-[0_0_6px_var(--color-accent-primary),0_0_16px_rgba(255,255,255,0.4)] z-50 pointer-events-none" />
      
      {/* Decorative bottom visual scanline band with two-layered neon cyan glow matching the top */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-primary/20 shadow-[0_0_6px_var(--color-accent-primary),0_0_16px_rgba(255,255,255,0.4)] z-50 pointer-events-none" />

      {/* Primary Layout Frame */}
      <div className="flex-1 flex overflow-hidden z-10">
        {/* Sidebar Left panel channel */}
        <Sidebar />

        {/* Workspace core canvas to the right */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-void/40">
          {/* Header */}
          <TopBar />

          {/* Dynamic Page content Canvas */}
          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>

          {/* Footer Diagnostics panel */}
          <StatusBar />
        </div>
      </div>

      {/* Persistent cross-tab scratchpad */}
      <NotesPanel />
    </div>
  );
}
