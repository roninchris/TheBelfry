import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playPinClick } from "../../lib/soundEngine";

const W = 260;
const H = 200;

interface Node {
  x: number;
  y: number;
  /** Staggered so the field never pulses in unison. */
  phase: number;
  speed: number;
}

interface Edge {
  a: number;
  b: number;
  len: number;
}

/**
 * Neural activity visualiser — an inference field that fires signals along its
 * own connections, standing in for the console "thinking".
 *
 * Drawn to a canvas rather than SVG: ~34 nodes and ~70 edges with per-frame
 * travelling pulses would mean hundreds of attribute writes per frame in the
 * DOM. One canvas is a single element and the whole thing stays off the React
 * render path — state changes never re-render this component.
 *
 * The rAF loop stops when the tab is hidden and when the element scrolls out of
 * view, so it costs nothing while the user is in another module.
 */
export default function NeuralActivity({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const burstsRef = useRef<{ x: number; y: number; t: number }[]>([]);
  /** Shared clock origin. The pointer handler and the rAF loop must timestamp
   *  bursts against the same zero or they land outside the visible window. */
  const originRef = useRef<number>(performance.now());
  const [visible, setVisible] = useState(true);

  const { nodes, edges } = useMemo(() => {
    // Poisson-ish scatter: reject candidates that land on top of a neighbour so
    // the field looks organic rather than gridded.
    const nodes: Node[] = [];
    let guard = 0;
    while (nodes.length < 34 && guard < 2000) {
      guard++;
      const x = 14 + Math.random() * (W - 28);
      const y = 14 + Math.random() * (H - 28);
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 24)) continue;
      nodes.push({
        x,
        y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
      });
    }

    // Connect each node to its nearest few neighbours.
    const edges: Edge[] = [];
    const seen = new Set<string>();
    nodes.forEach((n, i) => {
      const near = nodes
        .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      near.forEach(({ j, d }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key) || d > 62) return;
        seen.add(key);
        edges.push({ a: i, b: j, len: d });
      });
    });

    return { nodes, edges };
  }, []);

  // Pause when off-screen or backgrounded.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.01,
    });
    io.observe(el);
    const onVis = () => setVisible(!document.hidden && !!wrapRef.current);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Resolve theme colours once per run; they only change on theme switch,
    // which remounts nothing — so re-read them cheaply on each resize instead.
    let accent = "0 243 255";
    let primary = "112 162 168";
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      accent = cs.getPropertyValue("--rgb-accent").trim() || accent;
      primary = cs.getPropertyValue("--rgb-primary").trim() || primary;
    };
    readTheme();

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      readTheme();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;

    const frame = (now: number) => {
      const t = (now - originRef.current) / 1000;
      const rect = canvas.getBoundingClientRect();

      // Node coordinates live in a fixed W x H design space, but the panel is
      // rarely that aspect ratio. Scaling the context non-uniformly to fit
      // would turn every arc() into an ellipse, so instead map positions into
      // the real box and leave radii in unscaled pixels.
      const mapX = (x: number) => (x / W) * rect.width;
      const mapY = (y: number) => (y / H) * rect.height;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const p = pointerRef.current;

      // Edges, with a signal travelling along each.
      edges.forEach((e, i) => {
        const a = nodes[e.a];
        const b = nodes[e.b];
        ctx.strokeStyle = `rgb(${primary} / 0.22)`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(mapX(a.x), mapY(a.y));
        ctx.lineTo(mapX(b.x), mapY(b.y));
        ctx.stroke();

        if (reduce) return;
        // Travelling pulse; offset per edge so they do not march in step.
        const u = ((t * 0.35 + (i % 7) / 7) % 1);
        const px = mapX(a.x + (b.x - a.x) * u);
        const py = mapY(a.y + (b.y - a.y) * u);
        const fade = Math.sin(u * Math.PI);
        ctx.fillStyle = `rgb(${accent} / ${0.5 * fade})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Nodes.
      nodes.forEach((n) => {
        const breathe = reduce ? 0.5 : (Math.sin(t * n.speed + n.phase) + 1) / 2;
        let boost = 0;
        if (p) {
          const d = Math.hypot(n.x - p.x, n.y - p.y);
          boost = Math.max(0, 1 - d / 55);
        }
        // Click bursts wash outward as an expanding ring of excitation.
        let burst = 0;
        for (const bst of burstsRef.current) {
          const age = t - bst.t;
          if (age < 0 || age > 1.1) continue;
          const radius = age * 150;
          const d = Math.hypot(n.x - bst.x, n.y - bst.y);
          const band = Math.max(0, 1 - Math.abs(d - radius) / 26);
          burst = Math.max(burst, band * (1 - age / 1.1));
        }

        const energy = Math.min(1, breathe * 0.5 + boost + burst);
        const r = 1.6 + energy * 3.2;
        const nx = mapX(n.x);
        const ny = mapY(n.y);

        ctx.fillStyle = `rgb(${accent} / ${0.18 + energy * 0.8})`;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fill();

        if (energy > 0.45) {
          ctx.strokeStyle = `rgb(${accent} / ${(energy - 0.45) * 0.7})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.arc(nx, ny, r + 3.5 + energy * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      burstsRef.current = burstsRef.current.filter((b) => t - b.t < 1.2);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [visible, nodes, edges]);

  const toLocal = useCallback((e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  }, []);

  return (
    // Anchored with absolute inset-0 against the nearest positioned ancestor
    // (the caller must be `relative`). Percentage heights do not resolve
    // against a flex parent with an indefinite height — the canvas then falls
    // back to its intrinsic 300x150 aspect and renders ~52px tall in a 170px
    // box — and `flex-1` here would size the width, not the height.
    <div ref={wrapRef} className={`absolute inset-0 ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair touch-none block"
        onPointerMove={(e) => {
          pointerRef.current = toLocal(e);
        }}
        onPointerLeave={() => {
          pointerRef.current = null;
        }}
        onPointerDown={(e) => {
          const p = toLocal(e);
          if (!p) return;
          playPinClick();
          burstsRef.current.push({
            ...p,
            t: (performance.now() - originRef.current) / 1000,
          });
        }}
        role="presentation"
      />
    </div>
  );
}
