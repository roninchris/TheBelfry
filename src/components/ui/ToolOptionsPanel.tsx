import React from "react";
import { ToolOptionField } from "../../lib/tools/types";
import HeroStat from "./HeroStat";

interface ToolOptionsPanelProps {
  optionsSchema?: ToolOptionField[];
  options: Record<string, any>;
  onChange: (key: string, value: any) => void;
  variant?: "compact" | "default";
}

export function ToolOptionsPanel({ optionsSchema, options, onChange, variant = "default" }: ToolOptionsPanelProps) {
  if (!optionsSchema || optionsSchema.length === 0) {
    if (variant === "compact") {
      return <span className="text-[12px] font-mono text-text-dim/40 uppercase block text-center italic">No parameters required</span>;
    }
    return null; // Or some placeholder for default variant if needed
  }

  const isCompact = variant === "compact";

  return (
    <div className={isCompact ? "py-1 grid grid-cols-1 gap-2" : "space-y-4"}>
      {optionsSchema.map((field) => {
        const val = options[field.name] ?? field.defaultValue;

        if (field.type === "number") {
          if (field.min !== undefined && field.max !== undefined && field.max - field.min > 10) {
            // Range slider
            if (isCompact) {
              return (
                <div key={field.name} className="flex items-center space-x-2">
                  <span className="text-[12px] font-mono text-cyan-primary uppercase font-bold shrink-0">{field.label}:</span>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    value={val as number}
                    onChange={(e) => onChange(field.name, parseInt(e.target.value))}
                    className="flex-1 accent-cyan-primary bg-bg-void h-1"
                  />
                  <span className="font-mono text-[12px] text-white px-1 border border-border-hairline/25">{val as number}</span>
                </div>
              );
            } else {
              return (
                <div key={field.name} className="space-y-2">
                  <HeroStat
                    label={field.label.toUpperCase()}
                    value={field.name === "shift" ? `+${val}` : String(val)}
                    valueClassName="!text-lg text-cyan-text"
                    disabledShine={true}
                  />
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    value={val as number}
                    onChange={(e) => onChange(field.name, parseInt(e.target.value))}
                    className="w-full accent-cyan-primary"
                  />
                  {field.name === "shift" && (
                    <div className="flex justify-between text-[12px] text-text-dim font-mono mt-1">
                      <span>A → B (1)</span>
                      <span>A → N (13)</span>
                      <span>A → Z (25)</span>
                    </div>
                  )}
                </div>
              );
            }
          } else {
            // Number input
            if (isCompact) {
              return (
                <div key={field.name} className="flex items-center space-x-2">
                  <span className="text-[12px] font-mono text-cyan-primary uppercase font-bold shrink-0">{field.label}:</span>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={val as number}
                    onChange={(e) => onChange(field.name, parseInt(e.target.value) || 0)}
                    className="w-12 bg-bg-void border border-border-hairline/25 text-[12px] font-mono text-white text-center py-0.5"
                  />
                </div>
              );
            } else {
              return (
                <div key={field.name} className="space-y-2">
                  <span className="text-[12px] font-share text-text-dim block uppercase">{field.label}:</span>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={val as number}
                    onChange={(e) => onChange(field.name, parseInt(e.target.value) || 0)}
                    className="w-full bg-bg-void border border-border-hairline/20 p-1.5 font-mono text-[13px] text-cyan-primary focus:border-cyan-primary outline-none"
                  />
                </div>
              );
            }
          }
        }

        if (field.type === "text") {
          const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newVal = field.name === "key" ? e.target.value.toUpperCase().replace(/[^A-Z]/g, "") : e.target.value;
            onChange(field.name, newVal);
          };

          if (isCompact) {
            return (
              <div key={field.name} className="flex items-center space-x-2">
                <span className="text-[12px] font-mono text-cyan-primary uppercase font-bold shrink-0">{field.label}:</span>
                <input
                  type="text"
                  value={val as string}
                  onChange={handleChange}
                  className="flex-1 bg-bg-void/80 border border-border-hairline/15 px-2 py-0.5 text-[12px] font-mono text-white focus:outline-none uppercase"
                  placeholder={field.placeholder ?? field.label}
                />
              </div>
            );
          } else {
            return (
              <div key={field.name} className="space-y-2">
                <span className="text-[12px] font-share text-text-dim block uppercase">{field.label}:</span>
                <input
                  type="text"
                  value={val as string}
                  onChange={handleChange}
                  className="w-full bg-bg-void border border-border-hairline/20 p-1.5 font-mono text-[13px] text-cyan-primary focus:border-cyan-primary outline-none uppercase"
                  placeholder={`ENTER ${field.label.toUpperCase()}`}
                />
              </div>
            );
          }
        }

        if (field.type === "textarea") {
          if (isCompact) {
            return (
              <div key={field.name} className="flex flex-col mb-1">
                <span className="text-[12px] font-mono text-cyan-primary uppercase font-bold mb-0.5">{field.label}:</span>
                <textarea
                  rows={2}
                  value={val as string}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className="w-full bg-bg-void/80 border border-border-hairline/15 px-1.5 py-1 text-[12px] font-mono text-white focus:outline-none placeholder-text-dim/30 resize-none scrollbar-thin"
                  placeholder={field.placeholder ?? "Enter text..."}
                />
              </div>
            );
          } else {
            return (
              <div key={field.name} className="space-y-2">
                <span className="text-[12px] font-share text-text-dim block uppercase">{field.label}:</span>
                <textarea
                  rows={3}
                  value={val as string}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className="w-full flex-1 bg-bg-void border border-border-hairline/20 p-1.5 font-mono text-[13px] text-cyan-primary outline-none focus:border-cyan-primary/50 resize-none scrollbar-thin"
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              </div>
            );
          }
        }

        if (field.type === "enum") {
          if (isCompact) {
            return (
              <div key={field.name} className="flex items-center space-x-2">
                <span className="text-[12px] font-mono text-cyan-primary uppercase font-bold shrink-0">{field.label}:</span>
                <select
                  value={val as string}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className="bg-bg-void border border-border-hairline/25 text-[12px] font-mono text-white py-0.5 px-1.5 focus:outline-none flex-1"
                >
                  {field.enumValues?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          } else {
            return (
              <div key={field.name} className="space-y-2">
                <span className="text-[12px] font-share text-text-dim block uppercase">{field.label}:</span>
                <select
                  value={val as string}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className="w-full bg-bg-void border border-border-hairline/20 p-1.5 font-mono text-[13px] text-cyan-primary outline-none focus:border-cyan-primary"
                >
                  {field.enumValues?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          }
        }

        if (field.type === "boolean") {
          if (isCompact) {
            return (
              <div key={field.name} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={!!val}
                  onChange={(e) => onChange(field.name, e.target.checked)}
                  className="accent-cyan-primary h-3 w-3"
                />
                <span className="text-[12px] font-mono text-cyan-primary uppercase font-bold">{field.label}</span>
              </div>
            );
          } else {
            return (
              <div key={field.name} className="space-y-2 flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={!!val}
                  onChange={(e) => onChange(field.name, e.target.checked)}
                  className="accent-cyan-primary"
                />
                <span className="text-[12px] font-share text-text-dim uppercase">{field.label}</span>
              </div>
            );
          }
        }

        if (field.type === "matrix") {
          const size = field.matrixSize || 2;
          const matrixVal = val as number[][];
          
          if (isCompact) {
            return (
              <div key={field.name} className="flex flex-col space-y-1 py-1">
                <span className="text-[12px] font-mono text-cyan-primary uppercase font-bold shrink-0">{field.label}:</span>
                <div className="grid gap-1 w-32" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
                  {Array.from({ length: size }).flatMap((_, r) =>
                    Array.from({ length: size }).map((_, c) => (
                      <input
                        key={`${r}-${c}`}
                        type="number"
                        value={matrixVal?.[r]?.[c] ?? (r === c ? 1 : 0)}
                        onChange={(e) => {
                          const newMatrix = (matrixVal || Array.from({length: size}, (_, i) => Array.from({length: size}, (_, j) => (i===j ? 1 : 0)))).map((rowArr, ri) =>
                            rowArr.map((v, ci) => (ri === r && ci === c) ? (parseInt(e.target.value) || 0) : v)
                          );
                          onChange(field.name, newMatrix);
                        }}
                        className="w-full bg-bg-void border border-border-hairline/25 text-[12px] font-mono text-white text-center py-0.5 focus:outline-none"
                      />
                    ))
                  )}
                </div>
              </div>
            );
          } else {
            return (
              <div key={field.name} className="space-y-2">
                <span className="text-[12px] font-share text-text-dim block uppercase">{field.label}:</span>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
                  {Array.from({ length: size }).flatMap((_, r) =>
                    Array.from({ length: size }).map((_, c) => (
                      <input
                        key={`${r}-${c}`}
                        type="number"
                        value={matrixVal?.[r]?.[c] ?? (r === c ? 1 : 0)}
                        onChange={(e) => {
                          const newMatrix = (matrixVal || Array.from({length: size}, (_, i) => Array.from({length: size}, (_, j) => (i===j ? 1 : 0)))).map((rowArr, ri) =>
                            (rowArr || []).map((v, ci) => (ri === r && ci === c) ? (parseInt(e.target.value) || 0) : v)
                          );
                          onChange(field.name, newMatrix);
                        }}
                        className="w-full bg-bg-void border border-border-hairline/20 p-1.5 font-mono text-[13px] text-cyan-primary text-center focus:border-cyan-primary outline-none"
                      />
                    ))
                  )}
                </div>
              </div>
            );
          }
        }

        return null;
      })}
    </div>
  );
}
