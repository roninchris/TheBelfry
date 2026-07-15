import React from "react";
import { Check } from "lucide-react";

interface CheckboxProps {
  label?: string;
  className?: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export default function Checkbox({ label, className = "", checked, onChange, disabled, ...props }: CheckboxProps) {
  const id = React.useId();

  return (
    <label 
      htmlFor={id} 
      className={`group flex items-center space-x-2.5 cursor-pointer select-none ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          {...props}
        />
        {/* HUD Box Background */}
        <div className={`w-3.5 h-3.5 bg-bg-void border transition-all duration-200 flex items-center justify-center
          ${checked 
            ? "border-cyan-primary bg-cyan-primary/10 shadow-[0_0_8px_rgba(112,162,168,0.3)]" 
            : "border-border-hairline/40 group-hover:border-cyan-primary/40"
          }`}
          style={{ clipPath: "polygon(20% 0%, 100% 0%, 100% 80%, 80% 100%, 0% 100%, 0% 20%)" }}
        >
          {checked && (
            <Check className="w-2.5 h-2.5 text-cyan-text animate-lock-on-snap" />
          )}
        </div>
        
        {/* Decorative corner tick (outer) */}
        <div className={`absolute -top-0.5 -left-0.5 w-1 h-1 border-t border-l transition-colors duration-200
          ${checked ? "border-cyan-primary opacity-100" : "border-transparent opacity-0"}`} 
        />
      </div>
      
      {label && (
        <span className={`text-[11px] uppercase font-share font-bold tracking-widest transition-colors duration-200
          ${checked ? "text-cyan-text" : "text-text-dim group-hover:text-text-primary"}`}>
          {label}
        </span>
      )}
    </label>
  );
}
