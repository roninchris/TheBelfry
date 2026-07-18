import React from "react";
import ShinyText from "../react-bits/ShinyText";

interface HeroStatProps {
  label: string;
  value: React.ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  disabledShine?: boolean;
}

export default function HeroStat({
  label,
  value,
  className = "",
  labelClassName = "",
  valueClassName = "",
  disabledShine = false,
}: HeroStatProps) {
  const isStringOrNumber = typeof value === "string" || typeof value === "number";
  const valueStr = isStringOrNumber ? String(value) : "";

  return (
    <div className={`flex flex-col ${className}`} id="hero-stat-container">
      <span
        className={`text-[12px] font-share font-black text-text-dim/70 tracking-widest uppercase block mb-1 ${labelClassName}`}
        style={{ fontVariant: "all-small-caps" }}
      >
        {label}
      </span>
      <div className="flex items-baseline leading-none">
        {!isStringOrNumber ? (
          <div className={`font-display font-black text-2xl text-text-primary tracking-wide leading-none ${valueClassName}`}>
            {value}
          </div>
        ) : disabledShine ? (
          <span
            className={`font-display font-black text-2xl text-text-primary tracking-wide leading-none ${valueClassName}`}
          >
            {valueStr}
          </span>
        ) : (
          <ShinyText
            text={valueStr}
            className={`font-display font-black text-2xl text-text-primary tracking-wide leading-none ${valueClassName}`}
            speed={4}
          />
        )}
      </div>
    </div>
  );
}
