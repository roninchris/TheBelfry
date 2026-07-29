import { useAppStore } from "../../store/appStore";
import { getKnight, isKnightId, type KnightId } from "../../lib/identity";

/**
 * Multiplayer presence, split out of DetectiveBoardPage on purpose.
 *
 * Cursor positions arrive over Realtime many times per second, per knight. If
 * the board component subscribed to `knightCursors` it would re-render the whole
 * canvas — every node, connection and animation — on every frame, which is what
 * made moving cursors feel "VERY laggy". These two components subscribe to the
 * presence slices themselves, so an incoming cursor frame only re-renders this
 * small overlay and never touches the board.
 */

/** How long after a knight's last frame we keep showing their cursor. */
const CURSOR_STALE_MS = 10000;

/**
 * The angular HUD nameplate shared by cursors and the roster.
 *
 * No rounded frame: several knight logos (Red Robin especially) already carry
 * their own circular mark, so a round chip on top read as a circle-on-circle.
 * A notched rectangle with an accent edge bar sits inside the Batcomputer
 * language and lets the logo run large and legible instead.
 */
function KnightPlate({ knight, logoClass }: { knight: NonNullable<ReturnType<typeof getKnight>>; logoClass: string }) {
  return (
    <div
      className="relative flex items-center pl-2 pr-2.5 py-1 bg-bg-void/90 backdrop-blur-sm"
      style={{
        boxShadow: `0 0 10px ${knight.accent}55, inset 0 0 0 1px ${knight.accent}55`,
        clipPath: "polygon(6% 0, 100% 0, 100% 68%, 94% 100%, 0 100%, 0 26%)",
      }}
    >
      {/* Accent edge bar */}
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: knight.accent, boxShadow: `0 0 6px ${knight.accent}` }} />
      <img
        src={knight.fullLogo}
        alt={knight.label}
        draggable={false}
        className={`${logoClass} w-auto object-contain`}
        style={{ filter: `drop-shadow(0 0 4px ${knight.accent})` }}
      />
    </div>
  );
}

/**
 * Live cursors of the other knights, positioned in canvas space and
 * counter-scaled so each marker stays a constant on-screen size regardless of
 * zoom. Rendered inside the board's pan/zoom container.
 */
export function KnightCursorsLayer({ zoom }: { zoom: number }) {
  const knightCursors = useAppStore((s) => s.knightCursors);
  const presentKnights = useAppStore((s) => s.presentKnights);
  const currentIdentity = useAppStore((s) => s.currentIdentity);

  return (
    <>
      {Object.entries(knightCursors).map(([id, c]) => {
        if (id === currentIdentity) return null;
        if (!isKnightId(id) || !presentKnights.includes(id as KnightId)) return null;
        const knight = getKnight(id as KnightId);
        if (!knight) return null;
        if (Date.now() - c.at > CURSOR_STALE_MS) return null;
        return (
          <div key={id} className="absolute pointer-events-none z-[70]" style={{ left: c.x, top: c.y }}>
            {/* One counter-scaled unit: pointer + nameplate always move and
                paint together, so the arrow can never be dropped on its own.
                The cursor shows the CALLSIGN, not the logo — a name reads at any
                zoom where a tiny character mark just smears (and can't look
                "empty"); the rosters carry the logos. */}
            <div className="flex items-start" style={{ transform: `scale(${1 / zoom})`, transformOrigin: "top left" }}>
              <svg width="20" height="22" viewBox="0 0 20 22" className="shrink-0" style={{ filter: `drop-shadow(0 0 4px ${knight.accent})` }}>
                <path
                  d="M2 1 L2 18 L6.6 13.7 L9.7 20 L12.4 18.8 L9.4 12.6 L15.8 12.4 Z"
                  fill={knight.accent}
                  stroke="var(--color-bg-void)"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                className="-ml-0.5 mt-2 relative flex items-center h-5 pl-2 pr-2 bg-bg-void/90 backdrop-blur-sm"
                style={{
                  boxShadow: `0 0 10px ${knight.accent}55, inset 0 0 0 1px ${knight.accent}66`,
                  clipPath: "polygon(8% 0, 100% 0, 100% 66%, 92% 100%, 0 100%, 0 30%)",
                }}
              >
                <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: knight.accent, boxShadow: `0 0 6px ${knight.accent}` }} />
                <span
                  className="font-display text-[11px] font-black tracking-[0.14em] uppercase whitespace-nowrap"
                  style={{ color: knight.accent }}
                >
                  {knight.callsign}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * The roster of every knight currently on the board (self included), pinned
 * top-right in screen space. Presence changes rarely, so this re-renders far
 * less than the cursor layer.
 */
export function PresenceRoster() {
  const presentKnights = useAppStore((s) => s.presentKnights);
  const currentIdentity = useAppStore((s) => s.currentIdentity);
  if (!currentIdentity || presentKnights.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 z-40 flex items-center gap-2 pointer-events-none">
      {presentKnights.map((id) => {
        const k = getKnight(id);
        if (!k) return null;
        const isSelf = id === currentIdentity;
        return (
          <div key={id} className="flex flex-col items-center" title={isSelf ? `${k.label} (You)` : k.label}>
            <KnightPlate knight={k} logoClass="h-8" />
            {isSelf && (
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] mt-1" style={{ color: k.accent }}>
                You
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
