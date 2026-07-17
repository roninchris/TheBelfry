import type { Case, EvidenceConnection, EvidenceNode } from "../../store/appStore";
import { EMPTY_SNAPSHOT, type BoardSnapshot, type BoardStorage } from "./types";

const KEY = "belfry-board-local";

/** The pre-adapter zustand persist blob. Read once, to migrate boards forward. */
const LEGACY_KEY = "belfry-app-store";

function readSnapshot(raw: string | null): BoardSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      cases: Array.isArray(parsed.cases) ? parsed.cases : [],
      evidenceNodes: Array.isArray(parsed.evidenceNodes) ? parsed.evidenceNodes : [],
      evidenceConnections: Array.isArray(parsed.evidenceConnections) ? parsed.evidenceConnections : [],
    };
  } catch {
    return null;
  }
}

/**
 * Lifts a pre-adapter guest board out of the zustand persist blob and into the
 * adapter's own key.
 *
 * MUST run before the store is created. Board fields are no longer in
 * partialize, so the very first set() rewrites the blob without them — if this
 * ran any later it would read a blob it had already destroyed, silently losing
 * every board made before the refactor.
 *
 * Idempotent, and a no-op once the adapter key exists.
 */
export function migrateLegacyGuestBoard(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(KEY) !== null) return;

  let legacy: BoardSnapshot | null = null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    legacy = readSnapshot(JSON.stringify(JSON.parse(raw)?.state ?? {}));
  } catch {
    return;
  }
  if (!legacy) return;

  const isEmpty =
    !legacy.cases.length && !legacy.evidenceNodes.length && !legacy.evidenceConnections.length;
  if (isEmpty) return;

  localStorage.setItem(KEY, JSON.stringify(legacy));
}

/**
 * Guest board storage. Entirely local — this class holds no network client and
 * makes no requests, which is what guarantees a guest's board cannot reach, or
 * be reached by, the knights' shared board.
 */
export class LocalBoardStorage implements BoardStorage {
  readonly kind = "local" as const;

  private read(): BoardSnapshot {
    return readSnapshot(localStorage.getItem(KEY)) ?? EMPTY_SNAPSHOT;
  }

  private write(snapshot: BoardSnapshot): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch (err) {
      // Quota is the realistic failure here: evidence photos are stored as data
      // URLs and a large board can exceed the ~5MB budget. Surface it rather
      // than silently dropping the write.
      throw new Error(
        `Local board write failed (storage quota?): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private mutate(fn: (snapshot: BoardSnapshot) => BoardSnapshot): Promise<void> {
    this.write(fn(this.read()));
    return Promise.resolve();
  }

  load(): Promise<BoardSnapshot> {
    return Promise.resolve(this.read());
  }

  /** No server: the image lives in the board itself as a data URL. */
  uploadAsset(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  /** Content is already directly displayable (a data URL or plain link). */
  resolveAssetUrl(ref: string): Promise<string> {
    return Promise.resolve(ref);
  }

  putCase(value: Case): Promise<void> {
    return this.mutate((s) => ({
      ...s,
      cases: upsert(s.cases, value),
    }));
  }

  removeCase(id: string): Promise<void> {
    return this.mutate((s) => ({
      cases: s.cases.filter((c) => c.id !== id),
      // Mirrors the cascade the cloud schema enforces with ON DELETE CASCADE.
      evidenceNodes: s.evidenceNodes.filter((n) => n.caseId !== id),
      evidenceConnections: s.evidenceConnections.filter((c) => c.caseId !== id),
    }));
  }

  putNode(value: EvidenceNode): Promise<void> {
    return this.mutate((s) => ({ ...s, evidenceNodes: upsert(s.evidenceNodes, value) }));
  }

  removeNode(id: string): Promise<void> {
    return this.mutate((s) => ({
      ...s,
      evidenceNodes: s.evidenceNodes.filter((n) => n.id !== id),
      evidenceConnections: s.evidenceConnections.filter(
        (c) => c.fromNodeId !== id && c.toNodeId !== id
      ),
    }));
  }

  putConnection(value: EvidenceConnection): Promise<void> {
    return this.mutate((s) => ({
      ...s,
      evidenceConnections: upsert(s.evidenceConnections, value),
    }));
  }

  removeConnection(id: string): Promise<void> {
    return this.mutate((s) => ({
      ...s,
      evidenceConnections: s.evidenceConnections.filter((c) => c.id !== id),
    }));
  }
}

function upsert<T extends { id: string }>(list: T[], value: T): T[] {
  const i = list.findIndex((item) => item.id === value.id);
  if (i === -1) return [...list, value];
  const next = [...list];
  next[i] = value;
  return next;
}
