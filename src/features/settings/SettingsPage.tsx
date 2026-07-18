import React, { useState } from "react";
import { useAppStore } from "../../store/appStore";
import GlassPanel from "../../components/ui/GlassPanel";
import Badge from "../../components/ui/Badge";
import { 
  Sliders, 
  Volume2, 
  VolumeX, 
  Radio, 
  Trash2, 
  Check, 
  Activity, 
  ShieldAlert,
  SlidersHorizontal,
  Palette
} from "lucide-react";
import {
  playPinClick,
  playSuccessChime,
  playFailBuzz,
  playHoverBlip
} from "../../lib/soundEngine";
import { THEMES } from "../../lib/themes";

export default function SettingsPage() {
  const { 
    masterVolume, 
    isMuted, 
    ambientEnabled, 
    setMasterVolume, 
    setMuted, 
    setAmbientEnabled,
    clearLogs,
    addLog,
    theme,
    setTheme
  } = useAppStore();

  const [resetConfirm, setResetConfirm] = useState(false);
  const [testSoundActive, setTestSoundActive] = useState(false);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setMasterVolume(vol);
  };

  const toggleMute = () => {
    setMuted(!isMuted);
    playPinClick();
  };

  const toggleAmbient = () => {
    setAmbientEnabled(!ambientEnabled);
    playPinClick();
  };

  const handleTestSound = () => {
    setTestSoundActive(true);
    playSuccessChime();
    setTimeout(() => {
      setTestSoundActive(false);
    }, 450);
  };

  const handleResetLogs = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    clearLogs();
    addLog("TELEMETRY LOG MATRIX REBOOTED // CACHE PURGED", "warning", "SYS-REBOOT");
    setResetConfirm(false);
    playSuccessChime();
  };

  return (
    <div className="h-full w-full p-6 flex flex-col items-center justify-start overflow-y-auto font-chakra select-none text-text-primary max-w-4xl mx-auto space-y-6">
      
      {/* Settings Module Title Block */}
      <div className="w-full text-left">
        <h2 className="font-display text-base font-black tracking-widest text-cyan-text flex items-center">
          <span className="w-1.5 h-3.5 bg-cyan-primary mr-2.5 transform -skew-x-12 inline-block shadow-[0_0_8px_var(--color-accent-primary)]" />
          TELEMETRY & COMMAND SETTINGS
        </h2>
        <p className="text-[13px] font-share text-text-dim tracking-wider uppercase mt-1">
          Configure diagnostic audio frequencies, scanline matrices, and telemetry registries
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
        
        {/* ================= DISPLAY PROFILE (THEME) ================= */}
        <div className="col-span-1 md:col-span-12">
          <GlassPanel className="panel-console p-6 space-y-4" clipSize="md">
            <div className="border-b border-border-hairline/25 pb-2.5">
              <h3 className="font-display text-base font-extrabold tracking-[0.18em] text-white flex items-center uppercase">
                <Palette className="w-4 h-4 mr-2 text-accent-primary" />
                Display Profile
              </h3>
              <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
                Retints the entire console — applies immediately, persists per device
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      playPinClick();
                      setTheme(t.id);
                    }}
                    onMouseEnter={() => playHoverBlip()}
                    aria-pressed={active}
                    data-theme-option={t.id}
                    className={`tablet-btn tablet-frame text-left p-3 flex flex-col gap-2 ${
                      active ? "tablet-active" : ""
                    }`}
                  >
                    <span className="flex items-center justify-between w-full">
                      <span className="font-display text-sm font-extrabold tracking-[0.16em] uppercase">
                        {t.label}
                      </span>
                      {active && (
                        <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      )}
                    </span>

                    {/* Swatches are literal hex, not theme vars — they must show
                        each palette regardless of which theme is active. */}
                    <span className="flex gap-1" aria-hidden="true">
                      {t.swatch.map((c) => (
                        <span
                          key={c}
                          className="w-6 h-3 border border-white/15"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>

                    <span className="font-share text-[11px] tracking-wide uppercase opacity-70 normal-case">
                      {t.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassPanel>
        </div>

        {/* ================= COLUMN 1: AUDIO SYNTH CONTROLS ================= */}
        <div className="col-span-1 md:col-span-7 flex flex-col space-y-6">
          <GlassPanel className="panel-console p-6 space-y-6 flex-1" clipSize="md">
            
            <div className="border-b border-border-hairline/25 pb-2.5">
              <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                <Volume2 className="w-4 h-4 mr-2 text-cyan-primary" />
                Audio Synthesis Matrix
              </h3>
              <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
                Manage Web Audio API procedural oscillator synthesis
              </p>
            </div>

            {/* Mute and Ambient Master Toggles */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleMute}
                onMouseEnter={() => playHoverBlip()}
                className={`hud-target ${isMuted ? "hud-target-threat" : ""} flex flex-col items-start p-3 border transition-all relative ${
                  isMuted
                    ? "bg-red-threat/[0.04] border-red-threat/40 text-red-threat"
                    : "bg-bg-void/40 border-border-hairline/15 text-text-dim hover:border-border-hairline/30 hover:text-text-primary"
                }`}
                style={{ clipPath: "polygon(0 0, 100% 0, 94% 100%, 0 100%)" }}
              >
                <div className="flex justify-between items-center w-full mb-1">
                  <span className="font-mono text-[12px] uppercase tracking-widest">MASTER MUTE</span>
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-text-dim/60" />}
                </div>
                <Badge variant={isMuted ? "red" : "dim"} size="xs">
                  {isMuted ? "MUTED" : "UNMUTED"}
                </Badge>
              </button>

              <button
                onClick={toggleAmbient}
                onMouseEnter={() => playHoverBlip()}
                className={`hud-target flex flex-col items-start p-3 border transition-all relative ${
                  ambientEnabled
                    ? "bg-cyan-primary/[0.04] border-cyan-primary/40 text-cyan-text"
                    : "bg-bg-void/40 border-border-hairline/15 text-text-dim hover:border-border-hairline/30 hover:text-text-primary"
                }`}
                style={{ clipPath: "polygon(0 0, 100% 0, 94% 100%, 0 100%)" }}
              >
                <div className="flex justify-between items-center w-full mb-1">
                  <span className="font-mono text-[12px] uppercase tracking-widest">AMBIENT DRONE</span>
                  <Radio className={`w-3.5 h-3.5 ${ambientEnabled ? "animate-hex-pulse-flicker" : "text-text-dim/60"}`} />
                </div>
                <Badge variant={ambientEnabled ? "cyan" : "dim"} size="xs">
                  {ambientEnabled ? "ACTIVE" : "STANDBY"}
                </Badge>
              </button>
            </div>

            {/* Master Volume Slider */}
            <div className="space-y-3.5 bg-bg-void/30 p-4 border border-border-hairline/10">
              <div className="flex justify-between items-center text-[13px] font-share text-text-dim uppercase">
                <span className="flex items-center">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-2 text-cyan-dim" />
                  SYNTH MASTER VOLUME LEVEL:
                </span>
                <span className="text-cyan-primary font-mono font-bold text-xs">
                  {isMuted ? "MUTED" : `${Math.round(masterVolume * 100)}%`}
                </span>
              </div>
              
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={masterVolume}
                  onChange={handleVolumeChange}
                  disabled={isMuted}
                  className="w-full accent-cyan-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                />
              </div>

              <div className="flex justify-between text-[12px] text-text-dim font-mono">
                <span>0% MIN (SILENT)</span>
                <span>50% BALANCED</span>
                <span>100% MAXIMUM</span>
              </div>
            </div>

            {/* Audio Synthesis Test Button */}
            <div className="pt-2 flex justify-start">
              <button
                onClick={handleTestSound}
                onMouseEnter={() => !isMuted && !testSoundActive && playHoverBlip()}
                disabled={isMuted || testSoundActive}
                className="hud-target px-4 py-2 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void disabled:border-border-hairline/20 disabled:text-text-dim/40 disabled:hover:bg-transparent transition-all text-[13px] font-black uppercase tracking-widest flex items-center"
                style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
              >
                <Activity className={`w-3.5 h-3.5 mr-1.5 ${testSoundActive ? "animate-hex-pulse-flicker" : ""}`} />
                PING FREQUENCY TEST
              </button>
            </div>

          </GlassPanel>
        </div>

        {/* ================= COLUMN 2: REGISTRY & SYSTEM UTILITIES ================= */}
        <div className="col-span-1 md:col-span-5 flex flex-col space-y-6">
          <GlassPanel className="panel-console p-6 space-y-6 flex-1" clipSize="md">
            
            <div className="border-b border-border-hairline/25 pb-2.5">
              <h3 className="font-display text-xs font-black tracking-widest text-cyan-text flex items-center uppercase">
                <ShieldAlert className="w-4 h-4 mr-2 text-cyan-primary" />
                SYSTEM OPERATIONS
              </h3>
              <p className="text-[12px] font-share text-text-dim tracking-wide uppercase mt-0.5">
                Reboot local diagnostics and telemetry logs
              </p>
            </div>

            {/* Description note */}
            <p className="text-[13px] font-share leading-relaxed text-text-dim uppercase">
              BELFRY terminal diagnostics log every clue pin, wire connection, cryptographic decode, and decryption flow. Clean up local storage caches by issuing a matrix wipe below.
            </p>

            {/* Clear Console Logs Action */}
            <div className="bg-bg-void/40 border border-border-hairline/10 p-4 rounded-sm space-y-3">
              <div className="flex justify-between items-center border-b border-border-hairline/15 pb-1.5">
                <span className="font-mono text-[12px] text-text-dim uppercase">LOCAL SYSTEM STORAGE</span>
                <Badge variant={resetConfirm ? "amber" : "dim"} size="xs">
                  {resetConfirm ? "CONFIRM" : "STANDBY"}
                </Badge>
              </div>

              <div className="flex justify-between items-center text-[13px]">
                <span className="font-share text-text-dim uppercase">DIAGNOSTIC LOG SIZE:</span>
                <span className="font-mono text-cyan-text font-bold">SECURE SECTORS ACTIVE</span>
              </div>

              <button
                onClick={handleResetLogs}
                onMouseEnter={() => playHoverBlip()}
                className={`hud-target ${resetConfirm ? "hud-target-amber" : "hud-target-threat"} w-full font-display font-black text-[13px] uppercase tracking-widest py-2 px-3 border transition-colors flex items-center justify-center space-x-1.5 ${
                  resetConfirm
                    ? "bg-amber-alert/15 border-amber-alert/40 text-amber-alert hover:bg-amber-alert hover:text-bg-void"
                    : "bg-red-threat/10 border-red-threat/30 text-red-threat hover:bg-red-threat hover:text-bg-void"
                }`}
                style={{ clipPath: "polygon(4px 0, 100% 0, 96% 100%, 0 100%)" }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{resetConfirm ? "WIPE ALL LOGS - CONFIRM" : "CLEAR DIAGNOSTIC LOGS"}</span>
              </button>

              {resetConfirm && (
                <button
                  onClick={() => setResetConfirm(false)}
                  className="w-full text-center text-[12px] font-mono text-text-dim hover:text-text-primary uppercase tracking-widest block underline transition-colors"
                >
                  CANCEL OPERATION
                </button>
              )}
            </div>

            {/* Systems Heuristics Footprint */}
            <div className="text-[12px] font-mono text-text-dim/60 space-y-1 bg-bg-void/25 p-2 border border-border-hairline/5">
              <p>SYSTEM CORE: STABLE</p>
              <p>MEMORY POINTER: 0x2A4F8B3C</p>
              <p>VERSION: BELFRY-OS v4.9.5</p>
            </div>

          </GlassPanel>
        </div>

      </div>

    </div>
  );
}
