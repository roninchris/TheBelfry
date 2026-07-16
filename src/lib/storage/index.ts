import type { KnightId } from "../identity";
import { supabase } from "../supabase";
import { LocalBoardStorage } from "./localBoardStorage";
import { SupabaseBoardStorage } from "./supabaseBoardStorage";
import type { BoardStorage } from "./types";

export type { BoardSnapshot, BoardStorage } from "./types";
export { EMPTY_SNAPSHOT } from "./types";
export { LocalBoardStorage, migrateLegacyGuestBoard } from "./localBoardStorage";
export { SupabaseBoardStorage } from "./supabaseBoardStorage";

/**
 * Binds a board backend to a session identity.
 *
 * The single decision point for where a board lives. A guest (null identity)
 * always gets local storage, and a guest session therefore never constructs a
 * network-capable backend at all — the separation is structural, not a check
 * that could be forgotten at a call site.
 *
 * A knight with Supabase unconfigured also falls back to local. That should be
 * unreachable (there is no way to authenticate without a client) but falling
 * back to the private board is the safe direction to fail.
 */
export function storageFor(identity: KnightId | null): BoardStorage {
  if (identity && supabase) return new SupabaseBoardStorage(supabase);
  return new LocalBoardStorage();
}
