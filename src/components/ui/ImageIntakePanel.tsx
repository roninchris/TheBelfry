import React, { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, ScanLine, X, AlertTriangle, CheckCircle } from "lucide-react";
import Badge from "./Badge";
import { decodeImageFile, getStrategy, type ImageDecodeResult } from "../../lib/tools/image-decode";
import {
  playImageForensicsScan,
  playSuccessChime,
  playFailBuzz,
  playHoverEvidence,
  playReticleLock,
} from "../../lib/soundEngine";

export interface IntakeScheme {
  id: string;
  label: string;
}

interface ImageIntakePanelProps {
  /** Recognition strategy id (a cipher/encoding id, or an atlas scheme). */
  cipherId: string;
  /**
   * Optional scheme picker. Modules that don't have a single selected tool
   * (e.g. the Encoding Deck) pass the schemes the buffer can actually decode;
   * the chosen id overrides `cipherId` for recognition.
   */
  schemes?: IntakeScheme[];
  /** Called with the recognised notation to load into the input buffer. */
  onDecoded: (notation: string) => void;
  onClose: () => void;
}

/**
 * Drop / paste / pick an image of a cipher; recognises it (template match or
 * OCR, per the selected cipher) and lifts the resulting notation to the buffer.
 * All happy/working/success/error states are designed per the Batcomputer
 * design language — a failed read is an amber/red alert, not a web-app banner.
 */
export default function ImageIntakePanel({
  cipherId,
  schemes,
  onDecoded,
  onClose,
}: ImageIntakePanelProps) {
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [result, setResult] = useState<ImageDecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheme, setScheme] = useState<string>(schemes?.[0]?.id ?? cipherId);
  const inputRef = useRef<HTMLInputElement>(null);
  const effectiveId = schemes ? scheme : cipherId;
  const strategy = getStrategy(effectiveId);

  const process = useCallback(
    async (file: Blob) => {
      setScanning(true);
      setError(null);
      setResult(null);
      setThumb(URL.createObjectURL(file));
      playImageForensicsScan();
      try {
        const { result } = await decodeImageFile(effectiveId, file);
        setResult(result);
        if (result.notation) {
          onDecoded(result.notation);
          playSuccessChime();
        } else {
          playFailBuzz();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        playFailBuzz();
      } finally {
        setScanning(false);
      }
    },
    [effectiveId, onDecoded]
  );

  const onFiles = (files: FileList | null) => {
    const file = files && files[0];
    if (file && file.type.startsWith("image/")) process(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFiles(e.dataTransfer.files);
  };

  // Paste an image from the clipboard while the panel is mounted.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) process(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [process]);

  useEffect(() => () => void (thumb && URL.revokeObjectURL(thumb)), [thumb]);

  const confidencePct = result ? Math.round(result.confidence * 100) : 0;
  const lowConfidence = result != null && result.notation.length > 0 && result.confidence < 0.55;
  const noRead = result != null && result.notation.length === 0;

  return (
    <div
      className="relative border border-cyan-primary/25 bg-bg-void/50 p-3"
      style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 font-share text-[12px] font-bold tracking-widest uppercase text-cyan-text">
          <ScanLine className="w-3.5 h-3.5 text-cyan-primary" />
          <span>Optical Cipher Intake</span>
        </div>
        <button
          onClick={() => {
            onClose();
            playReticleLock();
          }}
          onMouseEnter={() => playHoverEvidence()}
          aria-label="Close image intake"
          className="text-text-dim hover:text-red-threat transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scheme selector (modules without a single selected tool) */}
      {schemes && (
        <div className="mb-2.5 flex items-center gap-2">
          <span className="font-share text-[11px] uppercase tracking-widest text-text-dim shrink-0">
            Scheme
          </span>
          <select
            value={scheme}
            onChange={(e) => {
              setScheme(e.target.value);
              playReticleLock();
            }}
            className="flex-1 bg-bg-void/60 border border-border-hairline/25 focus:border-cyan-primary/60 px-2 py-1 font-share text-[12px] uppercase tracking-wider text-cyan-text outline-none"
          >
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => playHoverEvidence()}
        className={`hud-target relative cursor-pointer border border-dashed p-4 flex flex-col items-center justify-center gap-2 text-center transition-all overflow-hidden ${
          dragging
            ? "border-cyan-primary bg-cyan-primary/[0.06]"
            : "border-border-hairline/25 hover:border-cyan-primary/50 bg-bg-void/30"
        }`}
      >
        {/* Scanning sweep */}
        {scanning && (
          <div className="absolute inset-x-0 top-0 h-full pointer-events-none">
            <div className="absolute inset-x-0 h-8 bg-gradient-to-b from-cyan-primary/25 to-transparent animate-radar-sweep" />
          </div>
        )}

        {thumb ? (
          <img
            src={thumb}
            alt="intake preview"
            className="max-h-24 object-contain border border-border-hairline/20 opacity-90"
          />
        ) : (
          <ImageUp className={`w-7 h-7 ${dragging ? "text-cyan-primary" : "text-cyan-primary/50"}`} />
        )}

        <div className="font-share text-[12px] uppercase tracking-wider text-text-dim leading-relaxed">
          {scanning ? (
            <span className="text-cyan-primary animate-pulse">// ANALYZING SIGNAL //</span>
          ) : (
            <>
              Drop, paste, or <span className="text-cyan-text">click to select</span> an image
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {/* Strategy hint */}
      <p className="mt-2 font-share text-[11px] text-text-dim/70 tracking-wide uppercase leading-relaxed">
        {strategy.hint}
      </p>

      {/* Result readout */}
      {result && result.notation.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge variant={lowConfidence ? "amber" : "green"} size="xs">
            {result.method === "ocr" ? "OCR" : "TEMPLATE"} · {confidencePct}%
          </Badge>
          {lowConfidence ? (
            <span className="flex items-center gap-1 font-share text-[11px] uppercase tracking-wide text-amber-alert">
              <AlertTriangle className="w-3 h-3" />
              Low confidence — verify or transcribe manually
            </span>
          ) : (
            <span className="flex items-center gap-1 font-share text-[11px] uppercase tracking-wide text-green-verified">
              <CheckCircle className="w-3 h-3" />
              Loaded into buffer
            </span>
          )}
        </div>
      )}

      {/* No-read / error alert (in-fiction threat state) */}
      {(noRead || error) && (
        <div className="mt-2.5 flex items-start gap-2 border border-red-threat/40 bg-red-threat/[0.06] p-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-threat shrink-0 mt-0.5" />
          <span className="font-share text-[11px] uppercase tracking-wide text-red-threat leading-relaxed">
            {error
              ? `Intake fault: ${error}`
              : result?.note ??
                "No cipher recognised. Try a cleaner crop, higher contrast, or the matching cipher engine."}
          </span>
        </div>
      )}
    </div>
  );
}
