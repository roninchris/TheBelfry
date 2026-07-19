import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FilterSpecification } from "maplibre-gl";
import { buildMapStyle, PLACE_LABEL_CLASSES, PLACE_LABEL_NAME } from "../../lib/geo/mapStyle";
import { playMapDrag, playMapZoom } from "../../lib/soundEngine";
import type { MapTarget } from "../../lib/geo/coordinates";

/**
 * The tile surface.
 *
 * Owns the MapLibre instance and nothing else — plotting logic, search and the
 * target register all live in `MapModule`, so this only has to answer "show
 * this position, in this projection".
 *
 * **No geolocation.** `GeolocateControl` is deliberately never constructed and
 * `navigator.geolocation` is never touched, so the browser has no reason to
 * prompt. The camera starts on a fixed survey position and moves only when a
 * target is handed to it.
 */

export type SurfaceStatus = "loading" | "ready" | "failed";

interface MapSurfaceProps {
  /** Position the camera should hold. */
  target: MapTarget | null;
  /** Every plotted position, drawn as markers. */
  markers: MapTarget[];
  /** Draw buildings as volumes and pitch the camera over. */
  extruded: boolean;
  /** Re-styles when the palette changes, since the style bakes in colours. */
  themeKey: string;
  onStatusChange?: (status: SurfaceStatus) => void;
}

/**
 * Where the camera rests before anything is plotted — Midtown Manhattan.
 *
 * Zoomed to 14.6 rather than a city-wide 11 on purpose: the building layers
 * carry no data below z13, so opening further out would show the volumes
 * switched on with nothing to extrude.
 */
const HOME = { lat: 40.7549, lon: -73.984, zoom: 14.6 };

/** Camera framing per projection. Pitch is what sells the volumes. */
const FLAT = { pitch: 0, bearing: 0 };
const TILTED = { pitch: 58, bearing: -22 };

export default function MapSurface({
  target,
  markers,
  extruded,
  themeKey,
  onStatusChange,
}: MapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const [status, setStatus] = useState<SurfaceStatus>("loading");
  const [bearing, setBearing] = useState(0);

  /**
   * Drag-to-rotate on the compass.
   *
   * The primary rotation control, not a convenience: right-drag is unusable in
   * browsers that bind the right button to navigation gestures, so rotation
   * needs a path that only ever uses the left button. Pointer capture keeps the
   * gesture alive if the cursor leaves the little dial mid-drag.
   */
  const beginCompassDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    if (!map) return;
    e.preventDefault();
    const dial = e.currentTarget;
    const box = dial.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;

    const angleAt = (px: number, py: number) =>
      (Math.atan2(py - cy, px - cx) * 180) / Math.PI;

    const startAngle = angleAt(e.clientX, e.clientY);
    const startBearing = map.getBearing();
    let moved = false;

    dial.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      moved = true;
      map.setBearing(startBearing - (angleAt(ev.clientX, ev.clientY) - startAngle));
    };
    const onUp = (ev: PointerEvent) => {
      dial.releasePointerCapture(ev.pointerId);
      dial.removeEventListener("pointermove", onMove);
      dial.removeEventListener("pointerup", onUp);
      // A click without movement is a reset — the conventional compass
      // affordance, and the quickest way back to a readable orientation.
      if (!moved) map.easeTo({ bearing: 0, duration: 420 });
    };

    dial.addEventListener("pointermove", onMove);
    dial.addEventListener("pointerup", onUp);
  };

  // Status is mirrored to the parent through a ref so the effects below do not
  // have to depend on a callback identity that changes every render.
  const statusCb = useRef(onStatusChange);
  statusCb.current = onStatusChange;

  const report = (next: SurfaceStatus) => {
    setStatus(next);
    statusCb.current?.(next);
  };

  /* ------------------------------------------------------------------ */
  /* Instance lifecycle. Rebuilt only when the palette changes.          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle({ extruded }),
      center: [target?.lon ?? HOME.lon, target?.lat ?? HOME.lat],
      zoom: target ? 15 : HOME.zoom,
      pitch: extruded ? TILTED.pitch : FLAT.pitch,
      bearing: extruded ? TILTED.bearing : FLAT.bearing,
      // Our own attribution is rendered as part of the HUD chrome, so the
      // default control would duplicate it.
      attributionControl: false,
      // Nothing here needs to survive a reload, and the default logo/anchor
      // furniture fights the frame.
      logoPosition: "bottom-left",
    });
    mapRef.current = map;

    /**
     * Readiness is keyed on the *style* being loaded, not the `load` event.
     *
     * `load` waits for the first completed render, and rendering is
     * rAF-driven — so in a backgrounded tab it never fires and the module
     * would sit on "acquiring feed" indefinitely even though the style is
     * fetched and the map is fully usable. Everything gated on readiness here
     * (layer visibility, camera moves, markers) needs the style, not a frame.
     */
    const markReady = () => {
      if (map.isStyleLoaded()) report("ready");
    };
    map.on("style.load", markReady);
    map.on("load", markReady);
    map.on("styledata", markReady);

    // Tile 404s are routine at the edges of coverage and must not be treated as
    // a failure; only a style or source that never comes up is fatal.
    map.on("error", (e) => {
      const msg = String((e as { error?: Error }).error?.message ?? "");
      if (/style|glyph|source/i.test(msg) && !map.isStyleLoaded()) report("failed");
    });

    /*
      Movement cues.

      Bound to the user-initiated events only. `drag`/`zoom` also fire for
      programmatic camera moves, which would mean a search result played a pan
      sound while flying itself across the world — so these listen to the
      gesture, not the camera.

      Both cues are throttled inside the sound engine rather than here, because
      a drag emits events every frame and a trackpad pinch emits a stream.
    */
    /*
      Right-drag rotation vs. browser mouse gestures.

      Vivaldi and Opera bind right-button drags and rocker chords to back /
      forward navigation at the browser level, so MapLibre's right-drag rotate
      navigates the page out from under the map. Suppressing the context menu
      on the canvas is what stops the gesture from being recognised — but it is
      only half the fix, because it cannot be relied on across browsers. The
      compass control below is the other half: rotation never *requires* the
      right button.
    */
    const container = map.getCanvasContainer();
    const blockContextMenu = (e: Event) => e.preventDefault();
    container.addEventListener("contextmenu", blockContextMenu);

    // Keep the bearing readout live for the compass.
    const syncBearing = () => setBearing(map.getBearing());
    map.on("rotate", syncBearing);
    map.on("move", syncBearing);

    map.on("dragstart", playMapDrag);
    map.on("drag", playMapDrag);
    map.on("wheel", playMapZoom);
    map.on("zoomstart", (ev) => {
      // originalEvent is absent on programmatic zooms (flyTo, easeTo).
      if ((ev as { originalEvent?: unknown }).originalEvent) playMapZoom();
    });

    return () => {
      container.removeEventListener("contextmenu", blockContextMenu);
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
    // `extruded` and `target` are intentionally excluded: they are applied by
    // the effects below without tearing the instance down. Only a palette
    // change requires a rebuild, because the style spec bakes colours in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey]);

  /* ------------------------------------------------------------------ */
  /* Projection: toggle the building layers and swing the camera.        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;

    // Toggling visibility rather than rebuilding the style keeps the already
    // fetched tiles in place, so the switch is instant and costs no network.
    if (map.getLayer("building-3d")) {
      map.setLayoutProperty("building-3d", "visibility", extruded ? "visible" : "none");
    }
    if (map.getLayer("building-flat")) {
      map.setLayoutProperty("building-flat", "visibility", extruded ? "none" : "visible");
    }
    map.easeTo({ ...(extruded ? TILTED : FLAT), duration: 900 });
  }, [extruded, status]);

  /* ------------------------------------------------------------------ */
  /* Camera: fly to the active target.                                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !target || status !== "ready") return;
    map.flyTo({
      center: [target.lon, target.lat],
      // Close enough that buildings are loaded and the volumes have something
      // to show; the building layers only carry data from z13.
      zoom: 15.5,
      pitch: extruded ? TILTED.pitch : FLAT.pitch,
      duration: 2200,
      essential: true,
    });
    // `extruded` is read but not depended on: a projection change should not
    // re-fly to the same target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, status]);

  /* ------------------------------------------------------------------ */
  /* Duplicate label suppression.                                        */
  /* ------------------------------------------------------------------ */
  /**
   * Hides basemap place labels that a marker is already naming.
   *
   * Markers are DOM elements, so they sit outside MapLibre's symbol collision
   * system and can never be de-conflicted against the tile labels — a pin over
   * New York renders its own "NEW YORK" directly on top of the basemap's. Since
   * the pin carries the better label anyway (it is the resolved fix, and it is
   * styled to match the HUD), the tile label is the one to drop.
   *
   * Matched by name rather than by proximity so only the genuine duplicate goes:
   * every other label on screen is left to do its orientation job.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer("place-label")) return;

    const names = markers
      .map((m) => m.label?.trim().toLowerCase())
      // Short names are excluded from containment matching: a three-letter
      // token appears inside unrelated place names and would silently strip
      // labels that have nothing to do with the pin.
      .filter((n): n is string => !!n && n.length >= 4);

    if (names.length === 0) {
      map.setFilter("place-label", PLACE_LABEL_CLASSES as unknown as FilterSpecification);
      return;
    }

    /*
      Matched by containment in both directions rather than equality.

      The two sources disagree on form constantly — the gazetteer says "City of
      White Plains" where the tiles say "White Plains", and "New York" where
      the tiles say "New York City". Neither string reliably contains the
      other, so both directions are tested.
    */
    const duplicates = names.flatMap((n) => [
      [">=", ["index-of", ["literal", n], PLACE_LABEL_NAME], 0],
      [">=", ["index-of", PLACE_LABEL_NAME, ["literal", n]], 0],
    ]);

    map.setFilter("place-label", [
      "all",
      PLACE_LABEL_CLASSES,
      ["!", ["any", ...duplicates]],
    ] as unknown as FilterSpecification);
  }, [markers, status]);

  /* ------------------------------------------------------------------ */
  /* Markers.                                                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = markers.map((t) => {
      const isActive = target != null && t.lat === target.lat && t.lon === target.lon;

      const el = document.createElement("div");
      el.className = `map-pin${isActive ? " map-pin-active" : ""}`;
      el.innerHTML = `
        <span class="map-pin-ring"></span>
        <span class="map-pin-core"></span>
        <span class="map-pin-label">${escapeHtml(t.label ?? "FIX")}</span>
      `;

      return new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([t.lon, t.lat])
        .addTo(map);
    });
  }, [markers, target, status]);

  return (
    <div className="absolute inset-0">
      {/*
        Positioned inline, not with utilities.

        `maplibre-gl.css` sets `.maplibregl-map { position: relative }` and is
        imported unlayered, so it outranks Tailwind's entire utilities layer —
        an `absolute inset-0` here silently loses and the container collapses to
        zero height, leaving the canvas stuck at its 300px default inside a
        full-height panel. An inline style beats any stylesheet, layered or not.
      */}
      <div
        ref={containerRef}
        className="map-surface"
        style={{ position: "absolute", inset: 0 }}
      />

      {/* Compass — drag to rotate, click to face north. */}
      {status === "ready" && (
        <div
          onPointerDown={beginCompassDrag}
          title="Drag to rotate · click to face north"
          className="absolute top-3 right-3 z-30 w-11 h-11 rounded-full border border-cyan-primary/40 bg-bg-void/70 backdrop-blur-sm cursor-grab active:cursor-grabbing touch-none select-none hover:border-cyan-primary/80 transition-colors"
        >
          <div
            className="absolute inset-0"
            style={{ transform: `rotate(${-bearing}deg)` }}
          >
            {/* North needle */}
            <div className="absolute left-1/2 top-1 h-3.5 w-[2px] -translate-x-1/2 bg-cyan-primary shadow-[0_0_6px_rgb(var(--rgb-accent))]" />
            <div className="absolute left-1/2 bottom-1 h-2.5 w-[1px] -translate-x-1/2 bg-cyan-primary/35" />
            <div className="absolute left-1 top-1/2 w-2 h-[1px] -translate-y-1/2 bg-cyan-primary/35" />
            <div className="absolute right-1 top-1/2 w-2 h-[1px] -translate-y-1/2 bg-cyan-primary/35" />
          </div>
          <span className="absolute inset-0 flex items-center justify-center font-display text-[9px] font-black tracking-widest text-cyan-text/70">
            {Math.round((bearing + 360) % 360)}°
          </span>
        </div>
      )}

      {/* Tiles arriving. Reads as a station acquiring a feed, not a spinner. */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-void/70 backdrop-blur-sm z-20">
          <div className="text-center">
            <div className="font-display text-[12px] font-black tracking-[0.3em] text-cyan-text/70 uppercase animate-hex-pulse-flicker">
              Acquiring cartography feed
            </div>
            <div className="font-mono text-[11px] text-text-dim/50 mt-1.5">
              Streaming vector tiles
            </div>
          </div>
        </div>
      )}

      {/* Feed down is an in-fiction alert, not a broken-image box. */}
      {status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-void/85 backdrop-blur-sm z-20">
          <div className="text-center px-6">
            <div className="font-display text-[12px] font-black tracking-[0.3em] text-amber-alert uppercase">
              Cartography feed unavailable
            </div>
            <div className="font-mono text-[11px] text-text-dim/60 mt-1.5 leading-relaxed">
              No route to the tile host. Coordinates still resolve locally —
              <br />
              positions plot to the register without the basemap.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Marker labels are user-supplied text going into innerHTML. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
