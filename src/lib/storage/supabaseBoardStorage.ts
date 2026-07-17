import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { THREAT_LEVELS, type Case, type EvidenceConnection, type EvidenceNode } from "../../store/appStore";
import { isKnightId, type KnightId } from "../identity";
import type { BoardRealtimeHandlers, BoardSnapshot, BoardStorage } from "./types";

/**
 * Minimum gap between broadcast drag frames, in ms.
 *
 * A pointer can emit well over 100 events/sec. ~20/sec is smooth enough to read
 * as live movement while keeping the channel (and the free tier's message
 * budget) sane.
 */
const DRAG_BROADCAST_INTERVAL_MS = 50;

/** Private Storage bucket holding evidence images. Create it in the dashboard. */
const EVIDENCE_BUCKET = "evidence";

/**
 * Signed-URL lifetime, in seconds (7 days).
 *
 * Long enough that images never break during a session, yet the URL is still a
 * time-limited grant that only a knight can mint. The path — not the URL — is
 * what lives in the database, so a stranger who cannot read the RLS-gated row
 * can never obtain a URL at all.
 */
const SIGNED_URL_TTL = 604800;

/** Resolved signed URLs, cached until shortly before they expire. */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function isDirectlyDisplayable(ref: string): boolean {
  return ref.startsWith("data:") || ref.startsWith("http://") || ref.startsWith("https://");
}

/**
 * The knights' shared board, in Supabase.
 *
 * Only ever bound for an authenticated knight. Access control lives entirely in
 * Row Level Security (see supabase/schema.sql) — nothing here is a security
 * check, because anything in this file is client code a determined visitor can
 * read and bypass.
 *
 * Note what is NOT sent: created_by is omitted from every write. The database
 * stamps it from the session, so attribution cannot be forged from the client.
 */
export class SupabaseBoardStorage implements BoardStorage {
  readonly kind = "cloud" as const;

  private channel: RealtimeChannel | null = null;
  private lastDragSentAt = 0;

  /**
   * Identifies this tab, not this knight.
   *
   * Drag echoes must be suppressed per-connection: keying on knightId would
   * make two tabs signed in as the same operative ignore each other, which is
   * exactly the case someone hits by opening the board twice.
   */
  private readonly clientId = `c${Math.random().toString(36).slice(2, 10)}`;

  constructor(
    private readonly client: SupabaseClient,
    private readonly knightId: KnightId
  ) {}

  /**
   * Opens one channel carrying all three realtime concerns.
   *
   *  - postgres_changes: durable state. Honours RLS, so a non-knight receives
   *    no events even if they somehow opened the channel.
   *  - broadcast: in-flight drag positions, which must never hit the database.
   *  - presence: who is on the board.
   */
  subscribe(handlers: BoardRealtimeHandlers): () => void {
    this.dispose();

    const channel = this.client.channel("belfry-board", {
      config: { presence: { key: this.knightId } },
    });
    this.channel = channel;

    const table = (name: string, apply: (id: string, row: any | null) => void) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: name },
        (payload: any) => {
          // On DELETE, Postgres only replicates the identity columns, so `old`
          // carries the primary key and nothing else — which is all we need.
          const id = payload.new?.id ?? payload.old?.id;
          if (!id) return;
          apply(id, payload.eventType === "DELETE" ? null : payload.new);
        }
      );

    table("cases", (id, row) => handlers.onCase(id, row ? toCase(row) : null));
    table("evidence_nodes", (id, row) => handlers.onNode(id, row ? toNode(row) : null));
    table("evidence_connections", (id, row) =>
      handlers.onConnection(id, row ? toConnection(row) : null)
    );

    channel.on("broadcast", { event: "drag" }, ({ payload }: any) => {
      // Supabase does not echo broadcasts to the sender by default; this is
      // belt-and-braces, and is keyed per-tab so a second tab belonging to the
      // same knight still receives the movement.
      if (!payload || payload.by === this.clientId) return;
      handlers.onDrag(payload.nodeId, payload.x, payload.y);
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const knights = Object.keys(state).filter(isKnightId);
      handlers.onPresence(knights);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ knightId: this.knightId, at: Date.now() });
      }
    });

    return () => this.dispose();
  }

  broadcastDrag(nodeId: string, x: number, y: number): void {
    const now = Date.now();
    if (now - this.lastDragSentAt < DRAG_BROADCAST_INTERVAL_MS) return;
    this.lastDragSentAt = now;
    void this.channel?.send({
      type: "broadcast",
      event: "drag",
      payload: { nodeId, x, y, by: this.clientId },
    });
  }

  dispose(): void {
    if (!this.channel) return;
    void this.client.removeChannel(this.channel);
    this.channel = null;
  }

  /**
   * Uploads the image and returns its object path — what goes in the node's
   * `content`. The bytes stay out of the synced row, so Realtime only ever
   * carries the short path.
   */
  async uploadAsset(file: File): Promise<string> {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await this.client.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw new Error(`Evidence upload failed: ${error.message}`);
    return path;
  }

  async resolveAssetUrl(ref: string): Promise<string> {
    if (isDirectlyDisplayable(ref)) return ref;

    const cached = signedUrlCache.get(ref);
    // Refresh a little before expiry so a long-open board never shows a dead URL.
    if (cached && cached.expiresAt - Date.now() > 60_000) return cached.url;

    const { data, error } = await this.client.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(ref, SIGNED_URL_TTL);
    if (error || !data) throw new Error(`Could not resolve evidence image: ${error?.message}`);

    signedUrlCache.set(ref, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL * 1000 });
    return data.signedUrl;
  }

  async load(): Promise<BoardSnapshot> {
    const [cases, nodes, connections] = await Promise.all([
      this.client.from("cases").select("*"),
      this.client.from("evidence_nodes").select("*"),
      this.client.from("evidence_connections").select("*"),
    ]);

    const failure = cases.error ?? nodes.error ?? connections.error;
    if (failure) throw new Error(`Board load failed: ${failure.message}`);

    return {
      cases: (cases.data ?? []).map(toCase),
      evidenceNodes: (nodes.data ?? []).map(toNode),
      evidenceConnections: (connections.data ?? []).map(toConnection),
    };
  }

  async putCase(value: Case): Promise<void> {
    await this.run(
      "cases",
      this.client.from("cases").upsert({
        id: value.id,
        title: value.title,
        synopsis: value.synopsis,
        status: value.status,
        created_at: value.createdAt,
        color_tag: value.colorTag ?? null,
        notes: value.notes,
        threat_level: value.threatLevel ?? null,
      })
    );
  }

  removeCase(id: string): Promise<void> {
    return this.run("cases", this.client.from("cases").delete().eq("id", id));
  }

  async putNode(value: EvidenceNode): Promise<void> {
    await this.run(
      "evidence_nodes",
      this.client.from("evidence_nodes").upsert({
        id: value.id,
        case_id: value.caseId,
        type: value.type,
        content: value.content,
        title: value.title ?? null,
        notes: value.notes,
        x: value.x,
        y: value.y,
        width: value.width ?? null,
        height: value.height ?? null,
        color: value.color ?? null,
        created_at: value.createdAt,
      })
    );
  }

  removeNode(id: string): Promise<void> {
    return this.run("evidence_nodes", this.client.from("evidence_nodes").delete().eq("id", id));
  }

  async putConnection(value: EvidenceConnection): Promise<void> {
    await this.run(
      "evidence_connections",
      this.client.from("evidence_connections").upsert({
        id: value.id,
        case_id: value.caseId,
        from_node_id: value.fromNodeId,
        to_node_id: value.toNodeId,
        label: value.label ?? null,
      })
    );
  }

  removeConnection(id: string): Promise<void> {
    return this.run(
      "evidence_connections",
      this.client.from("evidence_connections").delete().eq("id", id)
    );
  }

  private async run(table: string, query: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await query;
    if (error) throw new Error(`${table} write failed: ${error.message}`);
  }
}

// -- row mapping --------------------------------------------------------------
// created_by is validated rather than cast: it arrives from the database, but a
// value outside the known roster would render a broken sigil, so anything
// unrecognised degrades to unattributed.

const asKnight = (value: unknown) => (isKnightId(value) ? value : undefined);

function toCase(row: any): Case {
  return {
    id: row.id,
    title: row.title,
    synopsis: row.synopsis ?? "",
    status: row.status,
    createdAt: row.created_at,
    colorTag: row.color_tag ?? undefined,
    notes: row.notes ?? "",
    createdBy: asKnight(row.created_by),
    threatLevel: THREAT_LEVELS.includes(row.threat_level) ? row.threat_level : undefined,
  };
}

function toNode(row: any): EvidenceNode {
  return {
    id: row.id,
    caseId: row.case_id,
    type: row.type,
    content: row.content ?? "",
    title: row.title ?? undefined,
    notes: row.notes ?? "",
    x: row.x,
    y: row.y,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    color: row.color ?? undefined,
    createdAt: row.created_at,
    createdBy: asKnight(row.created_by),
  };
}

function toConnection(row: any): EvidenceConnection {
  return {
    id: row.id,
    caseId: row.case_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    label: row.label ?? undefined,
    createdBy: asKnight(row.created_by),
  };
}
