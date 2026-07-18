import { motion } from "motion/react";
import { getKnight, type KnightId } from "../../lib/identity";

interface KnightSigilProps {
  /** Author of the evidence. Guest-authored (undefined) renders nothing. */
  knightId?: KnightId | null;
  size?: number;
  /** Suppresses the entrance animation for reduced-motion sessions. */
  reducedMotion?: boolean;
  className?: string;
}

/**
 * Attribution mark pinned to a piece of evidence — who put this on the board.
 * Renders nothing for guests, since a solo local board has only one author.
 */
export default function KnightSigil({
  knightId,
  size = 30,
  reducedMotion = false,
  className = "",
}: KnightSigilProps) {
  const knight = getKnight(knightId);
  if (!knight) return null;

  // Per-knight optical correction, so a wide bat and an upright R read at the
  // same visual weight. The box is grown around its centre, keeping the pin
  // anchored to the card corner.
  const box = size * (knight.sigilScale ?? 1);
  const offset = (box - size) / 2;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : 0.18, ease: "backOut" }}
      className={`pointer-events-none absolute z-20 ${className}`}
      style={{ width: box, height: box, top: -14 - offset, left: -14 - offset }}
      title={`PLACED BY // ${knight.label.toUpperCase()}`}
      aria-label={`Placed by ${knight.label}`}
    >
      <img
        src={knight.sigil}
        alt=""
        draggable={false}
        className="w-full h-full object-contain"
        style={{ filter: `drop-shadow(0 0 5px ${knight.accent}90) drop-shadow(0 0 1px var(--color-bg-void))` }}
      />
    </motion.div>
  );
}
