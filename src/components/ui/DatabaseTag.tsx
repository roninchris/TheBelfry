import React from "react";

interface DatabaseTagProps {
  text: string;
  className?: string;
}

export default function DatabaseTag({ text, className = "" }: DatabaseTagProps) {
  return (
    <div
      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 bg-cyan-primary/[0.04] border border-cyan-primary/20 text-cyan-text font-share text-[12px] font-bold tracking-widest uppercase rounded-xs ${className}`}
      style={{ letterSpacing: "0.15em" }}
      id="database-tag-element"
    >
      <span className="text-[12px] text-cyan-primary select-none">▸</span>
      <span>{text}</span>
    </div>
  );
}
