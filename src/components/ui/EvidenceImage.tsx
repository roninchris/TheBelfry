import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { useAppStore } from "../../store/appStore";

interface EvidenceImageProps {
  /** The node's stored `content`: a data URL, an http link, or a cloud path. */
  refValue: string;
  alt?: string;
  className?: string;
}

/**
 * Renders an evidence image from its stored reference.
 *
 * A node's `content` is the durable reference, not necessarily a displayable
 * URL — for a cloud photo it is a Storage object path that must be exchanged
 * for a signed URL. Resolution is async and backend-specific, so it lives here
 * rather than inline: the store keeps holding the path, and only this component
 * ever touches the transient URL.
 */
export default function EvidenceImage({ refValue, alt = "", className = "" }: EvidenceImageProps) {
  const resolveAssetUrl = useAppStore((s) => s.resolveAssetUrl);
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; url?: string }>({
    status: "loading",
  });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    resolveAssetUrl(refValue)
      .then((url) => {
        if (alive) setState({ status: "ready", url });
      })
      .catch(() => {
        if (alive) setState({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [refValue, resolveAssetUrl]);

  if (state.status === "loading") {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Loader2 className="w-5 h-5 text-cyan-dim animate-spin" />
      </div>
    );
  }

  if (state.status === "error" || !state.url) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 text-center ${className}`}>
        <ImageOff className="w-5 h-5 text-red-threat/60" />
        <span className="font-mono text-[10px] text-red-threat/60 uppercase tracking-wider px-1">
          Image unavailable
        </span>
      </div>
    );
  }

  return (
    <img
      src={state.url}
      alt={alt}
      className={className}
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setState({ status: "error" })}
    />
  );
}
