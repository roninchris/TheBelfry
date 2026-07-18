import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { KNIGHTS, getKnight } from "../../lib/identity";
import { signInAsKnight, signOutKnight } from "../../lib/session";
import { useAppStore } from "../../store/appStore";
import {
  playDecypheringLoop,
  stopDecypheringLoop,
  playDecryptResolve,
  playFailBuzz,
  playGlitchBurst,
  playCloseFile,
  playHoverBlip,
  playReticleLock,
} from "../../lib/soundEngine";
import GlassPanel from "./GlassPanel";
import DecryptText from "./DecryptText";

interface CredentialChallengeProps {
  onClose: () => void;
}

type Phase = "idle" | "verifying" | "granted" | "denied";

/**
 * The credential challenge.
 *
 * Not a gate and not a route: it exists only behind the sidebar emblem. A guest
 * never encounters it, and one opened by accident closes with Escape, the
 * backdrop, or the corner control — nothing about the session changes on close.
 */
export default function CredentialChallenge({ onClose }: CredentialChallengeProps) {
  const reduce = useReducedMotion();
  const setIdentity = useAppStore((s) => s.setIdentity);
  const addLog = useAppStore((s) => s.addLog);
  const sessionResolved = useAppStore((s) => s.sessionResolved);
  const currentIdentity = useAppStore((s) => s.currentIdentity);

  const [callsign, setCallsign] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [denialReason, setDenialReason] = useState("");
  const grantedKnight = useRef<{ label: string; sigil: string } | null>(null);
  const callsignRef = useRef<HTMLInputElement>(null);

  const dismissable = phase !== "verifying" && phase !== "granted";

  const dismiss = () => {
    if (!dismissable) return;
    playCloseFile();
    onClose();
  };

  useEffect(() => {
    callsignRef.current?.focus();
    return () => stopDecypheringLoop();
  }, []);

  // Escape closes — the accidental-click escape hatch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) {
        e.stopPropagation();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissable]);

  const canSubmit = callsign.trim().length > 0 && code.length > 0 && (phase === "idle" || phase === "denied");

  /**
   * Editing after a rejection clears it. Without this the challenge latches on
   * "denied" and a single typo locks the operative out until they reload.
   */
  const edit = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (phase === "denied") {
      setPhase("idle");
      setDenialReason("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setPhase("verifying");
    setDenialReason("");
    playDecypheringLoop();

    const result = await signInAsKnight(callsign, code);
    stopDecypheringLoop();

    if (!result.ok) {
      playFailBuzz();
      playGlitchBurst();
      setPhase("denied");
      // An unknown callsign and a wrong code read identically. Only an
      // unconfigured backend is called out, because that is an operator error
      // rather than a rejection and would otherwise look like a lie.
      setDenialReason(
        result.reason === "unconfigured"
          ? "ORACLE LINK OFFLINE // NO REMOTE AUTHORITY"
          : "CREDENTIALS REJECTED // NO MATCHING OPERATIVE"
      );
      addLog(`AUTHENTICATION REJECTED FOR CALLSIGN "${callsign.toUpperCase()}"`, "warning", "ORACLE-LINK");
      setCode("");
      return;
    }

    const knight = KNIGHTS[result.knightId];
    grantedKnight.current = { label: knight.label.toUpperCase(), sigil: knight.sigil };
    setPhase("granted");
    playDecryptResolve();
    addLog(`IDENTITY CONFIRMED: ${knight.label.toUpperCase()}`, "success", "ORACLE-LINK");

    await setIdentity(result.knightId);
    window.setTimeout(onClose, reduce ? 0 : 1400);
  };

  const signOut = async () => {
    const previous = getKnight(currentIdentity);
    playCloseFile();
    await signOutKnight();
    await setIdentity(null);
    addLog(`SESSION TERMINATED: ${previous?.label.toUpperCase() ?? "OPERATIVE"} // REVERTED TO LOCAL CACHE`, "warning", "ORACLE-LINK");
    onClose();
  };

  const fieldClass =
    "w-full bg-bg-void/70 border px-3 py-2 font-share text-sm tracking-[0.2em] uppercase " +
    "text-cyan-text outline-none transition-colors placeholder:text-cyan-dim/40 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      onMouseDown={(e) => {
        // Backdrop only — a mousedown that started inside the panel must not close.
        if (e.target === e.currentTarget) dismiss();
      }}
      className="fixed inset-0 z-[100] bg-bg-void/92 backdrop-blur-sm flex items-center justify-center overflow-hidden select-none"
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.04] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-cyan-primary/30 shadow-[0_0_10px_var(--color-accent-primary)] animate-scanline-vertical pointer-events-none" />

      <motion.div
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative"
      >
        <GlassPanel
          clipSize="md"
          showCornerTicks
          glow={phase === "granted"}
          className={`p-7 transition-colors duration-300 ${
            phase === "denied"
              ? "border-red-threat/60 shadow-[0_0_20px_rgb(var(--rgb-threat) / 0.25)]"
              : phase === "granted"
                ? "border-accent-primary/60 shadow-[0_0_24px_rgb(var(--rgb-accent) / 0.25)]"
                : ""
          }`}
        >
          {dismissable && (
            <button
              type="button"
              onClick={dismiss}
              onMouseEnter={() => playHoverBlip()}
              aria-label="Close"
              className="absolute top-3 right-3 p-1 text-cyan-dim hover:text-cyan-text hover:bg-cyan-primary/15 transition-colors cursor-pointer z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {!sessionResolved ? (
            <RestoringPanel reduce={!!reduce} />
          ) : currentIdentity ? (
            <SessionPanel identityId={currentIdentity} onSignOut={signOut} reduce={!!reduce} />
          ) : phase === "granted" ? (
            <GrantedPanel
              label={grantedKnight.current?.label ?? ""}
              sigil={grantedKnight.current?.sigil ?? null}
              reduce={!!reduce}
            />
          ) : (
            <>
              <header className="text-center space-y-3 mb-7">
                <img
                  src="/assets/icons/iconbelfry.png"
                  alt=""
                  className="w-12 h-12 mx-auto object-contain filter drop-shadow-[0_0_10px_rgb(var(--rgb-accent) / 0.5)]"
                />
                <h1 className="font-display text-[14px] font-black tracking-[0.35em] text-cyan-primary uppercase">
                  Credential Challenge
                </h1>
                <p className="font-share text-[12px] tracking-[0.18em] text-cyan-dim uppercase">
                  Restricted tier // Oracle link required
                </p>
              </header>

              <form onSubmit={submit} className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="font-share text-[12px] tracking-[0.25em] text-cyan-dim uppercase">
                    Operative Callsign
                  </span>
                  <input
                    ref={callsignRef}
                    value={callsign}
                    onChange={edit(setCallsign)}
                    disabled={phase === "verifying"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="—"
                    className={`${fieldClass} ${
                      phase === "denied" ? "border-red-threat/50" : "border-cyan-primary/25 focus:border-accent-primary/70"
                    }`}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="font-share text-[12px] tracking-[0.25em] text-cyan-dim uppercase">
                    Authorization Code
                  </span>
                  <input
                    type="password"
                    value={code}
                    onChange={edit(setCode)}
                    disabled={phase === "verifying"}
                    autoComplete="off"
                    placeholder="—"
                    className={`${fieldClass} tracking-[0.35em] ${
                      phase === "denied" ? "border-red-threat/50" : "border-cyan-primary/25 focus:border-accent-primary/70"
                    }`}
                  />
                </label>

                <div className="h-9 flex items-center justify-center">
                  {phase === "verifying" && <VerifyingIndicator reduce={!!reduce} />}
                  {phase === "denied" && (
                    <motion.p
                      initial={reduce ? {} : { x: [-6, 6, -4, 4, 0] }}
                      animate={{ x: 0 }}
                      transition={{ duration: 0.4 }}
                      className="font-share text-[12px] tracking-[0.16em] text-red-threat uppercase text-center"
                      role="alert"
                    >
                      {denialReason}
                    </motion.p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  onMouseEnter={() => canSubmit && playReticleLock()}
                  className="w-full py-2.5 font-display text-[13px] font-black tracking-[0.3em] uppercase
                             border border-accent-primary/50 text-accent-primary bg-accent-primary/[0.06]
                             transition-all duration-200 cursor-pointer
                             hover:bg-accent-primary/15 hover:shadow-[0_0_16px_rgb(var(--rgb-accent) / 0.25)]
                             disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-accent-primary/[0.06]
                             disabled:hover:shadow-none"
                >
                  {phase === "verifying" ? "Verifying" : "Authenticate"}
                </button>
              </form>

              <p className="mt-6 pt-4 border-t border-border-hairline/40 text-center font-share text-[11px] tracking-[0.15em] text-cyan-dim/60 uppercase">
                Dismiss to continue on the local cache
              </p>
            </>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}

/**
 * Shown to a signed-in knight. The emblem is the only entry point, so this is
 * also the only way out — without it a session could never be ended.
 */
function SessionPanel({
  identityId,
  onSignOut,
  reduce,
}: {
  identityId: keyof typeof KNIGHTS;
  onSignOut: () => void;
  reduce: boolean;
}) {
  const knight = KNIGHTS[identityId];
  return (
    <div className="py-4 flex flex-col items-center gap-4 text-center">
      <motion.img
        src={knight.sigil}
        alt=""
        initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: "backOut" }}
        className="w-14 h-14 object-contain"
        style={{ filter: `drop-shadow(0 0 8px ${knight.accent}90)` }}
      />
      <div className="space-y-1">
        <p className="font-share text-[12px] tracking-[0.3em] text-cyan-dim uppercase">Active operative</p>
        <h2 className="font-display text-sm font-black tracking-[0.25em] text-accent-primary uppercase">
          {knight.label}
        </h2>
        <p className="font-share text-[11px] tracking-[0.18em] text-cyan-dim/80 uppercase pt-1">
          Oracle link active // Board shared
        </p>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        onMouseEnter={() => playHoverBlip()}
        className="mt-2 w-full py-2 font-display text-[12px] font-black tracking-[0.28em] uppercase
                   border border-red-threat/40 text-red-threat/90 bg-red-threat/[0.05]
                   hover:bg-red-threat/15 hover:shadow-[0_0_14px_rgb(var(--rgb-threat) / 0.2)]
                   transition-all duration-200 cursor-pointer"
      >
        Terminate session
      </button>
      <p className="font-share text-[11px] tracking-[0.15em] text-cyan-dim/60 uppercase">
        Reverts this browser to the local cache
      </p>
    </div>
  );
}

/**
 * Shown while the stored session is still being probed. Rare now that the
 * challenge opens on demand, but it must exist: opening it mid-probe would
 * otherwise show a login form to a knight who is already signed in.
 */
function RestoringPanel({ reduce }: { reduce: boolean }) {
  return (
    <div className="py-10 flex flex-col items-center gap-4 text-center">
      <motion.img
        src="/assets/icons/iconbelfry.png"
        alt=""
        animate={reduce ? { opacity: 0.8 } : { opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        className="w-12 h-12 object-contain"
      />
      <p className="font-share text-[12px] tracking-[0.25em] text-cyan-dim uppercase">
        Interrogating oracle link
      </p>
    </div>
  );
}

/** Verification reads as the system working a decryption, not a spinner. */
function VerifyingIndicator({ reduce }: { reduce: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="w-[2px] h-3 bg-accent-primary"
            animate={reduce ? { opacity: 0.6 } : { scaleY: [0.3, 1, 0.3], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.09 }}
          />
        ))}
      </div>
      <span className="font-share text-[12px] tracking-[0.2em] text-accent-primary/90 uppercase">
        Decrypting credentials
      </span>
    </div>
  );
}

/** The "got it" beat: the operative's sigil resolving out of the challenge. */
function GrantedPanel({ label, sigil, reduce }: { label: string; sigil: string | null; reduce: boolean }) {
  return (
    <div className="py-6 flex flex-col items-center gap-4 text-center">
      {sigil && (
        <motion.img
          src={sigil}
          alt=""
          initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.5, ease: "backOut" }}
          className="w-16 h-16 object-contain"
        />
      )}
      <div className="space-y-1.5">
        <p className="font-share text-[12px] tracking-[0.3em] text-cyan-dim uppercase">Identity Confirmed</p>
        <h2 className="font-display text-base font-black tracking-[0.25em] text-accent-primary uppercase">
          <DecryptText text={label} duration={700} silent />
        </h2>
        <p className="font-share text-[11px] tracking-[0.18em] text-cyan-dim/80 uppercase pt-1">
          Oracle link established // Board synchronizing
        </p>
      </div>
    </div>
  );
}
