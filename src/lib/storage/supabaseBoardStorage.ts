import type { SupabaseClient } from "@supabase/supabase-js";
import type { Case, EvidenceConnection, EvidenceNode } from "../../store/appStore";
import { isKnightId } from "../identity";
import type { BoardSnapshot, BoardStorage } from "./types";

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

  constructor(private readonly client: SupabaseClient) {}

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
