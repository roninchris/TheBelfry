import { useReducedMotion } from "motion/react";
import { getKnight } from "../../lib/identity";
import { useAppStore } from "../../store/appStore";
import { playHoverBlip } from "../../lib/soundEngine";

/**
 * The active operative's full logo, persistent in the header.
 *
 * Renders nothing for a guest — which also keeps the challenge hidden, since a
 * visitor never sees evidence that identities exist at all.
 *
 * Uses the knight's FULL character logo (not the compact sigil, which stays on
 * evidence-card attribution pins): "logged in as a knight" reads at a glance
 * from any module. The chrome (frame, backing, pulse, glow) is themed and only
 * the logo carries the knight's colour. Clicking it reopens the challenge,
 * which for a signed-in knight is the session panel — and the only way out.
 */
export default function KnightBadge() {
  const reduce = useReducedMotion();
  const currentIdentity = useAppStore((s) => s.currentIdentity);
  const openChallenge = useAppStore((s) => s.openChallenge);
  const knight = getKnight(currentIdentity);

  if (!knight) return null;

  const { accent, fullLogo, label } = knight;

  return (
    <button
      type="button"
      onClick={openChallenge}
      onMouseEnter={() => playHoverBlip()}
      aria-label={`Active operative: ${label}. Open session panel.`}
      className="flex items-center gap-2.5 border-l border-border-hairline/20 pl-4 cursor-pointer group"
    >
      {/* A wider frame than the old round sigil box, because the full logos are
          wide character marks: the frame auto-sizes to the logo's aspect. The
          logo itself carries the knight's colour and glow; the chrome stays
          themed so a saturated mark never reads as a foreign element. */}
      <span className="relative h-10 shrink-0 flex items-center justify-center px-2.5 rounded-md border border-border-hairline/30 bg-bg-void/60 transition-[border-color,box-shadow] duration-200 group-hover:border-accent-primary/60 group-hover:shadow-[0_0_12px_-2px_var(--color-accent-primary)]">
        {/* A slow inner glow — still alive, but it does not draw the eye away
            from the module content. */}
        {!reduce && (
          <span
            className="absolute inset-[3px] rounded-[3px] animate-hex-pulse-flicker pointer-events-none"
            style={{ backgroundColor: `${accent}12` }}
          />
        )}
        <img
          src={fullLogo}
          alt=""
          draggable={false}
          className="h-6 w-auto max-w-[72px] object-contain relative z-10"
          style={{ filter: `drop-shadow(0 0 5px ${accent}aa) drop-shadow(0 0 1px var(--color-bg-void))` }}
        />
      </span>

      <span className="hidden xl:flex flex-col items-start leading-tight">
        <span
          className="font-display text-[13px] font-black tracking-[0.16em] uppercase transition-colors"
          style={{ color: accent }}
        >
          {label}
        </span>
        <span className="font-share text-[12px] tracking-[0.12em] text-cyan-dim/70 uppercase mt-0.5">
          Oracle link
        </span>
      </span>
    </button>
  );
}
