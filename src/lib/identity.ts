/**
 * Operative identity.
 *
 * A session is either an authenticated knight or a guest. Guests are strictly
 * local: their board lives in localStorage and is never shared with, or visible
 * to, anyone else. Knights share one cloud board among themselves.
 *
 * `null` is the guest identity. Evidence authored by a guest carries no
 * createdBy, which is why a guest board renders no sigils — on a board with a
 * single author, attribution is noise.
 */

export type KnightId = "redhood" | "redrobin" | "nightwing" | "batgirl";

export interface Knight {
  id: KnightId;
  /** Typed at the credential challenge. Matched case-insensitively. */
  callsign: string;
  /** Display name, uppercased at render sites. */
  label: string;
  /** Public path to the sigil badge. */
  sigil: string;
  /** Identity color: sigil glow now, presence/cursors later. */
  accent: string;
  /**
   * Optical size correction, multiplied into the rendered box.
   *
   * The sigils share a 160px square canvas, but the artwork inside does not
   * share a silhouette: a wide, flat bat fills far less of that square than an
   * upright letterform, so at identical box sizes it reads noticeably smaller.
   * This nudges the wide marks back to matching visual weight. Defaults to 1.
   */
  sigilScale?: number;
}

export const KNIGHTS: Record<KnightId, Knight> = {
  redhood: {
    id: "redhood",
    callsign: "RED HOOD",
    label: "Red Hood",
    sigil: "/assets/Logos/sigil-redhood.png",
    accent: "#ff3b4e",
    // Widest, flattest mark of the four — needs the most correction.
    sigilScale: 1.3,
  },
  redrobin: {
    id: "redrobin",
    callsign: "RED ROBIN",
    label: "Red Robin",
    sigil: "/assets/Logos/sigil-redrobin.png",
    accent: "#ffd12e",
  },
  nightwing: {
    id: "nightwing",
    callsign: "NIGHTWING",
    label: "Nightwing",
    sigil: "/assets/Logos/sigil-nightwing.png",
    accent: "#2f6dff",
  },
  batgirl: {
    id: "batgirl",
    callsign: "BATGIRL",
    label: "Batgirl",
    sigil: "/assets/Logos/sigil-batgirl.png",
    accent: "#ff9ee5",
  },
};

export const KNIGHT_ROSTER: Knight[] = Object.values(KNIGHTS);

export function isKnightId(value: unknown): value is KnightId {
  return typeof value === "string" && value in KNIGHTS;
}

export function getKnight(id: KnightId | null | undefined): Knight | null {
  return isKnightId(id) ? KNIGHTS[id] : null;
}

/** Resolves a typed callsign to an identity. Used by the credential challenge. */
export function resolveCallsign(input: string): Knight | null {
  const normalized = input.trim().toLowerCase().replace(/[\s_-]/g, "");
  return (
    KNIGHT_ROSTER.find(
      (k) => k.id === normalized || k.callsign.toLowerCase().replace(/\s/g, "") === normalized
    ) ?? null
  );
}
