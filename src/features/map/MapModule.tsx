import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../store/appStore";
import GlassPanel from "../../components/ui/GlassPanel";
import { Compass, Crosshair, Search, MapPin, AlertTriangle, Loader2, Trash2, ShieldCheck } from "lucide-react";
import {
  playPinClick,
  playHoverBlip,
  playSuccessChime,
  playScanOpen,
  playTypeKey,
} from "../../lib/soundEngine";
import { AnimatePresence } from "motion/react";
import {
  parseCoordinate,
  formatDecimal,
  formatDMS,
  type GeoCoordinate,
  type MapTarget,
} from "../../lib/geo/coordinates";
import {
  geocodePlace,
  reverseGeocode,
  GeocodeError,
  GEOCODER_ATTRIBUTION,
  tidyPlaceName,
  type GeocodeResult,
  type PlaceDescription,
} from "../../lib/geo/geocode";
import type { SurfaceStatus } from "./MapSurface";
import RadarScanner from "./RadarScanner";
import MapBootOverlay from "./MapBootOverlay";
import { TILE_ATTRIBUTION } from "../../lib/geo/mapStyle";

/**
 * MapLibre is ~800KB and only this module needs it, so it is split out rather
 * than shipped in the main bundle — an analyst who never opens Cartography
 * should not pay to download a renderer they will not use. `mapStyle` is safe
 * to import eagerly: it only type-imports the library, which erases at build.
 */
const MapSurface = React.lazy(() => import("./MapSurface"));

/**
 * TACTICAL CARTOGRAPHY — plots a position from a coordinate or a place name.
 *
 * ARG material gives you a location one of two ways, and the module treats them
 * as genuinely different operations rather than one search box that guesses:
 * a written coordinate is decoded locally and instantly, while a place name has
 * to be asked of an external gazetteer and can fail, be ambiguous, or return
 * nothing. Conflating them would hide a network round trip behind what looks
 * like a local parse.
 *
 * This module never asks the browser where the user is. There is no call to
 * `navigator.geolocation` anywhere in it, so no permission prompt can appear
 * and no position is ever read. The map opens on a fixed survey position and
 * moves only where it is explicitly sent.
 */

/** Where the map rests before anything has been plotted. */
const DEFAULT_VIEW = { lat: 40.7128, lon: -74.006, label: "SURVEY DEFAULT" };

type SearchState =
  | { phase: "idle" }
  | { phase: "resolving"; query: string }
  | { phase: "ambiguous"; query: string; options: GeocodeResult[] }
  | { phase: "failed"; query: string; message: string; kind: string };

interface PlottedTarget extends MapTarget {
  id: string;
  /** How the position was arrived at, for the provenance readout. */
  method: "coordinate" | "gazetteer" | "handoff";
  /** Notation the analyst wrote it in, when it was typed as a coordinate. */
  format?: string;
  plottedAt: string;
  /** What is at this position, once the gazetteer has been asked. */
  place?: PlaceDescription;
  /**
   * Progress of the naming lookup.
   *
   * Separate from the position itself, which is always already resolved — a
   * failed lookup leaves a perfectly good fix that simply has no name yet.
   */
  placeStatus: "resolving" | "named" | "unnamed" | "failed";
}

export default function MapModule() {
  const consumePendingCoordinate = useAppStore((s) => s.consumePendingCoordinate);
  const addLog = useAppStore((s) => s.addLog);
  // The style spec bakes in palette colours, so the surface has to know when
  // the theme changes in order to rebuild.
  const theme = useAppStore((s) => s.theme);

  /**
   * Projection. Opens in volume: the tilted skyline is the module's signature
   * view, and the flat plan is there for when a street layout has to be read
   * precisely.
   */
  const [extruded, setExtruded] = useState(true);
  const [surface, setSurface] = useState<SurfaceStatus>("loading");

  /** Deployment sequence. Plays once per arrival at the module. */
  const [deploying, setDeploying] = useState(true);

  /*
    Stable identity for the overlay's completion callback.

    An inline arrow here is a new function on every render, which the overlay's
    effect treats as a changed dependency — it re-ran mid-sequence and played
    the opening sting a second time. Anything the overlay depends on has to be
    referentially stable.
  */
  const finishDeploy = useCallback(() => setDeploying(false), []);

  // Map ambience is owned by App, keyed on the current module — see the note
  // there on why component lifecycle was the wrong hook for it.

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ phase: "idle" });
  const [targets, setTargets] = useState<PlottedTarget[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  /** Live parse of whatever is in the box, so the field can show its read. */
  const [preview, setPreview] = useState<GeoCoordinate | null>(null);

  const active = targets.find((t) => t.id === activeId) ?? null;
  const view = active ?? DEFAULT_VIEW;

  /**
   * Marker set, labelled with the best available name for each fix.
   *
   * Memoised on the resolved names rather than on `targets` so the surface's
   * marker and label-suppression effects do not re-run on every unrelated
   * state change — they rebuild DOM markers and reset a style filter.
   */
  const markerPins = useMemo(
    () => targets.map((t) => ({ lat: t.lat, lon: t.lon, label: placeTitle(t), origin: t.origin })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targets.map((t) => `${t.id}:${placeTitle(t)}`).join("|")]
  );

  const plot = useCallback(
    (target: Omit<PlottedTarget, "id" | "plottedAt" | "placeStatus"> & { placeStatus?: PlottedTarget["placeStatus"] }) => {
      const entry: PlottedTarget = {
        placeStatus: target.place ? "named" : "resolving",
        ...target,
        id: Math.random().toString(36).slice(2, 9),
        plottedAt: new Date().toTimeString().split(" ")[0],
      };
      // Newest first, and a position already on the board is promoted rather
      // than duplicated — re-searching the same place should not stack pins.
      setTargets((prev) => [
        entry,
        ...prev.filter((t) => !(closeTo(t.lat, entry.lat) && closeTo(t.lon, entry.lon))),
      ]);
      setActiveId(entry.id);

      /*
        Name the position, if it did not arrive with a name.

        Deliberately fire-and-forget after the fix is already on the board: the
        coordinate resolved locally and the map has flown there. This only
        decorates it. A failure downgrades the label and nothing else, which is
        what keeps a typed coordinate usable with the gazetteer unreachable.
      */
      if (!entry.place) {
        void reverseGeocode(entry.lat, entry.lon)
          .then((place) => {
            setTargets((prev) =>
              prev.map((t) =>
                t.id === entry.id
                  ? { ...t, place: place ?? undefined, placeStatus: place ? "named" : "unnamed" }
                  : t
              )
            );
          })
          .catch(() => {
            setTargets((prev) =>
              prev.map((t) => (t.id === entry.id ? { ...t, placeStatus: "failed" } : t))
            );
          });
      }

      return entry;
    },
    []
  );

  /**
   * Pick up a position handed over by another module.
   *
   * Read-once, so navigating away and back does not re-fly to a stale target.
   */
  useEffect(() => {
    const pending = consumePendingCoordinate();
    if (!pending) return;
    plot({
      lat: pending.lat,
      lon: pending.lon,
      label: pending.label ?? "RELAYED MARKER",
      origin: pending.origin,
      method: "handoff",
    });
    playScanOpen();
  }, [consumePendingCoordinate, plot]);

  // Read the box as the analyst types so the field can confirm it recognises a
  // coordinate before they commit. Purely local — no lookup fires from this.
  useEffect(() => {
    setPreview(query.trim() ? parseCoordinate(query) : null);
  }, [query]);

  const submit = useCallback(async () => {
    const raw = query.trim();
    if (!raw) return;

    // Coordinates resolve locally and instantly; nothing leaves the machine.
    const coord = parseCoordinate(raw);
    if (coord) {
      plot({
        lat: coord.lat,
        lon: coord.lon,
        label: formatDecimal(coord, 4),
        method: "coordinate",
        format: coord.format.toUpperCase(),
      });
      addLog(`POSITION DECODED // ${formatDMS(coord)}`, "success", "CARTOGRAPHY");
      playSuccessChime();
      setSearch({ phase: "idle" });
      setQuery("");
      return;
    }

    // Otherwise it is a place name, which means an outbound lookup.
    setSearch({ phase: "resolving", query: raw });
    addLog(`GAZETTEER QUERY // "${raw.toUpperCase()}"`, "info", "CARTOGRAPHY");
    try {
      const results = await geocodePlace(raw);
      if (results.length === 0) {
        setSearch({
          phase: "failed",
          query: raw,
          message: "NO GAZETTEER RECORD FOR THIS DESIGNATION",
          kind: "empty",
        });
        addLog(`GAZETTEER MISS // "${raw.toUpperCase()}"`, "warning", "CARTOGRAPHY");
        return;
      }
      if (results.length === 1) {
        const hit = results[0];
        plot({
          lat: hit.lat,
          lon: hit.lon,
          label: hit.shortName,
          origin: hit.name,
          method: "gazetteer",
          place: hit.place,
        });
        addLog(`POSITION FIXED // ${hit.shortName.toUpperCase()}`, "success", "CARTOGRAPHY");
        playSuccessChime();
        setSearch({ phase: "idle" });
        setQuery("");
        return;
      }
      // Several candidates: the analyst chooses. Guessing the first hit would
      // silently plot the wrong continent for any ambiguous place name.
      setSearch({ phase: "ambiguous", query: raw, options: results });
      playScanOpen();
    } catch (err) {
      const message =
        err instanceof GeocodeError
          ? err.kind === "network"
            ? "GAZETTEER LINK DOWN // NO ROUTE TO HOST"
            : err.kind === "rate"
              ? "GAZETTEER THROTTLED // STAND BY"
              : err.message.toUpperCase()
          : "GAZETTEER FAULT";
      setSearch({ phase: "failed", query: raw, message, kind: "network" });
      addLog(`GAZETTEER FAULT // ${message}`, "warning", "CARTOGRAPHY");
    }
  }, [query, plot, addLog]);

  const chooseCandidate = (hit: GeocodeResult) => {
    plot({
      lat: hit.lat,
      lon: hit.lon,
      label: hit.shortName,
      origin: hit.name,
      method: "gazetteer",
      place: hit.place,
    });
    addLog(`POSITION FIXED // ${hit.shortName.toUpperCase()}`, "success", "CARTOGRAPHY");
    playSuccessChime();
    setSearch({ phase: "idle" });
    setQuery("");
  };

  return (
    <div
      className="h-full w-full p-4 grid grid-cols-12 grid-rows-[minmax(0,1fr)] content-start gap-4 overflow-hidden font-chakra select-none text-text-primary animate-fade-in"
      id="map-root"
    >
      {/* Deployment sequence. Covers the whole module, not just the viewport,
          so arriving reads as the console unfolding a plane rather than one
          panel loading. */}
      <AnimatePresence>
        {deploying && <MapBootOverlay onComplete={finishDeploy} />}
      </AnimatePresence>

      {/* ---------------------------------------------------------------- */}
      {/* RIGHT RAIL — plotting controls and the target register            */}
      {/* Placed by column, not by DOM order: the search box stays first in  */}
      {/* the document so it is the first thing keyboard focus reaches, which */}
      {/* is the right behaviour for the module's primary control.           */}
      {/* ---------------------------------------------------------------- */}
      <div className="col-span-3 col-start-10 row-start-1 flex flex-col gap-4 min-h-0">
        <GlassPanel className="p-4 flex flex-col gap-3 shrink-0" showScanlines>
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-cyan-primary" />
            <h1 className="font-display text-sm font-black tracking-widest text-cyan-text uppercase">
              Map
            </h1>
          </div>
          <p className="text-[13px] text-text-dim uppercase tracking-wider font-share leading-relaxed">
            Plot a position from a coordinate or a place designation.
          </p>

          <div className="relative">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                playTypeKey();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="40°42'46&quot;N 74°00'21&quot;W  //  CITY NAME"
              className="w-full bg-bg-void/60 border border-border-hairline/30 px-3 py-2.5 pr-9 font-share text-sm text-text-primary focus:outline-none focus:border-cyan-primary/50 transition-all placeholder:text-text-dim/30"
            />
            <button
              onClick={() => void submit()}
              onMouseEnter={playHoverBlip}
              aria-label="Plot position"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-cyan-primary hover:text-white transition-colors"
            >
              {search.phase === "resolving" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>

          {/*
            Confirm the read before commit. A coordinate that parses shows the
            notation it was recognised as, so a mistyped hemisphere is caught
            here rather than after the map has flown somewhere wrong.
          */}
          {preview ? (
            <div className="flex items-start gap-2 px-2 py-1.5 bg-cyan-primary/[0.06] border-l-2 border-cyan-primary/60">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-display text-[11px] font-black tracking-widest text-cyan-text uppercase">
                  {preview.format} FIX RECOGNISED
                </div>
                <div className="font-mono text-[12px] text-cyan-text/70 truncate">{formatDMS(preview)}</div>
              </div>
            </div>
          ) : query.trim() ? (
            <div className="px-2 py-1.5 border-l-2 border-border-hairline/30">
              <div className="font-display text-[11px] font-black tracking-widest text-text-dim uppercase">
                Reads as a designation
              </div>
              <div className="font-mono text-[12px] text-text-dim/60">Will query the gazetteer</div>
            </div>
          ) : null}

          {/* Failure is an in-fiction alert, not a form validation message. */}
          {search.phase === "failed" && (
            <div className="flex items-start gap-2 px-2 py-2 bg-amber-alert/[0.07] border-l-2 border-amber-alert">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-alert mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-display text-[11px] font-black tracking-widest text-amber-alert uppercase">
                  {search.message}
                </div>
                <button
                  onClick={() => void submit()}
                  className="font-mono text-[12px] text-amber-alert/70 hover:text-amber-alert underline underline-offset-2 mt-0.5"
                >
                  RETRY QUERY
                </button>
              </div>
            </div>
          )}
        </GlassPanel>

        {/* Ambiguous gazetteer hits — the analyst disambiguates. */}
        {search.phase === "ambiguous" && (
          <GlassPanel className="p-3 flex flex-col gap-2 shrink-0">
            <div className="font-display text-[11px] font-black tracking-widest text-amber-alert uppercase">
              {search.options.length} candidates — select fix
            </div>
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto scrollbar-hud">
              {search.options.map((hit, i) => (
                <button
                  key={`${hit.lat}-${hit.lon}-${i}`}
                  onClick={() => chooseCandidate(hit)}
                  onMouseEnter={playHoverBlip}
                  className="text-left px-2 py-1.5 bg-bg-void/40 border border-border-hairline/20 hover:border-cyan-primary/50 hover:bg-cyan-primary/[0.05] transition-all group"
                >
                  <div className="font-display text-[12px] font-bold tracking-wider text-cyan-text uppercase truncate group-hover:text-white">
                    {hit.shortName}
                  </div>
                  <div className="font-mono text-[11px] text-text-dim truncate">{hit.name}</div>
                  <div className="font-mono text-[11px] text-cyan-text/50">
                    {formatDecimal(hit, 4)} · {hit.kind}
                  </div>
                </button>
              ))}
            </div>
          </GlassPanel>
        )}

        {/*
          Register and survey split the remaining rail height exactly in half.

          Two `flex-1` siblings do NOT reliably produce halves here — free-space
          distribution left them 184/158, because the register's content still
          influences the share even with `min-h-0`. An explicit two-row grid
          sizes both rows at `1fr` regardless of what is inside them, which is
          what "half each" actually requires.
        */}
        <div className="flex-1 min-h-0 grid grid-rows-2 gap-4">
        <GlassPanel className="p-3 flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <span className="font-display text-[11px] font-black tracking-widest text-cyan-text uppercase">
              Target register
            </span>
            <span className="font-mono text-[11px] text-text-dim">{targets.length}</span>
          </div>

          {targets.length === 0 ? (
            // Empty state with a job to do: it states the privacy guarantee,
            // which is the one thing an analyst would otherwise have to take
            // on trust.
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-2">
              <Compass className="w-7 h-7 text-cyan-primary/25 animate-breathing" />
              <p className="font-share text-[12px] text-text-dim uppercase tracking-widest">
                No positions plotted
              </p>
              <p className="font-mono text-[11px] text-text-dim/50 leading-relaxed">
                This station never requests your location. It plots only what you enter or relay to it.
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hud flex flex-col gap-1">
              {targets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveId(t.id);
                    playPinClick();
                  }}
                  onMouseEnter={playHoverBlip}
                  className={`text-left px-2 py-1.5 border transition-all group ${
                    t.id === activeId
                      ? "bg-cyan-primary/[0.08] border-cyan-primary/50"
                      : "bg-bg-void/40 border-border-hairline/20 hover:border-cyan-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <MapPin
                      className={`w-3 h-3 shrink-0 ${
                        t.id === activeId ? "text-cyan-primary" : "text-text-dim"
                      }`}
                    />
                    <span className="font-display text-[12px] font-bold tracking-wider text-cyan-text uppercase truncate">
                      {placeTitle(t)}
                    </span>
                  </div>
                  {/* Region and country under the settlement, so a fix reads as
                      a place before it reads as a number. */}
                  {t.place && (regionOf(t.place) || t.place.country) && (
                    <div className="font-share text-[11px] text-cyan-text/50 pl-4.5 truncate">
                      {[regionOf(t.place), t.place.country].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  <div className="font-mono text-[11px] text-text-dim/70 pl-4.5 truncate">
                    {formatDecimal(t, 4)}
                    {t.placeStatus === "resolving" && (
                      <span className="text-cyan-text/40"> · naming…</span>
                    )}
                    {t.placeStatus === "unnamed" && (
                      <span className="text-text-dim/40"> · unmapped</span>
                    )}
                    {t.placeStatus === "failed" && (
                      <span className="text-amber-alert/60"> · name unavailable</span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-cyan-text/40 pl-4.5 uppercase tracking-wider">
                    {t.method === "coordinate"
                      ? `${t.format} · ${t.plottedAt}`
                      : t.method === "handoff"
                        ? `RELAY${t.origin ? ` · ${t.origin}` : ""} · ${t.plottedAt}`
                        : `GAZETTEER · ${t.plottedAt}`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {targets.length > 0 && (
            <button
              onClick={() => {
                setTargets([]);
                setActiveId(null);
                playPinClick();
              }}
              onMouseEnter={playHoverBlip}
              className="shrink-0 flex items-center justify-center gap-1.5 py-1.5 border border-border-hairline/20 text-text-dim hover:text-red-threat hover:border-red-threat/40 transition-all font-display text-[11px] font-bold tracking-widest uppercase"
            >
              <Trash2 className="w-3 h-3" />
              Clear register
            </button>
          )}
        </GlassPanel>

        {/*
          Ambient structural survey.

          Fills the half the register gave up. Labelled as ambient on purpose:
          it sits directly beneath a panel of real coordinates, so it has to be
          unmistakably decorative rather than look like a second readout.
        */}
        <GlassPanel className="min-h-0 relative overflow-hidden" showScanlines>
          <div className="absolute inset-0">
            <RadarScanner />
          </div>
          <div className="absolute top-2 left-3 z-10 pointer-events-none">
            <span className="font-display text-[11px] font-black tracking-widest text-cyan-text/70 uppercase">
              Sector sweep
            </span>
            <span className="block font-mono text-[10px] text-text-dim/40 uppercase tracking-wider">
              Ambient · non-instrumented
            </span>
          </div>
        </GlassPanel>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* VIEWPORT — the map surface and its HUD chrome                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="col-span-9 col-start-1 row-start-1 min-h-0">
        <GlassPanel className="w-full h-full relative overflow-hidden" showScanlines glow>
          <React.Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="font-display text-[12px] font-black tracking-[0.3em] text-cyan-text/70 uppercase animate-hex-pulse-flicker">
                  Loading cartography engine
                </div>
              </div>
            }
          >
            <MapSurface
              target={active}
              /*
                Pins carry the resolved place name, not the raw plot label — so
                a typed coordinate reads "NEW YORK" on the map rather than
                repeating its own numbers, and the name matches what the
                basemap would have drawn, which is what lets the surface
                suppress the duplicate underneath it.
              */
              markers={markerPins}
              extruded={extruded}
              themeKey={theme}
              onStatusChange={setSurface}
            />
          </React.Suspense>

          {/* Vignette. Pulls the eye off the frame edges and sits the tiles
              inside the console rather than flush against it. Never intercepts
              pointer events — the map beneath has to stay draggable. */}
          <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--color-bg-void)_115%)] opacity-80" />

          {/* Projection switch */}
          <div className="absolute top-3 left-3 z-20 flex">
            {([
              ["PLAN", false],
              ["VOLUME", true],
            ] as const).map(([label, mode]) => (
              <button
                key={label}
                onClick={() => {
                  setExtruded(mode);
                  playPinClick();
                }}
                onMouseEnter={playHoverBlip}
                disabled={surface !== "ready"}
                className={`hud-target px-3 py-1.5 font-display text-[11px] font-black tracking-widest uppercase border transition-all disabled:opacity-30 disabled:pointer-events-none ${
                  extruded === mode
                    ? "bg-cyan-primary text-bg-void border-cyan-primary"
                    : "bg-bg-void/70 text-cyan-text/60 border-border-hairline/30 hover:border-cyan-primary/50 hover:text-cyan-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* The compass is rendered by MapSurface: it has to read live bearing
              and drive rotation, both of which need the map instance. */}

          {/* Position readout — bottom right, as on a tactical map. Leads with
              the place, because "where am I looking" is answered by a name far
              faster than by six decimal places. */}
          <div className="absolute bottom-3 right-3 text-right z-20 pointer-events-none max-w-[45%]">
            <div className="font-display text-[13px] font-black tracking-[0.18em] text-cyan-text uppercase truncate">
              {active ? placeTitle(active) : DEFAULT_VIEW.label}
            </div>
            {active?.place && (regionOf(active.place) || active.place.country) && (
              <div className="font-share text-[11px] text-cyan-text/55 truncate">
                {[regionOf(active.place), active.place.country].filter(Boolean).join(" · ")}
              </div>
            )}
            <div className="font-mono text-[12px] text-cyan-text/70 tracking-wider mt-0.5">
              {formatDecimal(view, 4)}
            </div>
            {active?.placeStatus === "resolving" && (
              <div className="font-mono text-[10px] text-cyan-text/35 uppercase tracking-widest">
                Naming position…
              </div>
            )}
          </div>

          {/* Attribution. Required by both upstream services, so it is part of
              the chrome rather than something to be tucked away. */}
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
            <div className="font-mono text-[10px] text-text-dim/40 uppercase tracking-wider leading-tight">
              {TILE_ATTRIBUTION}
              <br />
              {GEOCODER_ATTRIBUTION}
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

/** Two fixes within ~11m of each other are the same place for register purposes. */
function closeTo(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

/**
 * Best available name for a fix.
 *
 * Falls back through settlement → region → country → whatever label it was
 * plotted with, so there is always something to read. A coordinate typed into
 * open ocean legitimately has no name and keeps its numbers.
 */
function placeTitle(t: PlottedTarget): string {
  const p = t.place;
  const name = p?.locality ?? p?.region ?? p?.country;
  // Administrative boilerplate ("City of …") is noise on a pin, and stripping
  // it is also what lets the surface recognise the basemap's own label as the
  // same place.
  return name ? tidyPlaceName(name) : t.label ?? "UNNAMED FIX";
}

/** Region, suppressed when it merely repeats the settlement name. */
function regionOf(p: PlaceDescription): string | undefined {
  if (!p.region) return undefined;
  return p.region === p.locality ? undefined : p.region;
}
