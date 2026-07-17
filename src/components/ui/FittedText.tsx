import { useLayoutEffect, useRef, useState } from "react";

interface FittedTextProps {
  text: string;
  className?: string;
}

/**
 * Body text that fills its container and truncates with an ellipsis at whatever
 * line actually fits.
 *
 * `line-clamp-N` cannot do this: the count is baked in, so a card clamped to 3
 * lines shows 3 lines whether it is 80px tall or 400px. Growing a note
 * vertically appeared to do nothing, while growing it horizontally "worked"
 * only because more characters fit on those same 3 lines.
 *
 * There is no pure-CSS "clamp to however many lines fit", so the line count is
 * measured. The element's height is driven by its container (h-full), never by
 * this clamp, so observing its own size cannot feed back into a resize loop.
 */
export default function FittedText({ text, className = "" }: FittedTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [lines, setLines] = useState(3);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const cs = getComputedStyle(el);
      const lineHeight =
        parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 16;
      const available = el.clientHeight;
      if (!available) return;
      setLines(Math.max(1, Math.floor(available / lineHeight)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <p
      ref={ref}
      className={`h-full ${className}`}
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines,
        overflow: "hidden",
      }}
    >
      {text}
    </p>
  );
}
