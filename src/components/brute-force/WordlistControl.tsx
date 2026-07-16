import React, { useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { DEFAULT_WORDLIST } from "../../lib/tools/bruteForce";

interface WordlistControlProps {
  onWordlistChange: (words: string[]) => void;
}

export default function WordlistControl({ onWordlistChange }: WordlistControlProps) {
  const [customWords, setCustomWords] = useState<string>("");
  const [isUsingDefault, setIsUsingDefault] = useState(true);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCustomWords(text);
    if (text.trim()) {
      setIsUsingDefault(false);
      const words = text.split(/\n|,/).map(w => w.trim()).filter(w => w.length > 0);
      onWordlistChange(words);
    } else {
      setIsUsingDefault(true);
      onWordlistChange(DEFAULT_WORDLIST);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCustomWords(text);
      setIsUsingDefault(false);
      const words = text.split(/\n|,/).map(w => w.trim()).filter(w => w.length > 0);
      onWordlistChange(words);
    };
    reader.readAsText(file);
  };

  const resetToDefault = () => {
    setCustomWords("");
    setIsUsingDefault(true);
    onWordlistChange(DEFAULT_WORDLIST);
  };

  return (
    <div className="space-y-2 p-3 bg-bg-void/40 border border-border-hairline/20 rounded-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-primary uppercase tracking-widest">
          <FileText size={12} />
          <span>Wordlist Strategy</span>
        </div>
        {isUsingDefault ? (
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-primary/10 text-cyan-primary border border-cyan-primary/20 rounded-full">
            BUILT-IN (200+)
          </span>
        ) : (
          <button 
            onClick={resetToDefault}
            className="text-[10px] font-mono px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full hover:bg-red-500/20 transition-colors flex items-center gap-1"
          >
            <X size={8} />
            RESET TO DEFAULT
          </button>
        )}
      </div>

      <div className="relative">
        <textarea
          value={customWords}
          onChange={handleTextChange}
          placeholder="Paste keys here (one per line)..."
          className="w-full h-24 bg-bg-void/60 border border-border-hairline/10 rounded-sm p-2 text-[11px] font-mono text-text-primary placeholder:text-text-dim/30 focus:outline-none focus:border-cyan-primary/30 scrollbar-thin"
        />
        <label className="absolute bottom-2 right-2 cursor-pointer group">
          <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt" />
          <div className="flex items-center gap-1 text-[10.5px] font-mono text-text-dim group-hover:text-cyan-primary transition-colors bg-bg-void/80 px-1.5 py-0.5 rounded border border-border-hairline/10">
            <Upload size={10} />
            UPLOAD .TXT
          </div>
        </label>
      </div>
      
      <p className="text-[10.5px] text-text-dim/60 leading-tight">
        {isUsingDefault 
          ? "Currently using built-in dictionary with common English forensic terms."
          : "Using custom wordlist. Brute force will attempt every entry provided."}
      </p>
    </div>
  );
}
