import type { Case, EvidenceConnection, EvidenceNode } from "../../store/appStore";

/**
 * The complete board state owned by a storage backend.
 *
 * Scratch notes, audio settings and module state are deliberately absent:
 * those are per-device preferences and stay in localStorage for everyone,
 * knight or guest.
 */
export interface BoardSnapshot {
  cases: Case[];
  evidenceNodes: EvidenceNode[];
  evidenceConnections: EvidenceConnection[];
}

export const EMPTY_SNAPSHOT: BoardSnapshot = {
  cases: [],
  evidenceNodes: [],
  evidenceConnections: [],
};

/**
 * Where a board lives.
 *
 * Two implementations, bound by session identity and never mixed:
 *  - "local"  — guests. Pure localStorage, no network calls at all.
 *  - "cloud"  — knights. Supabase, shared between the four of them.
 *
 * The store calls this interface and never learns which is bound. That is what
 * keeps guest and knight data separated structurally rather than by convention:
 * a guest session holds no client capable of reaching the network.
 *
 * Mutations are fire-and-forget from the store's perspective — in-memory state
 * updates optimistically and a rejected promise surfaces as a sync warning
 * rather than a rollback. Realtime reconciliation lands with the multiplayer
 * work; until then a failed write means the local view is ahead of the server.
 */
export interface BoardStorage {
  readonly kind: "local" | "cloud";

  /** Full board read. Called on session start and on identity change. */
  load(): Promise<BoardSnapshot>;

  putCase(value: Case): Promise<void>;
  removeCase(id: string): Promise<void>;

  putNode(value: EvidenceNode): Promise<void>;
  removeNode(id: string): Promise<void>;

  putConnection(value: EvidenceConnection): Promise<void>;
  removeConnection(id: string): Promise<void>;

  /** Releases subscriptions/channels. Called when the identity changes. */
  dispose?(): void;
}
