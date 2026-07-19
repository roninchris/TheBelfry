/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AnimatePresence, motion } from "motion/react";
import MainLayout from "./components/layout/MainLayout";
import DashboardPage from "./features/dashboard/DashboardPage";
import OfflineModulePanel from "./components/ui/OfflineModulePanel";
import CryptoLab from "./features/crypto/CryptoLab";
import EncodingLab from "./features/encoding/EncodingLab";
import ImageForensicsLab from "./features/image-forensics/ImageForensicsLab";
import AudioForensicsLab from "./features/audio-forensics/AudioForensicsLab";
import FileAnalysisLab from "./features/file-analysis/FileAnalysisLab";
import CyberChefPipeline from "./features/cyberchef-pipeline/CyberChefPipeline";
import DossierPage from "./features/dossier/DossierPage";
import DetectiveBoardPage from "./features/detective-board/DetectiveBoardPage";
import MapModule from "./features/map/MapModule";
import SettingsPage from "./features/settings/SettingsPage";
import BelfryBootScreen from "./components/ui/BelfryBootScreen";
import CredentialChallenge from "./components/ui/CredentialChallenge";
import ToolDatabase from "./features/tool-database/ToolDatabase";
import { useAppStore } from "./store/appStore";
import { playGlitchBurst, playDebouncedTypeKey, playLoadTab, syncAmbientDrone, preloadSounds, setMapAmbience } from "./lib/soundEngine";
import { useEffect, useState } from "react";

export default function App() {
  const currentModule = useAppStore((state) => state.currentModule);
  // Boot plays by default; `?skipboot` bypasses it (dev/verification aid — no effect for normal users).
  const skipBoot = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("skipboot");
  const [hasBooted, setHasBooted] = useState(skipBoot);

  /**
   * The credential challenge never gates the app. Boot goes straight to a
   * guest session; the challenge opens only from the sidebar emblem, so a
   * visitor who does not know it exists is never asked to log in.
   */
  const isChallengeOpen = useAppStore((state) => state.isChallengeOpen);
  const closeChallenge = useAppStore((state) => state.closeChallenge);

  useEffect(() => {
    preloadSounds();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        playDebouncedTypeKey();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize ambient drone after boot
  useEffect(() => {
    if (hasBooted) {
      syncAmbientDrone();
    }
  }, [hasBooted]);

  /**
   * The map owns the audio bed while it is the current module.
   *
   * Keyed on module identity rather than on the module component's lifecycle:
   * the outgoing page stays mounted through its exit animation, and StrictMode
   * double-invokes effects, so a mount/unmount hook let the map's loop bleed
   * into the next station. This cannot — leaving the module *is* the signal.
   */
  useEffect(() => {
    if (!hasBooted) return;
    setMapAmbience(currentModule === "map");
  }, [currentModule, hasBooted]);

  // A reload or tab close while on the map must not leave the bed suppressed
  // for the next session's boot.
  useEffect(() => () => setMapAmbience(false), []);

  const renderModule = () => {
    switch (currentModule) {
      case "dashboard":
        return <DashboardPage />;
        
      case "detective-board":
        return <DetectiveBoardPage />;
        
      case "case-files":
        return <DossierPage />;

      case "map":
        return <MapModule />;
        
      case "crypto-lab":
        return <CryptoLab />;
        
      case "encoding-lab":
        return <EncodingLab />;
        
      case "image-forensics":
      case "steganography-lab":
        return <ImageForensicsLab />;

      case "audio-forensics":
        return <AudioForensicsLab />;

      case "file-analysis":
        return <FileAnalysisLab />;
        
      case "cyberchef-pipeline":
        return <CyberChefPipeline />;
        
      case "tool-database":
        return <ToolDatabase />;
        
      case "settings":
        return <SettingsPage />;

      default:
        return <DashboardPage />;
    }
  };

  return (
    <>
      <AnimatePresence>
        {!hasBooted && (
          <BelfryBootScreen onComplete={() => setHasBooted(true)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isChallengeOpen && <CredentialChallenge onClose={closeChallenge} />}
      </AnimatePresence>

      <MainLayout>
        {skipBoot ? (
          // Dev/verification path: instant module swap, no transition animation.
          <div key={currentModule} className="relative w-full h-full overflow-hidden">
            {renderModule()}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentModule}
              initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
              animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
              exit={{ opacity: 0, clipPath: "inset(100% 0 0 0)" }}
              onAnimationComplete={() => {
                if (hasBooted) playLoadTab(currentModule);
              }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full h-full overflow-hidden"
            >
              {/* Decrypt band sweeps down over the incoming module as it authenticates & resolves */}
              <div key={`band-${currentModule}`} className="decrypt-band z-50" style={{ height: "35%" }} />
              {/* Brief hairline scan-line trailing the reveal */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-cyan-primary/95 to-transparent opacity-80 pointer-events-none z-50 animate-scanline-sweep" />

              {renderModule()}
            </motion.div>
          </AnimatePresence>
        )}
      </MainLayout>
    </>
  );
}

