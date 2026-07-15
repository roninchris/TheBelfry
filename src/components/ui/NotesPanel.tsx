import React, { useState } from "react";
import { NotebookPen, X, Send, Trash2, Plus } from "lucide-react";
import GlassPanel from "./GlassPanel";
import DatabaseTag from "./DatabaseTag";
import { useAppStore } from "../../store/appStore";

/**
 * Persistent scratchpad, mounted once at the layout root so it stays open
 * (and keeps its content) no matter which tab/module is active.
 */
export default function NotesPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const notes = useAppStore((s) => s.notes);
  const addNote = useAppStore((s) => s.addNote);
  const updateNote = useAppStore((s) => s.updateNote);
  const deleteNote = useAppStore((s) => s.deleteNote);
  const sendNoteToBoard = useAppStore((s) => s.sendNoteToBoard);
  const activeCaseId = useAppStore((s) => s.activeCaseId);

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-16 right-4 z-[70] w-11 h-11 flex items-center justify-center bg-bg-panel/95 backdrop-blur-xl border border-cyan-primary/40 text-cyan-text hover:bg-cyan-primary hover:text-bg-void transition-all shadow-[0_0_14px_rgba(47,241,228,0.15)]"
        style={{ clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" }}
        title="Field Notes"
      >
        {isOpen ? <X className="w-5 h-5" /> : <NotebookPen className="w-5 h-5" />}
        {!isOpen && notes.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-text text-bg-void text-[9px] font-black flex items-center justify-center">
            {notes.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-[74px] right-4 z-[69] w-[320px] max-h-[70vh] flex flex-col">
          <GlassPanel className="flex-1 flex flex-col overflow-hidden p-3" clipSize="md" showCornerTicks>
            <div className="border-b border-border-hairline/25 pb-2 mb-2.5 flex items-center justify-between shrink-0">
              <DatabaseTag text="FIELD NOTES" />
              <button
                onClick={() => addNote("")}
                className="w-6 h-6 flex items-center justify-center bg-cyan-primary/10 hover:bg-cyan-primary text-cyan-text hover:text-bg-void border border-cyan-primary/30 transition-colors"
                title="New note"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-0.5">
              {notes.length === 0 && (
                <p className="text-text-dim/40 text-center italic py-8 text-[11px]">
                  -- NO NOTES YET --
                </p>
              )}
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-bg-void/40 border border-border-hairline/15 p-2 group"
                  style={{ clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" }}
                >
                  <textarea
                    value={note.text}
                    onChange={(e) => updateNote(note.id, e.target.value)}
                    placeholder="Morse: .... . .-.. .-.. ---"
                    rows={3}
                    className="w-full bg-transparent resize-none outline-none text-[11.5px] font-share text-text-primary placeholder:text-text-dim/40"
                  />
                  <div className="flex items-center justify-end space-x-1.5 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => sendNoteToBoard(note.id)}
                      disabled={!activeCaseId || !note.text.trim()}
                      className="flex items-center space-x-1 px-2 py-0.5 text-[9.5px] font-orbitron font-bold uppercase tracking-wider text-cyan-text hover:text-bg-void hover:bg-cyan-primary border border-cyan-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title={activeCaseId ? "Send to Detective Board" : "Select an active case first"}
                    >
                      <Send className="w-3 h-3" />
                      <span>BOARD</span>
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="w-5 h-5 flex items-center justify-center text-text-dim hover:text-red-threat transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      )}
    </>
  );
}
