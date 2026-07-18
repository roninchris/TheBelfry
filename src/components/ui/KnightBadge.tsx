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
      {/* The chrome (frame, backing, glow) is themed; only the sigil itself
          carries the knight's colour. Previously the whole badge was painted in
          that hardcoded accent and spun a dashed ring, so e.g. Red Hood's
          saturated red rotated against cyan chrome and read as a foreign
          element rather than part of the console. */}
      <span
        className="tablet-frame relative w-10 h-10 shrink-0 flex items-center justify-center border border-border-hairline/30 bg-bg-void/60 transition-shadow duration-300 group-hover:border-accent-primary/40"
        style={{ "--frame-color": "var(--color-accent-primary)" } as React.CSSProperties}
      >
        {/* A slow inner glow replaces the rotating ring: still alive, but it
            does not draw the eye away from the module content. */}
        {!reduce && (
          <span
            className="absolute inset-[3px] animate-hex-pulse-flicker pointer-events-none"
            style={{ backgroundColor: `${accent}14` }}
          />
        )}
        <img
          src={sigil}
          alt=""
          draggable={false}
          className="w-7 h-7 object-contain relative z-10"
          style={{
            // Same optical correction as the board pin: wide, flat marks read
            // smaller than upright ones at an identical box size.
            transform: `scale(${knight.sigilScale ?? 1})`,
            filter: `drop-shadow(0 0 4px ${accent}99)`,
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
        <span className="font-share text-[12px] tracking-[0.14em] text-cyan-dim/70 uppercase">
          Oracle link
        </span>
      </span>
    </button>
  );
}
