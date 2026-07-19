import type { StyleSpecification } from "maplibre-gl";
import { themeColor, themeRgba } from "./../themeColors";

/**
 * The tactical basemap style.
 *
 * Built as a style spec rather than pulling a ready-made one, because the whole
 * point is the cartography reading as Batcomputer surveillance: near-black
 * ground, buildings as translucent masses, roads as the brightest thing on
 * screen. A stock dark style still looks like a street map that has been turned
 * down — the difference is which layers are allowed to carry light.
 *
 * Colours come from the live theme rather than being hardcoded, so the map
 * follows the palette like everything else. That does mean the style has to be
 * rebuilt when the theme changes; `MapSurface` handles that.
 *
 * Vector tiles: OpenFreeMap (OpenMapTiles schema), free and keyless.
 * Attribution to OSM is required and is rendered as part of the HUD chrome.
 */

/** Tile source. Free, no key, no account. */
const TILE_SOURCE = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/**
 * Label face.
 *
 * The app's display face is not available as glyph PBFs, and self-hosting a
 * converted Orbitron set is a bigger job than it is worth for the handful of
 * place names the map shows. Noto Sans uppercased with wide tracking reads
 * close enough at label size, and road/POI labels stay off entirely — the
 * reference material carries almost no cartographic text, so suppressing it is
 * both truer to the look and sidesteps the mismatch.
 */
const LABEL_FONT = ["Noto Sans Regular"];

/**
 * Which place features earn a label.
 *
 * Exported so the surface can rebuild the layer's filter without restating the
 * class list — it composes this with a duplicate-name exclusion when a marker
 * is already naming the same place on screen.
 */
export const PLACE_LABEL_CLASSES = [
  "match",
  ["get", "class"],
  ["city", "town", "country", "state"],
  true,
  false,
] as const;

/** The name a place feature is labelled with, lowercased for comparison. */
export const PLACE_LABEL_NAME = [
  "downcase",
  ["coalesce", ["get", "name:latin"], ["get", "name"], ""],
] as const;

export interface MapStyleOptions {
  /** Draw buildings as extruded volumes rather than flat footprints. */
  extruded: boolean;
}

export function buildMapStyle({ extruded }: MapStyleOptions): StyleSpecification {
  const void_ = themeColor("--color-bg-void", "#020912");
  const text = themeColor("--color-cyan-text", "#c8f4f9");

  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      openmaptiles: { type: "vector", url: TILE_SOURCE },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": void_ },
      },

      // Ground cover reads as barely-there tonal variation. Enough to keep the
      // frame from being a flat black field, never enough to compete.
      {
        id: "landcover",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        paint: { "fill-color": themeRgba("--rgb-primary", 0.05) },
      },
      {
        id: "park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: { "fill-color": themeRgba("--rgb-primary", 0.06) },
      },

      // Water sits darker than the land so coastlines and rivers read as
      // negative space — the way they do on the reference.
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "fill-color": themeRgba("--rgb-blue-pale", 0.13) },
      },
      {
        id: "waterway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        paint: {
          "line-color": themeRgba("--rgb-blue-pale", 0.22),
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 16, 2],
        },
      },

      // Roads are drawn casing-first so each ribbon gets a dark edge and reads
      // as a lit channel rather than a bright scratch on the ground.
      {
        id: "road-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": void_,
          "line-width": [
            "interpolate", ["exponential", 1.5], ["zoom"],
            6, 1.6, 10, 4, 14, 9, 18, 26,
          ],
        },
      },
      {
        id: "road-minor",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "minor", "service"],
        minzoom: 12,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": themeRgba("--rgb-primary", 0.3),
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.4, 16, 1.6, 20, 6],
        },
      },
      {
        id: "road-mid",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "primary", "secondary", "tertiary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": themeRgba("--rgb-primary", 0.6),
          "line-width": [
            "interpolate", ["exponential", 1.5], ["zoom"],
            8, 0.6, 12, 1.8, 16, 5, 20, 16,
          ],
        },
      },
      {
        id: "road-major",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": themeRgba("--rgb-accent", 0.72),
          "line-width": [
            "interpolate", ["exponential", 1.5], ["zoom"],
            6, 0.8, 10, 2.4, 14, 6, 18, 20,
          ],
        },
      },

      // Building footprints, flat. Hidden when the volumes are drawn instead,
      // so the two never stack into a double-strength mass.
      {
        id: "building-flat",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        layout: { visibility: extruded ? "none" : "visible" },
        paint: {
          "fill-color": themeRgba("--rgb-primary", 0.14),
          "fill-outline-color": themeRgba("--rgb-accent", 0.28),
        },
      },

      // The volumes. `render_height` is the OpenMapTiles-derived height, which
      // is why real skylines come out with real massing rather than a uniform
      // slab field. Buildings flagged `hide_3d` are excluded upstream as bad
      // geometry for extrusion.
      {
        id: "building-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        filter: ["!=", ["get", "hide_3d"], true],
        layout: { visibility: extruded ? "visible" : "none" },
        paint: {
          // Taller structures read brighter, so a skyline has depth instead of
          // being one flat wash of cyan.
          "fill-extrusion-color": [
            "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 5],
            0, themeRgba("--rgb-primary", 0.9),
            60, themeRgba("--rgb-accent", 0.95),
            200, "#ffffff",
          ],
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 5],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          // Translucent so the grid and roads stay legible through the massing —
          // the holographic quality depends on the volumes not being solid.
          "fill-extrusion-opacity": 0.35,
        },
      },

      {
        id: "boundary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 4],
        paint: {
          "line-color": themeRgba("--rgb-accent", 0.3),
          "line-dasharray": [3, 2],
          "line-width": 0.8,
        },
      },

      // Place names only, and only the ones that matter for orientation. Road
      // and POI labels stay off — the reference carries almost no map text.
      {
        id: "place-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        // Modern expression syntax rather than the legacy `["in", "class", …]`
        // form, so `MapSurface` can compose it with a duplicate-name exclusion
        // — the two syntaxes cannot be mixed inside one `all`.
        filter: PLACE_LABEL_CLASSES,
        layout: {
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
          "text-font": LABEL_FONT,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.22,
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9, 10, 13, 16, 16],
          "text-max-width": 8,
        },
        paint: {
          "text-color": text,
          "text-opacity": 0.65,
          "text-halo-color": void_,
          "text-halo-width": 1.6,
        },
      },
    ],
  } as StyleSpecification;
}

/** Attribution required by the tile provider and OSM's licence. */
export const TILE_ATTRIBUTION = "OpenFreeMap © OpenMapTiles · Data © OpenStreetMap";
