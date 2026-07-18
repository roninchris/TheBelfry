import { useReducedMotion } from "motion/react";
import { getKnight } from "../../lib/identity";
import { useAppStore } from "../../store/appStore";
import { playHoverBlip } from "../../lib/soundEngine";

/**
 * The active operative's sigil, persistent in the header.
 *
 * Renders nothing for a guest — which also keeps the challenge hidden, since a
 * visitor never sees evidence that identities exist at all.
 *
 * Mirrors the sidebar emblem's treatment (breathing pulse, radar sweep, glow)
 * but tinted to the knight's own colour, so "who am I signed in as" is
 * answerable at a glance from any module. Clicking it reopens the challenge,
 * which for a signed-in knight is the session panel — and the only way out.
 */
export default function KnightBadge() {
  const reduce = useReducedMotion();
  const currentIdentity = useAppStore((s) => s.currentIdentity);
  const openChallenge = useAppStore((s) => s.openChallenge);
  const knight = getKnight(currentIdentity);

  if (!knight) return null;

  const { accent, sigil, label } = knight;

  return (
    <button
      type="button"
      onClick={openChallenge}
      onMouseEnter={() => playHoverBlip()}
      aria-label={`Active operative: ${label}. Open session panel.`}
      className="flex items-center gap-2.5 border-l border-border-hairline/20 pl-4 cursor-pointer group"
    >
      <span
        className={`relative w-10 h-10 shrink-0 flex items-center justify-center rounded-full border transition-shadow duration-300 ${
          reduce ? "" : "animate-breathing"
        }`}
        style={{
          borderColor: `${accent}66`,
          backgroundColor: `${accent}0d`,
          boxShadow: `0 0 10px ${accent}33`,
        }}
      >
        {/* Sweep ring, as on the sidebar emblem — the badge reads as live, not static. */}
        {!reduce && (
          <span
            className="absolute inset-0 rounded-full border border-dashed animate-radar-sweep"
            style={{ borderColor: `${accent}2b` }}
          />
        )}
        <img
          src={sigil}
          alt=""
          draggable={false}
          className="w-8 h-8 object-contain"
          style={{
            // Same optical correction as the board pin: wide, flat marks read
            // smaller than upright ones at an identical box size.
            transform: `scale(${knight.sigilScale ?? 1})`,
            filter: `drop-shadow(0 0 5px ${accent}b3)`,
          }}
        />
      </span>

      <span className="hidden xl:flex flex-col items-start leading-tight">
        <span
          className="font-display text-[12px] font-black tracking-[0.18em] uppercase transition-colors"
          style={{ color: accent }}
        >
          {label}
        </span>
        <span className="font-share text-[11px] tracking-[0.14em] text-cyan-dim/70 uppercase">
          Oracle link
        </span>
      </span>
    </button>
  );
}
