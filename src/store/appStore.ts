import { create } from "zustand";
import { persist } from "zustand/middleware";
import { playSuccessChime, playMaterialize, playPinClick, setSoundVolume, setSoundMuted, setAmbientEnabled } from "../lib/soundEngine";
import { identifyInput } from "../lib/tools/identify";
import { identifyImage, identifyAudio } from "../lib/tools/identify/forensics";
import { detectHiddenMessageInFile, loadImageAsCanvas } from "../lib/tools/image-stego";
import { detectMorse, detectDTMF } from "../lib/audioAnalysis";
import { getAudioContext } from "../lib/soundEngine";
import type { KnightId } from "../lib/identity";
import {
  migrateLegacyGuestBoard,
  storageFor,
  type BoardRealtimeHandlers,
  type BoardStorage,
} from "../lib/storage";
import { onSessionLost, resolveSessionIdentity } from "../lib/session";
import { moduleForTool } from "../lib/toolRouting";

export interface ForensicLog {
  id: string;
  timestamp: string;
  type: "info" | "warning" | "success" | "raw";
  sender: string;
  text: string;
}

/** How dangerous the case is judged to be. Orthogonal to `status`. */
export type ThreatLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export const THREAT_LEVELS: ThreatLevel[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

export interface Case {
  id: string;
  title: string;
  synopsis: string;          // short description of the ARG
  status: "ACTIVE" | "SOLVED" | "ARCHIVED" | "STALLED";
  createdAt: string;
  colorTag?: string;         // optional accent color per case
  notes: string;             // freeform markdown/journal notes for the case
  createdBy?: KnightId;      // absent = opened by a guest on their local board
  threatLevel?: ThreatLevel; // absent on cases filed before this existed
}

export interface EvidenceNode {
  id: string;
  caseId: string;            // which case this belongs to
  type: "photo" | "text" | "link" | "file";
  content: string;           // text content, image data URL, or URL
  title?: string;
  notes: string;             // freeform notes for the evidence
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  createdAt: string;
  createdBy?: KnightId;      // absent = authored by a guest on their local board
}

export interface EvidenceConnection {
  id: string;
  caseId: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  createdBy?: KnightId;      // absent = authored by a guest on their local board
}

export interface EvidenceItem {
  id: string;
  name: string;
  type: "ciphertext" | "image" | "audio" | "hex";
  confidence: number;
  source: string;
  notes: string;
}

export interface NoteEntry {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

/** Board load lifecycle. Drives the board's loading and failure states. */
export type BoardStatus = "loading" | "ready" | "error";

interface AppState {
  /**
   * The signed-in knight, or null for a guest. Deliberately excluded from
   * persistence: it is derived from the auth session on boot, never restored
   * from localStorage, so a cleared session always falls back to guest.
   */
  currentIdentity: KnightId | null;

  /**
   * True once the stored auth session has been probed at boot.
   *
   * Until then we cannot know whether this browser holds a knight session, so
   * the credential challenge must not assume "guest" and show its form — that
   * would flash a login at someone who is already signed in.
   */
  sessionResolved: boolean;

  /**
   * Whether the credential challenge is on screen.
   *
   * There is no route to it and no visible affordance: it opens only from the
   * Belfry emblem in the sidebar. Guests are never shown a login, and one
   * opened by accident closes with Escape or the backdrop.
   */
  isChallengeOpen: boolean;
  openChallenge: () => void;
  closeChallenge: () => void;

  /**
   * Where the board is read from and written to. Rebound whenever identity
   * changes; runtime-only and never persisted.
   */
  boardStorage: BoardStorage;
  boardStatus: BoardStatus;
  boardError: string | null;

  /** Knights currently on the board, from presence. Empty for a guest. */
  presentKnights: KnightId[];

  /**
   * The node this browser is dragging right now, if any.
   *
   * Remote updates for it are ignored while it is held: a change echoing back
   * mid-drag would yank the card out from under the user's pointer.
   */
  draggingNodeId: string | null;
  setDraggingNode: (id: string | null) => void;
  /** Publishes an in-flight drag to the other knights. Memory-only locally. */
  broadcastDrag: (nodeId: string, x: number, y: number) => void;

  /**
   * Binds the identity's board and replaces the in-memory board with it.
   *
   * Every identity change swaps the whole board wholesale — a guest's board and
   * the knights' board are never merged, and never both in memory.
   */
  setIdentity: (id: KnightId | null) => Promise<void>;
  /** Re-reads the current board. For retrying a failed load. */
  reloadBoard: () => Promise<void>;

  currentModule: string;

  /**
   * A tool the catalogue asked another module to open, pending pickup.
   *
   * Read-once: the target module consumes it on arrival and clears it, so
   * navigating back later does not silently re-select an old tool.
   */
  pendingToolId: string | null;
  /** Switches to the tool's home module and asks it to select the tool. */
  openToolInModule: (toolId: string) => void;
  /** Takes the pending tool id, clearing it. Returns null if there is none. */
  consumePendingTool: () => string | null;

  logs: ForensicLog[];
  cases: Case[];
  activeCaseId: string | null;
  evidenceNodes: EvidenceNode[];
  evidenceConnections: EvidenceConnection[];
  isScanning: boolean;
  scanProgress: number;
  scannedEvidence: EvidenceItem | null;
  scanResults: { name: string; confidence: number; isMatch: boolean; details: string }[];
  notes: NoteEntry[];

  // Actions
  setModule: (module: string) => void;
  addLog: (text: string, type?: "info" | "warning" | "success" | "raw", sender?: string) => void;
  clearLogs: () => void;
  triggerForensicScan: (inputData: { name: string; type: "ciphertext" | "image" | "audio" | "hex"; rawContent: string; file?: File }) => void;
  selectCase: (caseId: string) => void;
  
  // Case management
  addCase: (caseData: Omit<Case, "id" | "createdAt" | "notes">) => void;
  updateCaseNotes: (caseId: string, notes: string) => void;
  updateCaseStatus: (caseId: string, status: Case["status"]) => void;
  /** Edits a case's identifying fields. Author and creation time are fixed. */
  updateCaseDetails: (
    caseId: string,
    updates: Partial<Pick<Case, "title" | "synopsis" | "threatLevel">>
  ) => void;
  deleteCase: (caseId: string) => void;
  
  // Evidence Board actions
  addEvidenceNode: (node: Omit<EvidenceNode, "id" | "createdAt" | "caseId" | "notes">) => void;
  /** Stores an image and returns the reference to save in a node's content. */
  uploadEvidenceImage: (file: File) => Promise<string>;
  /** Resolves stored content to a displayable URL (signed, for cloud images). */
  resolveAssetUrl: (ref: string) => Promise<string>;
  /** Memory-only; per-frame during a drag. Persist with commitEvidenceNode. */
  updateEvidenceNodePosition: (id: string, x: number, y: number) => void;
  /** Memory-only; per-frame during a resize. Persist with commitEvidenceNode. */
  resizeEvidenceNode: (id: string, width: number, height: number) => void;
  /** Persists a node's current state. Call on drag/resize end. */
  commitEvidenceNode: (id: string) => void;
  updateEvidenceNodeContent: (id: string, updates: Partial<EvidenceNode>) => void;
  updateEvidenceNodeNotes: (id: string, notes: string) => void;
  deleteEvidenceNode: (id: string) => void;
  
  addEvidenceConnection: (fromId: string, toId: string, label?: string) => void;
  deleteEvidenceConnection: (id: string) => void;
  updateEvidenceConnectionLabel: (id: string, label: string) => void;

  // Persistent scratch notes (available from any tab)
  addNote: (text?: string) => string;
  updateNote: (id: string, text: string) => void;
  deleteNote: (id: string) => void;
  /** Returns whether the note was pinned, so the caller can confirm it. */
  sendNoteToBoard: (id: string) => boolean;

  // Audio settings
  masterVolume: number;
  isMuted: boolean;
  ambientEnabled: boolean;
  setMasterVolume: (volume: number) => void;
  setMuted: (isMuted: boolean) => void;
  setAmbientEnabled: (enabled: boolean) => void;
}

const formatTime = () => {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
};

type Logger = (text: string, type?: ForensicLog["type"], sender?: string) => void;

/**
 * Fire-and-forget a board write.
 *
 * In-memory state has already updated, so a failure is surfaced rather than
 * rolled back: silently discarding the user's work on a transient error would
 * be worse than a view that is briefly ahead of the server. Reconciliation
 * arrives with the realtime work.
 */
function syncWrite(op: Promise<void>, subject: string, log: Logger): void {
  op.catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    log(`SYNC FAILED // ${subject}: ${message}`, "warning", "ORACLE-LINK");
  });
}

/**
 * When each row was last written by THIS client.
 *
 * Realtime's postgres_changes echoes a client's own writes back to it, and
 * applying that echo clobbers newer local edits — type "abc" fast and the echo
 * of "a" lands on top of it, so the field reverts. There is no self-filter for
 * postgres_changes (unlike broadcast), so we suppress by recency: a remote row
 * that arrives within this window of our own write to it is treated as our echo
 * and ignored. The window refreshes on every keystroke, so it covers a
 * continuous edit and lapses shortly after typing stops, letting genuine remote
 * changes through.
 */
const ECHO_SUPPRESS_MS = 3000;
const localWriteTimes = new Map<string, number>();

/** Records a local write and fires it. Marks the id so its echo is ignored. */
function persistWrite(id: string, op: Promise<void>, subject: string, log: Logger): void {
  localWriteTimes.set(id, Date.now());
  syncWrite(op, subject, log);
}

function isOwnEcho(id: string): boolean {
  const t = localWriteTimes.get(id);
  return t !== undefined && Date.now() - t < ECHO_SUPPRESS_MS;
}

/**
 * Per-row debounce for text that changes on every keystroke.
 *
 * Notes and content edits bind straight to the store, so without this each
 * keystroke was a Supabase round-trip — the source of the board's typing lag.
 * Memory still updates instantly; only the durable write waits for a pause.
 */
const commitTimers = new Map<string, ReturnType<typeof setTimeout>>();
function debouncedCommit(id: string, fn: () => void, ms = 500): void {
  const existing = commitTimers.get(id);
  if (existing) clearTimeout(existing);
  commitTimers.set(
    id,
    setTimeout(() => {
      commitTimers.delete(id);
      fn();
    }, ms)
  );
}

/** Upserts by id, preserving order and appending anything new. */
function mergeById<T extends { id: string }>(list: T[], value: T): T[] {
  const i = list.findIndex((item) => item.id === value.id);
  if (i === -1) return [...list, value];
  const next = [...list];
  next[i] = value;
  return next;
}

/** Live channel teardown, held outside the store since it is not state. */
let unsubscribeBoard: (() => void) | null = null;

/**
 * Applies the other knights' changes to the in-memory board.
 *
 * These are remote-authored, so they are applied directly and never written
 * back — echoing them to the database would have every knight rewriting every
 * change, multiplying traffic by the number of people on the board.
 */
const realtimeHandlers: BoardRealtimeHandlers = {
  onCase: (id, value) =>
    useAppStore.setState((s) => {
      if (!value) {
        const cases = s.cases.filter((c) => c.id !== id);
        return {
          cases,
          // Mirror the schema's ON DELETE CASCADE locally.
          evidenceNodes: s.evidenceNodes.filter((n) => n.caseId !== id),
          evidenceConnections: s.evidenceConnections.filter((c) => c.caseId !== id),
          activeCaseId: s.activeCaseId === id ? cases[0]?.id ?? null : s.activeCaseId,
        };
      }
      if (isOwnEcho(id)) return {};
      return { cases: mergeById(s.cases, value) };
    }),

  onNode: (id, value) =>
    useAppStore.setState((s) => {
      if (!value) {
        return {
          evidenceNodes: s.evidenceNodes.filter((n) => n.id !== id),
          evidenceConnections: s.evidenceConnections.filter(
            (c) => c.fromNodeId !== id && c.toNodeId !== id
          ),
        };
      }
      // The echo of our own write, arriving after we have already moved on —
      // applying it would revert the edit we just made.
      if (isOwnEcho(id)) return {};
      // A node held under the local pointer keeps its local position: the
      // authoritative value is whatever this user is dragging it to, and
      // applying the remote one would snatch the card away mid-gesture.
      if (s.draggingNodeId === id) {
        const held = s.evidenceNodes.find((n) => n.id === id);
        if (held) return { evidenceNodes: mergeById(s.evidenceNodes, { ...value, x: held.x, y: held.y }) };
      }
      return { evidenceNodes: mergeById(s.evidenceNodes, value) };
    }),

  onConnection: (id, value) =>
    useAppStore.setState((s) => {
      if (value && isOwnEcho(id)) return {};
      return {
        evidenceConnections: value
          ? mergeById(s.evidenceConnections, value)
          : s.evidenceConnections.filter((c) => c.id !== id),
      };
    }),

  onDrag: (nodeId, x, y) =>
    useAppStore.setState((s) => {
      // Never let a remote frame move a node this user is holding.
      if (s.draggingNodeId === nodeId) return {};
      return {
        evidenceNodes: s.evidenceNodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
      };
    }),

  onPresence: (knights) => useAppStore.setState({ presentKnights: knights }),
};

// Ordering matters: board fields are no longer persisted, so the store's first
// write rewrites the persist blob without them. Any guest board predating the
// storage adapter has to be lifted out before that happens.
migrateLegacyGuestBoard();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentIdentity: null,
      sessionResolved: false,
      isChallengeOpen: false,
      openChallenge: () => set({ isChallengeOpen: true }),
      closeChallenge: () => set({ isChallengeOpen: false }),
      boardStorage: storageFor(null),
      boardStatus: "ready",
      boardError: null,
      presentKnights: [],
      draggingNodeId: null,

      setDraggingNode: (id) => set({ draggingNodeId: id }),

      broadcastDrag: (nodeId, x, y) => {
        get().boardStorage.broadcastDrag?.(nodeId, x, y);
      },

      setIdentity: async (id) => {
        const previous = get().boardStorage;
        if (previous.kind === "cloud" || get().currentIdentity !== id) previous.dispose?.();
        unsubscribeBoard?.();
        unsubscribeBoard = null;

        const boardStorage = storageFor(id);
        // Clear the board before loading: the outgoing identity's evidence must
        // never be visible, even briefly, to the incoming one.
        set({
          currentIdentity: id,
          boardStorage,
          boardStatus: "loading",
          boardError: null,
          presentKnights: [],
          draggingNodeId: null,
          cases: [],
          evidenceNodes: [],
          evidenceConnections: [],
        });
        await get().reloadBoard();

        // Subscribe only after the snapshot has landed, so an early event
        // cannot be overwritten by the load that follows it.
        // LocalBoardStorage has no subscribe at all — a guest has nobody to
        // sync with, so this is simply absent rather than disabled.
        unsubscribeBoard = boardStorage.subscribe?.(realtimeHandlers) ?? null;
      },

      reloadBoard: async () => {
        const storage = get().boardStorage;
        set({ boardStatus: "loading", boardError: null });
        try {
          const snapshot = await storage.load();
          // A stale load must not overwrite a newer identity's board.
          if (get().boardStorage !== storage) return;

          const activeCaseId = get().activeCaseId;
          const stillExists = snapshot.cases.some((c) => c.id === activeCaseId);
          set({
            ...snapshot,
            activeCaseId: stillExists ? activeCaseId : snapshot.cases[0]?.id ?? null,
            boardStatus: "ready",
          });
        } catch (err) {
          if (get().boardStorage !== storage) return;
          const message = err instanceof Error ? err.message : String(err);
          set({ boardStatus: "error", boardError: message });
          get().addLog(`BOARD LINK FAILURE // ${message}`, "warning", "ORACLE-LINK");
        }
      },

      currentModule: "dashboard",
      isScanning: false,
      scanProgress: 0,
      scannedEvidence: null,
      scanResults: [],
      notes: [],
      activeCaseId: null,
      cases: [],
      evidenceNodes: [],
      evidenceConnections: [],
      masterVolume: 0.4,
      isMuted: false,
      ambientEnabled: true,
      
      logs: [
        {
          id: "init-1",
          timestamp: formatTime(),
          type: "info",
          sender: "SYS-BOOT",
          text: "BATCOMPUTER DEPLOYED // COLD KERNEL INITIALIZED"
        },
        {
          id: "init-2",
          timestamp: formatTime(),
          type: "success",
          sender: "ORACLE-LINK",
          text: "SECURE FREQUENCY RECOVERY STABILIZED (AES-256 GCM)"
        }
      ],

      setModule: (module) => {
        set({ currentModule: module });
        playMaterialize();
      },

      pendingToolId: null,

      openToolInModule: (toolId) => {
        const home = moduleForTool(toolId);
        if (!home) return;
        set({ pendingToolId: toolId, currentModule: home.module });
        playMaterialize();
      },

      consumePendingTool: () => {
        const pending = get().pendingToolId;
        if (pending) set({ pendingToolId: null });
        return pending;
      },
      
      addLog: (text, type = "info", sender = "SYS") => {
        const newLog: ForensicLog = {
          id: Math.random().toString(36).substring(7),
          timestamp: formatTime(),
          type,
          sender,
          text,
        };
        set((state) => ({ logs: [...state.logs, newLog] }));
      },

      clearLogs: () => set({ logs: [] }),

      triggerForensicScan: (inputData) => {
        const { addLog } = get();
        set({ isScanning: true, scanProgress: 0, scannedEvidence: null, scanResults: [] });

        addLog(`INGESTING RAW EVIDENCE: "${inputData.name}"`, "info", "FORENSICS");
        addLog("ISOLATING BIT STREAM & COMPILING CIPHER FREQUENCIES", "info", "D-HEURISTICS");

        let progress = 0;
        let results: any[] = [];
        let isDone = false;
        
        const analyze = async () => {
          try {
            if (inputData.type === "ciphertext" || inputData.type === "hex") {
              results = identifyInput(inputData.rawContent).map(r => ({
                name: r.toolId.toUpperCase(),
                confidence: r.confidence * 100,
                isMatch: r.isMatch,
                details: r.preview || r.details
              }));
            } else if (inputData.type === "image" && inputData.file) {
              const imageIdentities = await identifyImage(inputData.file);
              const r = [...imageIdentities];
              
              try {
                const canvas = await loadImageAsCanvas(inputData.file);
                const stegoResults = await detectHiddenMessageInFile(inputData.file, canvas);
                if (stegoResults.length > 0) {
                  const top = stegoResults[0];
                  // Update or add LSB result
                  const lsbIdx = r.findIndex(item => item.name === "STEGANOGRAPHY LSB");
                  const lsbResult = {
                    name: "STEGANOGRAPHY LSB",
                    confidence: Math.round(top.confidence * 100),
                    isMatch: true,
                    details: `Hidden data detected [${top.type}]: ${top.decodedText.substring(0, 50)}...`
                  };
                  if (lsbIdx !== -1) r[lsbIdx] = lsbResult;
                  else r.push(lsbResult);
                } else {
                  r.push({ name: "STEGANOGRAPHY LSB", confidence: 15, isMatch: false, details: "NO LSB PAYLOAD DETECTED." });
                }
              } catch(e) {}
              results = r;
            } else if (inputData.type === "audio" && inputData.file) {
              const arrayBuffer = await inputData.file.arrayBuffer();
              const ctx = getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
              const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
              const channelData = audioBuffer.getChannelData(0);
              const sampleRate = audioBuffer.sampleRate;
              
              results = await identifyAudio(channelData, sampleRate);
            }
          } catch(e) {
            console.error(e);
          }
          isDone = true;
        };
        
        analyze();

        const interval = setInterval(() => {
          if (progress < 80) {
            progress += 20;
          } else if (isDone && progress < 100) {
            progress += 20;
          }
          set({ scanProgress: progress });

          if (progress === 20) {
            addLog("RUNNING ENTROPY & CHARACTER-SET ANALYSIS", "raw", "FORENSICS");
          } else if (progress === 40) {
            addLog("DISCOVERY: DETECTED RECURRENT GLYPH SEGMENTS", "warning", "D-HEURISTICS");
          } else if (progress === 60) {
            addLog("DECOMPOSING DATA INTO DYNAMIC HEURISTIC REGIONS", "info", "DECODER");
          } else if (progress === 80) {
            addLog("CORRELATION COMPLETE // FILTERING CANDIDATE MAPS", "success", "SYS");
          }
          
          if (progress >= 100 && isDone) {
            clearInterval(interval);
            
            const buildDiagnosticNotes = (): string => {
              if (results.length === 0) {
                return "FORENSIC CONCLUSION: No clear match identified. Analysis inconclusive.";
              }
              const top = results[0];
              const confidencePct = Math.round(top.confidence);
              const detail = top.details ? String(top.details).trim() : "";
              const verdict = top.isMatch
                ? `FORENSIC CONCLUSION: ${top.name} confirmed at ${confidencePct}% confidence.`
                : `FORENSIC CONCLUSION: ${top.name} is the closest candidate, but only at ${confidencePct}% confidence — treat as a lead, not a confirmed identification.`;
              return detail ? `${verdict} ${detail}` : verdict;
            };

            const matchedEvidence: EvidenceItem = {
              id: `EVD-${Math.floor(Math.random() * 10000)}`,
              name: inputData.name,
              type: inputData.type,
              confidence: results.length > 0 ? results[0].confidence : 0,
              source: "BAT-FORENSIC INTERCEPT",
              notes: buildDiagnosticNotes()
            };

            set({
              isScanning: false,
              scanProgress: 100,
              scannedEvidence: matchedEvidence,
              scanResults: results
            });

            if (results.length > 0) {
              addLog(`SCAN COMPLETE // HIGH-CONFIDENCE MATCH DETECTED (${results[0].name})`, "success", "SYS");
              playSuccessChime();
            } else {
              addLog("SCAN COMPLETE // NO DEFINITIVE MATCH FOUND", "warning", "SYS");
            }
          }
        }, 450);
      },

      selectCase: (caseId) => {
        const { addLog, cases } = get();
        const selected = cases.find(c => c.id === caseId);
        if (selected) {
          set({ activeCaseId: caseId });
          addLog(`SWITCHED ACTIVE CASE COGNIZANCE: ${selected.title}`, "info", "SYS");
        }
      },

      addCase: (caseData) => {
        const id = `case-${Math.random().toString(36).substring(7)}`;
        const newCase: Case = {
          ...caseData,
          id,
          notes: "",
          createdAt: new Date().toISOString(),
          createdBy: get().currentIdentity ?? undefined
        };
        set((state) => ({
          cases: [...state.cases, newCase],
          activeCaseId: id
        }));
        persistWrite(id, get().boardStorage.putCase(newCase), `CASE ${newCase.title}`, get().addLog);
        get().addLog(`NEW CASE CREATED AND ACTIVATED: ${newCase.title}`, "success", "SYS");
      },

      updateCaseNotes: (caseId, notes) => {
        set((state) => ({
          cases: state.cases.map((c) => (c.id === caseId ? { ...c, notes } : c))
        }));
        // Case notes are a per-keystroke textarea; debounce the durable write.
        debouncedCommit(caseId, () => {
          const updated = get().cases.find((c) => c.id === caseId);
          if (updated) persistWrite(caseId, get().boardStorage.putCase(updated), "CASE NOTES", get().addLog);
        });
      },

      updateCaseDetails: (caseId, updates) => {
        set((state) => ({
          cases: state.cases.map((c) => (c.id === caseId ? { ...c, ...updates } : c))
        }));
        const updated = get().cases.find((c) => c.id === caseId);
        if (updated) persistWrite(caseId, get().boardStorage.putCase(updated), "CASE DETAILS", get().addLog);
        get().addLog(`CASE DOSSIER AMENDED: ${updated?.title ?? caseId}`, "info", "SYS");
      },

      updateCaseStatus: (caseId, status) => {
        set((state) => ({
          cases: state.cases.map((c) => (c.id === caseId ? { ...c, status } : c))
        }));
        const updated = get().cases.find((c) => c.id === caseId);
        if (updated) persistWrite(caseId, get().boardStorage.putCase(updated), "CASE STATUS", get().addLog);
        get().addLog(`CASE STATUS UPDATED: ${status}`, "info", "SYS");
      },

      deleteCase: (caseId) => {
        set((state) => {
          const nextCases = state.cases.filter((c) => c.id !== caseId);
          const activeId = state.activeCaseId === caseId
            ? (nextCases[0]?.id || null)
            : state.activeCaseId;
          return {
            cases: nextCases,
            activeCaseId: activeId,
            evidenceNodes: state.evidenceNodes.filter((n) => n.caseId !== caseId),
            evidenceConnections: state.evidenceConnections.filter((c) => c.caseId !== caseId)
          };
        });
        // Nodes and connections cascade server-side (and in the local adapter),
        // so only the case itself is deleted here.
        syncWrite(get().boardStorage.removeCase(caseId), "CASE DELETE", get().addLog);
        get().addLog(`CASE DELETED`, "warning", "SYS");
      },

      addEvidenceNode: (node) => {
        const activeCaseId = get().activeCaseId;
        if (!activeCaseId) return;
        const id = `node-${Math.random().toString(36).substring(7)}`;
        const newNode: EvidenceNode = {
          ...node,
          id,
          caseId: activeCaseId,
          notes: "",
          createdAt: new Date().toISOString(),
          createdBy: get().currentIdentity ?? undefined
        };
        set((state) => ({
          evidenceNodes: [...state.evidenceNodes, newNode]
        }));
        persistWrite(id, get().boardStorage.putNode(newNode), `NODE ${node.title || "UNNAMED"}`, get().addLog);
        get().addLog(`ADDED EVIDENCE NODE: ${node.title || "UNNAMED"}`, "success", "BOARD");
      },

      uploadEvidenceImage: (file) => get().boardStorage.uploadAsset(file),
      resolveAssetUrl: (ref) => get().boardStorage.resolveAssetUrl(ref),

      // Called on every pointermove of a drag, so it is memory-only. The board
      // calls commitEvidenceNode on pointerup to persist the final position.
      // Writing here would mean a storage round-trip per frame.
      updateEvidenceNodePosition: (id, x, y) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.map((n) => (n.id === id ? { ...n, x, y } : n))
        }));
      },

      // Same contract as updateEvidenceNodePosition: per-frame, memory-only,
      // committed on pointerup.
      resizeEvidenceNode: (id, width, height) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.map((n) => (n.id === id ? { ...n, width, height } : n))
        }));
      },

      // Immediate persistence — used on drag/resize release, where the write
      // must land promptly and there is no keystroke cadence to debounce.
      commitEvidenceNode: (id) => {
        const node = get().evidenceNodes.find((n) => n.id === id);
        if (node) persistWrite(id, get().boardStorage.putNode(node), "NODE LAYOUT", get().addLog);
      },

      updateEvidenceNodeContent: (id, updates) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.map((n) => (n.id === id ? { ...n, ...updates } : n))
        }));
        // Debounced: title rename, size inputs and text edits all flow through
        // here, and a size field held on repeat-key would otherwise write madly.
        debouncedCommit(id, () => get().commitEvidenceNode(id));
      },

      updateEvidenceNodeNotes: (id, notes) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.map((n) => (n.id === id ? { ...n, notes } : n))
        }));
        // Analyst-notes textarea fires per keystroke — debounce the write.
        debouncedCommit(id, () => get().commitEvidenceNode(id));
      },

      deleteEvidenceNode: (id) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.filter((n) => n.id !== id),
          evidenceConnections: state.evidenceConnections.filter((c) => c.fromNodeId !== id && c.toNodeId !== id)
        }));
        // Attached connections cascade with the node.
        syncWrite(get().boardStorage.removeNode(id), "NODE DELETE", get().addLog);
        get().addLog(`DELETED EVIDENCE NODE`, "warning", "BOARD");
      },

      addEvidenceConnection: (fromId, toId, label) => {
        const activeCaseId = get().activeCaseId;
        if (!activeCaseId) return;
        const id = `conn-${Math.random().toString(36).substring(7)}`;
        const newConnection: EvidenceConnection = {
          id,
          caseId: activeCaseId,
          fromNodeId: fromId,
          toNodeId: toId,
          label,
          createdBy: get().currentIdentity ?? undefined
        };
        set((state) => ({
          evidenceConnections: [...state.evidenceConnections, newConnection]
        }));
        persistWrite(id, get().boardStorage.putConnection(newConnection), "CORRELATION", get().addLog);
        get().addLog(`ESTABLISHED CORRELATION BETWEEN EVIDENCE NODES`, "success", "BOARD");
      },

      deleteEvidenceConnection: (id) => {
        set((state) => ({
          evidenceConnections: state.evidenceConnections.filter((c) => c.id !== id)
        }));
        syncWrite(get().boardStorage.removeConnection(id), "CORRELATION DELETE", get().addLog);
        get().addLog(`REMOVED CORRELATION LINE`, "warning", "BOARD");
      },

      updateEvidenceConnectionLabel: (id, label) => {
        set((state) => ({
          evidenceConnections: state.evidenceConnections.map((c) => (c.id === id ? { ...c, label } : c))
        }));
        debouncedCommit(id, () => {
          const updated = get().evidenceConnections.find((c) => c.id === id);
          if (updated) {
            persistWrite(id, get().boardStorage.putConnection(updated), "CORRELATION LABEL", get().addLog);
          }
        });
      },

      addNote: (text = "") => {
        const id = `note-${Math.random().toString(36).substring(7)}`;
        const now = new Date().toISOString();
        const newNote: NoteEntry = { id, text, createdAt: now, updatedAt: now };
        set((state) => ({ notes: [newNote, ...state.notes] }));
        return id;
      },

      updateNote: (id, text) => {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, text, updatedAt: new Date().toISOString() } : n))
        }));
      },

      deleteNote: (id) => {
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
      },

      sendNoteToBoard: (id) => {
        const { notes, activeCaseId, addEvidenceNode, addLog } = get();
        const note = notes.find((n) => n.id === id);
        if (!note) return false;
        if (!activeCaseId) {
          addLog("CANNOT PIN NOTE: NO ACTIVE CASE SELECTED", "warning", "BOARD");
          return false;
        }
        addEvidenceNode({
          type: "text",
          content: note.text,
          title: "FIELD NOTE",
          x: 120 + Math.random() * 200,
          y: 120 + Math.random() * 200
        });
        // The board is almost always off-screen when pinning from the notes
        // panel, so without a cue here the action is completely silent and
        // invisible — and gets repeated until the user assumes it is broken.
        playPinClick();
        return true;
      },

      setMasterVolume: (volume) => {
        set({ masterVolume: volume });
        setSoundVolume(volume);
      },
      setMuted: (isMuted) => {
        set({ isMuted });
        setSoundMuted(isMuted);
      },
      setAmbientEnabled: (enabled) => {
        set({ ambientEnabled: enabled });
        setAmbientEnabled(enabled);
      }
    }),
    {
      name: "belfry-app-store",
      /**
       * Board data (cases, nodes, connections) is deliberately absent: it is
       * owned by boardStorage, which for a knight is Supabase. Persisting it
       * here too would leave a copy of the shared board in localStorage after
       * sign-out, and would let a stale local copy race the cloud on load.
       *
       * What remains is per-device: scratch notes, audio settings, and which
       * case this browser last had open. Keeping this set small also matters
       * for drag performance — persist runs on every set().
       */
      partialize: (state) => ({
        activeCaseId: state.activeCaseId,
        notes: state.notes,
        masterVolume: state.masterVolume,
        isMuted: state.isMuted,
        ambientEnabled: state.ambientEnabled
      })
    }
  )
);

// Synchronize sound engine with initial/persisted state
useAppStore.subscribe((state) => {
  setSoundVolume(state.masterVolume);
  setSoundMuted(state.isMuted);
  setAmbientEnabled(state.ambientEnabled);
});

// One-time initial sync for the very first load
const initialState = useAppStore.getState();
setSoundVolume(initialState.masterVolume);
setSoundMuted(initialState.isMuted);
setAmbientEnabled(initialState.ambientEnabled);

/**
 * Bind a board on boot.
 *
 * Identity comes from the auth session, so a returning knight lands on the
 * shared board and everyone else lands on their own local one. Runs after
 * persist has rehydrated (localStorage rehydration is synchronous, so it has
 * completed by the time this module body executes).
 */
void useAppStore.getState().setIdentity(null);

void resolveSessionIdentity()
  .then((identity) => {
    // Only re-bind if a knight session exists; the guest board is already bound
    // above, and rebinding it would discard an in-progress load for no reason.
    if (identity) return useAppStore.getState().setIdentity(identity);
  })
  .catch(() => {
    // A failed session probe means guest, which is already bound. The user is
    // not blocked; the credential challenge remains available.
  })
  .finally(() => {
    useAppStore.setState({ sessionResolved: true });
  });

// An expired refresh token or a deleted account must drop the session to guest
// rather than leave a shared board on screen that can no longer be written to.
onSessionLost(() => {
  if (useAppStore.getState().currentIdentity !== null) {
    void useAppStore.getState().setIdentity(null);
  }
});
