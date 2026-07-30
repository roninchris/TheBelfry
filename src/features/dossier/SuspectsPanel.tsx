import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  useAppStore,
  type Suspect,
  type SuspectStatus,
  SUSPECT_STATUSES,
} from "../../store/appStore";
import { compressBoardImage } from "../../lib/image/compressBoardImage";
import GlassPanel from "../../components/ui/GlassPanel";
import EvidenceImage from "../../components/ui/EvidenceImage";
import {
  UserPlus,
  User,
  X,
  Pencil,
  Trash2,
  Send,
  Loader2,
  Image as ImageIcon,
  Users,
  GripVertical,
} from "lucide-react";
import { suppressDragImage } from "../../lib/dnd";
import {
  playPinClick,
  playHoverEvidence,
  playUnpinTear,
  playOpenFile,
  playCloseFile,
} from "../../lib/soundEngine";

/** Display label + alert tone per suspect status. Generic, no proper nouns. */
export const STATUS_META: Record<
  SuspectStatus,
  { label: string; text: string; border: string; dot: string; chip: string }
> = {
  FUGITIVE: {
    label: "FUGITIVE",
    text: "text-red-threat",
    border: "border-red-threat/60",
    dot: "bg-red-threat",
    chip: "border-red-threat/60 text-red-threat bg-red-threat/15",
  },
  IN_CUSTODY: {
    label: "IN CUSTODY",
    text: "text-green-verified",
    border: "border-green-verified/50",
    dot: "bg-green-verified",
    chip: "border-green-verified/60 text-green-verified bg-green-verified/15",
  },
  DECEASED: {
    label: "DECEASED",
    text: "text-text-dim",
    border: "border-border-hairline/40",
    dot: "bg-text-dim",
    chip: "border-border-hairline/50 text-text-dim bg-text-dim/10",
  },
  UNKNOWN: {
    label: "UNKNOWN",
    text: "text-amber-alert",
    border: "border-amber-alert/50",
    dot: "bg-amber-alert",
    chip: "border-amber-alert/60 text-amber-alert bg-amber-alert/15",
  },
};

/**
 * The "Most Wanted" tech-scan portrait. The image keeps its COLOUR under a
 * subtle theme-accent wash (cyan by default, retinting with the theme via
 * `--rgb-accent`) and prominent CRT scanlines. A DECEASED subject is dimmed and
 * desaturated. The treatment is pure CSS so it stays theme-aware; sending to the
 * board bakes an equivalent look into the pixels (see bakeSuspectPortrait).
 */
export function SuspectPortrait({
  suspect,
  className = "",
}: {
  suspect: Suspect;
  className?: string;
}) {
  const dim = suspect.status === "DECEASED";
  return (
    <div className={`relative overflow-hidden bg-bg-void ${className}`}>
      {suspect.imageRef ? (
        <EvidenceImage
          refValue={suspect.imageRef}
          alt={suspect.name}
          className={`absolute inset-0 w-full h-full object-cover suspect-portrait-img ${dim ? "opacity-45 grayscale" : ""}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-panel/40">
          <User className="w-1/3 h-1/3 text-border-hairline/40" />
        </div>
      )}
      {/* Theme-accent wash — keeps colour, cools it. Retints per theme. */}
      {suspect.imageRef && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "rgb(var(--rgb-accent) / 0.34)", mixBlendMode: "soft-light" }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "rgb(var(--rgb-accent) / 0.16)", mixBlendMode: "color" }}
          />
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-void via-bg-void/10 to-transparent pointer-events-none" />
      {/* Prominent scanlines */}
      <div className="absolute inset-0 pointer-events-none suspect-scanlines" />
    </div>
  );
}

/** The active theme's accent as [r,g,b], read from the `--rgb-accent` token. */
function themeAccentRGB(): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--rgb-accent").trim();
  const parts = raw.split(/[\s,/]+/).map((n) => parseInt(n, 10));
  if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
    return [parts[0], parts[1], parts[2]];
  }
  return [9, 239, 175]; // cyan fallback
}

/**
 * Re-encodes the portrait with the same tech-scan look the cards show, baked
 * into the pixels so the board (which applies no CSS filter) matches: colour
 * kept, a soft theme-accent wash, and prominent scanlines. Bakes the CURRENT
 * theme's accent. Returns null if the source taints the canvas (cross-origin
 * without CORS) so the caller can fall back to the untreated image.
 */
async function bakeSuspectPortrait(url: string, name: string): Promise<File | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => res(el);
      el.onerror = rej;
      el.src = url;
    });
    const w = Math.min(img.naturalWidth || 600, 800);
    const h = Math.round((w * (img.naturalHeight || 800)) / (img.naturalWidth || 600));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Taint probe first, so a cross-origin image fails fast to the fallback.
    ctx.drawImage(img, 0, 0, w, h);
    ctx.getImageData(0, 0, 1, 1); // throws on a tainted canvas
    // Re-draw, gently graded, keeping colour.
    ctx.clearRect(0, 0, w, h);
    ctx.filter = "saturate(0.92) contrast(1.06) brightness(1.02)";
    ctx.drawImage(img, 0, 0, w, h);
    ctx.filter = "none";
    // Theme-accent cool wash (mirrors the CSS soft-light + colour overlays).
    const [ar, ag, ab] = themeAccentRGB();
    ctx.fillStyle = `rgb(${ar}, ${ag}, ${ab})`;
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.52;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = 0.16;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    // Prominent scanlines: a 34%-black line every 3px.
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) return null;
    return new File([blob], `${name || "suspect"}.jpg`, { type: "image/jpeg" });
  } catch {
    return null;
  }
}

const EMPTY_FORM = { name: "", info: "", bio: "", status: "UNKNOWN" as SuspectStatus, caseIds: [] as string[], imageRef: "" };

export default function SuspectsPanel() {
  const suspects = useAppStore((s) => s.suspects);
  const cases = useAppStore((s) => s.cases);
  const addSuspect = useAppStore((s) => s.addSuspect);
  const updateSuspect = useAppStore((s) => s.updateSuspect);
  const deleteSuspect = useAppStore((s) => s.deleteSuspect);
  const uploadEvidenceImage = useAppStore((s) => s.uploadEvidenceImage);
  const resolveAssetUrl = useAppStore((s) => s.resolveAssetUrl);
  const addEvidenceNode = useAppStore((s) => s.addEvidenceNode);
  const selectCase = useAppStore((s) => s.selectCase);
  const activeCaseId = useAppStore((s) => s.activeCaseId);
  const setModule = useAppStore((s) => s.setModule);
  const addLog = useAppStore((s) => s.addLog);

  const reorderSuspects = useAppStore((s) => s.reorderSuspects);

  const [statusFilter, setStatusFilter] = useState<"ALL" | SuspectStatus>("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isUploading, setIsUploading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Drag state: the card being dragged and the card it is hovering over. The
  // reorder only commits on drop (not live), so the drag stays smooth.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const detail = suspects.find((s) => s.id === detailId) || null;
  const caseTitle = (id?: string) => cases.find((c) => c.id === id)?.title;

  // Roster in the shared manual order (Suspect.position), then created time,
  // then the status filter.
  const ordered = useMemo(
    () =>
      [...suspects].sort(
        (a, b) =>
          (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [suspects]
  );

  const filtered = useMemo(
    () => (statusFilter === "ALL" ? ordered : ordered.filter((s) => s.status === statusFilter)),
    [ordered, statusFilter]
  );

  // Commit the reorder on drop: move dragId to dropId's slot, persist positions.
  const commitReorder = () => {
    if (dragId && dropId && dragId !== dropId) {
      const ids = ordered.map((s) => s.id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(dropId);
      if (from !== -1 && to !== -1 && from !== to) {
        ids.splice(from, 1);
        ids.splice(to, 0, dragId);
        reorderSuspects(ids);
      }
    }
    setDragId(null);
    setDropId(null);
  };

  const onCardDragOver = (e: React.DragEvent, id: string) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    if (dropId !== id) setDropId(id);
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = { ALL: suspects.length };
    SUSPECT_STATUSES.forEach((st) => (m[st] = suspects.filter((s) => s.status === st).length));
    return m;
  }, [suspects]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    playOpenFile();
  };
  const openEdit = (s: Suspect) => {
    setEditingId(s.id);
    setForm({ name: s.name, info: s.info, bio: s.bio, status: s.status, caseIds: s.caseIds ?? [], imageRef: s.imageRef || "" });
    setShowForm(true);
    playPinClick();
  };

  /** Toggle a case id in a caseIds array. */
  const toggleCaseId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setIsUploading(true);
    try {
      const prepared = await compressBoardImage(file);
      const ref = await uploadEvidenceImage(prepared);
      setForm((f) => ({ ...f, imageRef: ref }));
    } catch {
      addLog("SUSPECT PORTRAIT UPLOAD FAILED", "warning", "DOSSIER");
    } finally {
      setIsUploading(false);
    }
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      info: form.info.trim(),
      bio: form.bio.trim(),
      status: form.status,
      caseIds: form.caseIds,
      imageRef: form.imageRef || undefined,
    };
    if (editingId) updateSuspect(editingId, payload);
    else setDetailId(addSuspect(payload));
    setShowForm(false);
    setEditingId(null);
    playPinClick();
  };

  const sendToBoard = async (s: Suspect) => {
    // Target the active case if the suspect is attached to it, else the suspect's
    // first attached case, else whatever case is currently active.
    const attached = s.caseIds ?? [];
    const target =
      (activeCaseId && attached.includes(activeCaseId) && activeCaseId) ||
      attached[0] ||
      activeCaseId;
    if (!target) {
      addLog("ATTACH THE SUSPECT TO A CASE BEFORE SENDING TO THE BOARD", "warning", "DOSSIER");
      return;
    }
    setSendingId(s.id);
    try {
      if (target !== activeCaseId) selectCase(target);
      let ref = s.imageRef || "";
      // Bake the duotone into the pixels so the board shows the treated portrait;
      // fall back to the untreated image if the source can't be read to canvas.
      if (s.imageRef) {
        try {
          const url = await resolveAssetUrl(s.imageRef);
          const baked = await bakeSuspectPortrait(url, s.name);
          if (baked) ref = await uploadEvidenceImage(baked);
        } catch {
          /* keep untreated ref */
        }
      }
      const jitter = () => 160 + Math.round(Math.random() * 220);
      addEvidenceNode({
        type: "photo",
        title: (s.name || "SUSPECT").toUpperCase(),
        content: ref,
        color: "red",
        x: jitter(),
        y: jitter(),
      });
      addLog(`SUSPECT PINNED TO EVIDENCE BOARD: ${s.name}`, "success", "DOSSIER");
      setModule("detective-board");
    } catch {
      addLog("SEND TO BOARD FAILED", "warning", "DOSSIER");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* Filter + add bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["ALL", ...SUSPECT_STATUSES] as const).map((st) => {
            const active = statusFilter === st;
            const meta = st === "ALL" ? null : STATUS_META[st];
            return (
              <button
                key={st}
                onClick={() => { setStatusFilter(st); playPinClick(); }}
                onMouseEnter={() => playHoverEvidence()}
                className={`px-2.5 py-1 border text-[12px] font-display font-black tracking-widest uppercase transition-all flex items-center gap-1.5 ${
                  active
                    ? meta
                      ? meta.chip
                      : "border-cyan-primary/60 text-cyan-text bg-cyan-primary/10"
                    : "border-border-hairline/25 text-text-dim hover:text-text-primary"
                }`}
              >
                {meta && <span className={`w-1.5 h-1.5 ${meta.dot}`} />}
                {st === "ALL" ? "ALL" : meta!.label}
                <span className="opacity-60">{counts[st] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={openCreate}
          onMouseEnter={() => playHoverEvidence()}
          className="hud-target px-3 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest flex items-center"
          style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
          NEW SUSPECT
        </button>
      </div>

      {/* Grid of dossier cards */}
      {suspects.length === 0 ? (
        <GlassPanel className="flex-1 flex flex-col items-center justify-center text-center p-6" clipSize="md">
          <Users className="w-14 h-14 text-cyan-dim opacity-40 animate-hex-pulse-flicker mb-3" />
          <h3 className="font-display text-sm font-black text-cyan-text tracking-widest uppercase">NO SUSPECTS ON FILE</h3>
          <p className="text-[13px] font-share text-text-dim max-w-sm mt-1 leading-normal uppercase">
            File a person of interest to build the most-wanted board and attach them to your cases.
          </p>
        </GlassPanel>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((s) => {
              const meta = STATUS_META[s.status];
              return (
                <motion.button
                  layout
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => { if (!dragId) { setDetailId(s.id); playOpenFile(); } }}
                  onMouseEnter={() => playHoverEvidence()}
                  draggable
                  title="Drag to reorder"
                  onDragStartCapture={(e: React.DragEvent) => { suppressDragImage(e); setDragId(s.id); setDropId(null); }}
                  onDragOver={(e: React.DragEvent) => onCardDragOver(e, s.id)}
                  onDragEndCapture={commitReorder}
                  className={`hud-target group relative text-left border bg-bg-void/50 overflow-hidden hover:shadow-[0_0_14px_-2px_rgb(var(--rgb-accent)/0.3)] cursor-grab active:cursor-grabbing transition-all ${
                    dropId === s.id ? "ring-2 ring-cyan-primary scale-[1.04] z-20 shadow-[0_0_22px_-2px_rgb(var(--rgb-accent)/0.6)]" : meta.border
                  } ${dragId === s.id ? "opacity-35" : ""}`}
                  style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)" }}
                >
                  <SuspectPortrait suspect={s} className="w-full aspect-[3/4]" />
                  {/* Drag affordance — a grip that appears on hover. */}
                  <span className="absolute top-1.5 right-1.5 z-10 p-0.5 rounded bg-bg-void/70 text-cyan-primary/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>
                  {/* Status flag */}
                  <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase border bg-bg-void/80 ${meta.chip}`}>
                    {meta.label}
                  </span>
                  {/* Name plate */}
                  <div className="absolute bottom-0 inset-x-0 px-2 pb-2 pt-5">
                    <span className="block font-display text-[13px] font-black tracking-wider uppercase text-cyan-text truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                      {s.name}
                    </span>
                    {s.caseIds && s.caseIds.length > 0 && (
                      <span className="block font-mono text-[10px] text-text-dim/80 truncate uppercase">
                        {caseTitle(s.caseIds[0]) || "1 CASE"}
                        {s.caseIds.length > 1 ? ` +${s.caseIds.length - 1}` : ""}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleImagePick} />

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bg-void/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-3xl max-h-[90vh]"
            >
              <GlassPanel className="flex flex-col md:flex-row overflow-hidden bg-bg-panel/95 max-h-[90vh]" clipSize="md">
                {/* Portrait */}
                <div className="md:w-2/5 shrink-0 relative">
                  <SuspectPortrait suspect={detail} className="w-full h-52 md:h-full min-h-[240px]" />
                  <span className={`absolute top-2 left-2 px-2 py-0.5 text-[11px] font-mono font-bold tracking-wider uppercase border bg-bg-void/85 ${STATUS_META[detail.status].chip}`}>
                    {STATUS_META[detail.status].label}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col p-5 overflow-y-auto scrollbar-thin">
                  <div className="flex items-start justify-between gap-2 border-b border-border-hairline/20 pb-3 mb-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-black text-cyan-text tracking-widest uppercase truncate">{detail.name}</h2>
                      {detail.info && <p className="font-share text-[13px] text-text-dim italic mt-0.5">{detail.info}</p>}
                    </div>
                    <button onClick={() => { setDetailId(null); playCloseFile(); }} className="p-1 text-text-dim hover:text-red-threat shrink-0">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <label className="text-[12px] font-display font-bold text-cyan-dim uppercase tracking-widest mb-1">Bio / Intel</label>
                  <p className="font-share text-sm text-text-primary leading-relaxed whitespace-pre-wrap flex-1">
                    {detail.bio || <span className="text-text-dim/50 italic">No intelligence recorded.</span>}
                  </p>

                  {/* Case attachment — a suspect can belong to several cases. */}
                  <div className="mt-4 pt-3 border-t border-border-hairline/20">
                    <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1.5">
                      Attached Cases {(detail.caseIds?.length ?? 0) > 0 && <span className="text-cyan-text">({detail.caseIds!.length})</span>}
                    </label>
                    {cases.length === 0 ? (
                      <p className="text-[12px] text-text-dim/60 italic">No cases to attach yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {cases.map((c) => {
                          const on = detail.caseIds?.includes(c.id) ?? false;
                          return (
                            <button
                              key={c.id}
                              onClick={() => updateSuspect(detail.id, { caseIds: toggleCaseId(detail.caseIds ?? [], c.id) })}
                              className={`px-2 py-1 border text-[11px] font-mono font-bold tracking-wider uppercase transition-all ${
                                on
                                  ? "border-cyan-primary/60 text-cyan-text bg-cyan-primary/15"
                                  : "border-border-hairline/25 text-text-dim hover:text-text-primary"
                              }`}
                            >
                              {on ? "✓ " : ""}{c.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => sendToBoard(detail)}
                      disabled={sendingId === detail.id}
                      onMouseEnter={() => playHoverEvidence()}
                      className="hud-target flex items-center gap-1.5 px-3 py-2 bg-cyan-primary text-bg-void font-display text-[12px] font-black tracking-widest uppercase hover:bg-white transition-all disabled:opacity-60"
                    >
                      {sendingId === detail.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      SEND TO BOARD
                    </button>
                    <button
                      onClick={() => openEdit(detail)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary/10 transition-all text-[12px] font-black tracking-widest uppercase"
                    >
                      <Pencil className="w-3.5 h-3.5" /> EDIT
                    </button>
                    <button
                      onClick={() => setDeleteId(detail.id)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-red-threat/40 text-red-threat hover:bg-red-threat/10 transition-all text-[12px] font-black tracking-widest uppercase"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> DELETE
                    </button>
                  </div>
                </div>
              </GlassPanel>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-bg-void/85 backdrop-blur-sm">
          <GlassPanel className="p-4 max-w-md w-full max-h-[92vh] overflow-y-auto scrollbar-thin" clipSize="md" showCornerTicks={true}>
            <div className="flex justify-between items-center border-b border-border-hairline/25 pb-2 mb-3">
              <h3 className="font-display text-[14px] font-black tracking-widest text-cyan-text uppercase">
                {editingId ? "AMEND SUSPECT DOSSIER" : "FILE NEW SUSPECT"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-text-dim hover:text-text-primary"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={submitForm} className="space-y-3 text-xs">
              {/* Portrait picker */}
              <div className="flex items-center gap-3">
                <div className="w-20 h-24 shrink-0 border border-border-hairline/30 overflow-hidden bg-bg-void relative">
                  {form.imageRef ? (
                    <SuspectPortrait suspect={{ ...(EMPTY_FORM as any), ...form } as Suspect} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><User className="w-7 h-7 text-border-hairline/40" /></div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-bg-void/70 flex items-center justify-center"><Loader2 className="w-5 h-5 text-cyan-primary animate-spin" /></div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary/10 transition-all text-[12px] font-black tracking-widest uppercase"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> {form.imageRef ? "REPLACE" : "UPLOAD"} PORTRAIT
                </button>
              </div>

              <div>
                <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">Name / Alias</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="E.g. THE RIDDLER" autoFocus
                  className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary" />
              </div>

              <div>
                <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">Information (alias, role)</label>
                <input value={form.info} onChange={(e) => setForm((f) => ({ ...f, info: e.target.value }))}
                  placeholder="E.g. Real name unknown · Extortionist"
                  className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary" />
              </div>

              <div>
                <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">Bio / Intel</label>
                <textarea rows={4} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Known history, methods, last sighting…"
                  className="w-full bg-bg-void/80 border border-border-hairline/30 p-2 text-text-primary rounded-sm font-sans focus:outline-none focus:border-cyan-primary resize-none" />
              </div>

              <div>
                <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">Status</label>
                <div className="grid grid-cols-4 gap-1">
                  {SUSPECT_STATUSES.map((st) => {
                    const active = form.status === st;
                    const meta = STATUS_META[st];
                    return (
                      <button key={st} type="button" onClick={() => setForm((f) => ({ ...f, status: st }))}
                        className={`py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider border transition-all ${active ? meta.chip : "border-border-hairline/25 text-text-dim hover:text-text-primary"}`}>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-mono text-text-dim/75 tracking-wider uppercase mb-1">Attach to Cases (optional)</label>
                {cases.length === 0 ? (
                  <p className="text-[12px] text-text-dim/50 italic">No cases yet — create one first to attach.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cases.map((c) => {
                      const on = form.caseIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, caseIds: toggleCaseId(f.caseIds, c.id) }))}
                          className={`px-2 py-1 border text-[11px] font-mono font-bold tracking-wider uppercase transition-all ${
                            on
                              ? "border-cyan-primary/60 text-cyan-text bg-cyan-primary/15"
                              : "border-border-hairline/25 text-text-dim hover:text-text-primary"
                          }`}
                        >
                          {on ? "✓ " : ""}{c.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-[13px] uppercase font-bold text-text-dim hover:text-text-primary transition-colors">CANCEL</button>
                <button type="submit" className="hud-target px-4 py-1.5 border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest" style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}>
                  {editingId ? "SAVE DOSSIER" : "FILE SUSPECT"}
                </button>
              </div>
            </form>
          </GlassPanel>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-bg-void/85 backdrop-blur-sm">
          <GlassPanel className="p-4 max-w-sm w-full border-red-threat/50" clipSize="md" showCornerTicks={true}>
            <h3 className="font-display text-xs font-black tracking-widest text-red-threat uppercase mb-3">PURGE SUSPECT DOSSIER?</h3>
            <p className="text-xs text-text-dim leading-relaxed mb-4 font-share uppercase">This removes the suspect record from your roster. Portraits already sent to a board are not affected.</p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 text-[13px] uppercase font-bold text-text-dim hover:text-text-primary">CANCEL</button>
              <button
                onClick={() => { deleteSuspect(deleteId); playUnpinTear(); if (detailId === deleteId) setDetailId(null); setDeleteId(null); }}
                className="hud-target px-4 py-1.5 border border-red-threat/50 text-red-threat hover:bg-red-threat hover:text-bg-void transition-colors text-[13px] font-black uppercase tracking-widest"
                style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}
              >
                DELETE
              </button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
