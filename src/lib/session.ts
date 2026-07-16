import { isKnightId, resolveCallsign, type KnightId } from "./identity";
import { supabase } from "./supabase";

/**
 * Session resolution for the credential challenge.
 *
 * Identity is always derived from the Supabase session and the `knights` map,
 * never from anything the client stores. A tampered localStorage cannot mint an
 * identity: the map lookup runs against the database under RLS, so a forged
 * session id returns nothing.
 */

/** Callsigns map to accounts. The account emails are an internal detail. */
function emailFor(knightId: KnightId): string {
  return `${knightId}@belfry.local`;
}

export type SignInFailure = "unconfigured" | "bad-credentials" | "not-a-knight";

/**
 * The optional counterpart fields are load-bearing: this project compiles with
 * `strict` off, and without strictNullChecks a boolean-literal discriminant
 * does not narrow. Declaring both keys on both members keeps the result
 * readable under the current config, and still narrows correctly if `strict`
 * is ever turned on.
 */
export type SignInResult =
  | { ok: true; knightId: KnightId; reason?: undefined }
  | { ok: false; knightId?: undefined; reason: SignInFailure };

/**
 * Exchanges a callsign and authorization code for a knight session.
 *
 * An unknown callsign is reported as "bad-credentials", identical to a wrong
 * password: distinguishing them would let a stranger enumerate valid callsigns.
 * (The roster is in the bundle anyway, so this is tidiness more than defence —
 * the passwords are the real gate.)
 */
export async function signInAsKnight(callsign: string, code: string): Promise<SignInResult> {
  if (!supabase) return { ok: false, reason: "unconfigured" };

  const knight = resolveCallsign(callsign);
  if (!knight) return { ok: false, reason: "bad-credentials" };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailFor(knight.id),
    password: code,
  });
  if (error || !data.session) return { ok: false, reason: "bad-credentials" };

  // Authenticating is not enough — the account must be a knight. The board
  // policies enforce this too; checking here means we can refuse the session
  // rather than hand back an identity that can read nothing.
  const knightId = await resolveKnightId(data.session.user.id);
  if (!knightId) {
    await supabase.auth.signOut();
    return { ok: false, reason: "not-a-knight" };
  }

  return { ok: true, knightId };
}

export async function signOutKnight(): Promise<void> {
  await supabase?.auth.signOut();
}

/** The identity for an existing session, or null for a guest. Called at boot. */
export async function resolveSessionIdentity(): Promise<KnightId | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return resolveKnightId(data.session.user.id);
}

async function resolveKnightId(userId: string): Promise<KnightId | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("knights")
    .select("knight_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return isKnightId(data.knight_id) ? data.knight_id : null;
}

/**
 * Fires when a session ends for a reason other than an explicit sign-out —
 * an expired refresh token, or the account being deleted. The app must drop to
 * guest rather than keep showing a board it can no longer write to.
 */
export function onSessionLost(handler: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") handler();
  });
  return () => data.subscription.unsubscribe();
}
