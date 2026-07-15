import { create } from "zustand";
import { persist } from "zustand/middleware";
import { playSuccessChime, playMaterialize, setSoundVolume, setSoundMuted, setAmbientEnabled } from "../lib/soundEngine";
import { identifyInput } from "../lib/tools/identify";
import { identifyImage, identifyAudio } from "../lib/tools/identify/forensics";
import { detectHiddenMessageInFile, loadImageAsCanvas } from "../lib/tools/image-stego";
import { detectMorse, detectDTMF } from "../lib/audioAnalysis";
import { getAudioContext } from "../lib/soundEngine";

export interface ForensicLog {
  id: string;
  timestamp: string;
  type: "info" | "warning" | "success" | "raw";
  sender: string;
  text: string;
}

export interface Case {
  id: string;
  title: string;
  synopsis: string;          // short description of the ARG
  status: "ACTIVE" | "SOLVED" | "ARCHIVED" | "STALLED";
  createdAt: string;
  colorTag?: string;         // optional accent color per case
  notes: string;             // freeform markdown/journal notes for the case
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
}

export interface EvidenceConnection {
  id: string;
  caseId: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
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

interface AppState {
  currentModule: string;
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
  deleteCase: (caseId: string) => void;
  
  // Evidence Board actions
  addEvidenceNode: (node: Omit<EvidenceNode, "id" | "createdAt" | "caseId" | "notes">) => void;
  updateEvidenceNodePosition: (id: string, x: number, y: number) => void;
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
  sendNoteToBoard: (id: string) => void;

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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
          createdAt: new Date().toISOString()
        };
        set((state) => ({
          cases: [...state.cases, newCase],
          activeCaseId: id
        }));
        get().addLog(`NEW CASE CREATED AND ACTIVATED: ${newCase.title}`, "success", "SYS");
      },

      updateCaseNotes: (caseId, notes) => {
        set((state) => ({
          cases: state.cases.map((c) => (c.id === caseId ? { ...c, notes } : c))
        }));
      },

      updateCaseStatus: (caseId, status) => {
        set((state) => ({
          cases: state.cases.map((c) => (c.id === caseId ? { ...c, status } : c))
        }));
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
          createdAt: new Date().toISOString()
        };
        set((state) => ({
          evidenceNodes: [...state.evidenceNodes, newNode]
        }));
        get().addLog(`ADDED EVIDENCE NODE: ${node.title || "UNNAMED"}`, "success", "BOARD");
      },

      updateEvidenceNodePosition: (id, x, y) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.map((n) => (n.id === id ? { ...n, x, y } : n))
        }));
      },

      updateEvidenceNodeContent: (id, updates) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.map((n) => (n.id === id ? { ...n, ...updates } : n))
        }));
      },

      updateEvidenceNodeNotes: (id, notes) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.map((n) => (n.id === id ? { ...n, notes } : n))
        }));
      },

      deleteEvidenceNode: (id) => {
        set((state) => ({
          evidenceNodes: state.evidenceNodes.filter((n) => n.id !== id),
          evidenceConnections: state.evidenceConnections.filter((c) => c.fromNodeId !== id && c.toNodeId !== id)
        }));
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
          label
        };
        set((state) => ({
          evidenceConnections: [...state.evidenceConnections, newConnection]
        }));
        get().addLog(`ESTABLISHED CORRELATION BETWEEN EVIDENCE NODES`, "success", "BOARD");
      },

      deleteEvidenceConnection: (id) => {
        set((state) => ({
          evidenceConnections: state.evidenceConnections.filter((c) => c.id !== id)
        }));
        get().addLog(`REMOVED CORRELATION LINE`, "warning", "BOARD");
      },

      updateEvidenceConnectionLabel: (id, label) => {
        set((state) => ({
          evidenceConnections: state.evidenceConnections.map((c) => (c.id === id ? { ...c, label } : c))
        }));
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
        if (!note) return;
        if (!activeCaseId) {
          addLog("CANNOT PIN NOTE: NO ACTIVE CASE SELECTED", "warning", "BOARD");
          return;
        }
        addEvidenceNode({
          type: "text",
          content: note.text,
          title: "FIELD NOTE",
          x: 120 + Math.random() * 200,
          y: 120 + Math.random() * 200
        });
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
      partialize: (state) => ({
        cases: state.cases,
        activeCaseId: state.activeCaseId,
        evidenceNodes: state.evidenceNodes,
        evidenceConnections: state.evidenceConnections,
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
