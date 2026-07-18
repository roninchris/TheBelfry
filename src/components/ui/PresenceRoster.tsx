import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getKnight } from "../../lib/identity";
import { useAppStore } from "../../store/appStore";

/**
 * The other knights currently on the board.
 *
 * Only ever populated for an authenticated session — a guest has no channel and
 * therefore no roster, so this renders nothing and gives away nothing.
 *
 * Shows others only: your own sigil already sits beside this in the header, and
 * repeating it would just read as a duplicate.
 */
export default function PresenceRoster() {
  const reduce = useReducedMotion();
  const presentKnights = useAppStore((s) => s.presentKnights);
  const currentIdentity = useAppStore((s) => s.currentIdentity);

  const others = presentKnights.filter((id) => id !== currentIdentity);
  if (!currentIdentity || others.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 border-l border-border-hairline/20 pl-4"
      title={`Also on the board: ${others.map((id) => getKnight(id)?.label).join(", ")}`}
    >
      <span className="font-share text-[12px] tracking-[0.16em] text-cyan-dim/70 uppercase hidden xl:inline">
        On board
      </span>
      <div className="flex items-center -space-x-1">
        <AnimatePresence initial={false}>
          {others.map((id) => {
            const knight = getKnight(id);
            if (!knight) return null;
            return (
              <motion.span
                key={id}
                initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                transition={{ duration: reduce ? 0 : 0.3, ease: "backOut" }}
                className="relative w-7 h-7 rounded-full border flex items-center justify-center bg-bg-void"
                style={{ borderColor: `${knight.accent}66` }}
                title={`${knight.label} is on the board`}
              >
                <img
                  src={knight.sigil}
                  alt=""
                  draggable={false}
                  className="w-4 h-4 object-contain"
                  style={{
                    transform: `scale(${knight.sigilScale ?? 1})`,
                    filter: `drop-shadow(0 0 4px ${knight.accent}b3)`,
                  }}
                />
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
