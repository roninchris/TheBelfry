/**
 * Place-name lookup against OpenStreetMap's Nominatim.
 *
 * The only part of the map that talks to the network besides tiles, and the
 * only part that leaves the machine at all. It sends the words the analyst
 * typed and nothing else — no identifiers, no position, no session. Coordinate
 * input never comes through here; that is parsed locally by `coordinates.ts`,
 * so the common ARG case of "here is a lat/long" stays entirely offline.
 *
 * The public instance is free and keyless, in exchange for two hard rules from
 * its usage policy that shape this file:
 *
 *   1. At most one request per second. Enforced below by serialising every
 *      lookup through a shared gate rather than trusting call sites.
 *   2. No client-side autocomplete. So this is deliberately not wired to
 *      keystrokes — the module fires it on submit only.
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */

export interface GeocodeResult {
  lat: number;
  lon: number;
  /** Full display name from OSM, e.g. "Gotham, New Jersey, United States". */
  name: string;
  /** Short leading component, for a marker label. */
  shortName: string;
  /** OSM's own classification, e.g. "city", "building". */
  kind: string;
  /** Suggested view box: [south, north, west, east]. */
  bounds?: [number, number, number, number];
  /** Structured description, so a search hit needs no second lookup to name. */
  place: PlaceDescription;
}

export class GeocodeError extends Error {
  constructor(message: string, readonly kind: "network" | "empty" | "rate" | "bad-response") {
    super(message);
    this.name = "GeocodeError";
  }
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

/** Minimum spacing between outbound requests, per the usage policy. */
const MIN_INTERVAL_MS = 1100;

/**
 * Tail of the request queue.
 *
 * Every lookup chains onto this promise, so two searches fired in quick
 * succession are spaced out instead of racing. Rate limiting lives here rather
 * than in the component because the policy applies to the application as a
 * whole — a second caller added later would otherwise silently breach it.
 */
let gate: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function throttle(): Promise<void> {
  const wait = gate.then(async () => {
    const since = Date.now() - lastRequestAt;
    if (since < MIN_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - since));
    }
    lastRequestAt = Date.now();
  });
  // Keep the chain alive even if one caller rejects, or the gate deadlocks.
  gate = wait.catch(() => undefined);
  return wait;
}

/**
 * Resolves a place name to candidate positions, best match first.
 *
 * Returns at most `limit` results. Throws `GeocodeError` rather than returning
 * an empty array on failure, so the caller can tell "no such place" apart from
 * "the lookup never happened" — they need different states on screen.
 */
export async function geocodePlace(query: string, limit = 5): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) throw new GeocodeError("Empty query", "empty");

  await throttle();

  // Address details come back in the same response, so a hit chosen from the
  // candidate list is already named and never needs a reverse lookup.
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&format=jsonv2&limit=${limit}&addressdetails=1`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      // No credentials, ever: this is a third-party service and has no business
      // receiving cookies from this origin.
      credentials: "omit",
    });
  } catch {
    throw new GeocodeError("Gazetteer unreachable", "network");
  }

  if (response.status === 429) {
    throw new GeocodeError("Gazetteer rate limit reached", "rate");
  }
  if (!response.ok) {
    throw new GeocodeError(`Gazetteer returned ${response.status}`, "bad-response");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GeocodeError("Malformed gazetteer response", "bad-response");
  }
  if (!Array.isArray(payload)) {
    throw new GeocodeError("Malformed gazetteer response", "bad-response");
  }

  const results: GeocodeResult[] = [];
  for (const row of payload as Record<string, unknown>[]) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const name = typeof row.display_name === "string" ? row.display_name : q;
    const box = Array.isArray(row.boundingbox) ? row.boundingbox.map(Number) : null;

    results.push({
      lat,
      lon,
      name,
      shortName: name.split(",")[0].trim(),
      kind: typeof row.type === "string" ? row.type : "place",
      bounds:
        box && box.length === 4 && box.every(Number.isFinite)
          ? [box[0], box[1], box[2], box[3]]
          : undefined,
      place: describeAddress((row.address ?? {}) as Record<string, string>, name, {
        name: row.name,
        category: row.category ?? row.class,
        type: row.type,
      }),
    });
  }

  return results;
}

/** Structured place description for a position. */
export interface PlaceDescription {
  /** Named feature at the point: a business, institution or landmark, when one exists. */
  poi?: string;
  /** Human-readable category of that feature, e.g. "Restaurant", "Supermarket". */
  poiKind?: string;
  /** Settlement: city, town, village or suburb, whichever OSM has. */
  locality?: string;
  /** State, province or county. */
  region?: string;
  country?: string;
  /** Full comma-separated description, as OSM writes it. */
  full: string;
}

/**
 * Feature classes that count as a "point of interest" — a named thing at a
 * spot, as opposed to the administrative geography around it. Only these get
 * promoted to `poi`, so a plain city coordinate does not turn its own name into
 * a bogus business.
 */
const POI_CATEGORIES = new Set([
  "amenity", "shop", "tourism", "leisure", "historic", "office", "building",
  "man_made", "craft", "healthcare", "aeroway", "railway", "aerialway",
  "emergency", "club", "military",
]);

/** "fast_food" -> "Fast Food"; falls back to the category when type is generic. */
function humanizeKind(category?: string, type?: string): string | undefined {
  const raw = type && type !== "yes" ? type : category;
  if (!raw) return undefined;
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** A named feature carried on a Nominatim row/response, if it is a real POI. */
interface FeatureHint {
  name?: unknown;
  category?: unknown;
  type?: unknown;
}

const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

/**
 * Names the place at a position.
 *
 * Enrichment, never a dependency: a coordinate is already fully resolved by
 * the local parser before this is called, so a failure here costs a label and
 * nothing else. Callers plot first and name second, which keeps the offline
 * guarantee on coordinate input — the fix lands instantly whether or not the
 * gazetteer answers.
 *
 * Returns null when the position has no record (mid-ocean, Antarctica, gaps in
 * OSM coverage) rather than throwing, because "nowhere" is a legitimate answer
 * to "what is here" and reads differently from a failed lookup.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<PlaceDescription | null> {
  await throttle();

  // zoom=18 asks Nominatim for building/POI-level detail rather than the
  // suburb-level answer zoom=14 gave — this is what lets a close-in coordinate
  // come back named after the specific premises at that spot (a shop, a
  // landmark, a named house) instead of just the neighbourhood.
  const url =
    `${REVERSE_ENDPOINT}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` +
    `&format=jsonv2&addressdetails=1&zoom=18`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "omit" });
  } catch {
    throw new GeocodeError("Gazetteer unreachable", "network");
  }

  if (response.status === 429) throw new GeocodeError("Gazetteer rate limit reached", "rate");
  if (!response.ok) throw new GeocodeError(`Gazetteer returned ${response.status}`, "bad-response");

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new GeocodeError("Malformed gazetteer response", "bad-response");
  }

  // Open water and unmapped areas come back as an error object, not a record.
  if (!payload || typeof payload.display_name !== "string") return null;

  return describeAddress((payload.address ?? {}) as Record<string, string>, payload.display_name, {
    name: payload.name,
    category: payload.category ?? (payload as Record<string, unknown>).class,
    type: payload.type,
  });
}

/**
 * Folds an OSM address object into the three levels worth showing.
 *
 * OSM has no single "city" key — a settlement is tagged by its size, so the
 * candidates are tried in descending order of prominence. When the object is
 * missing entirely (some records carry only a display name), the trailing
 * comma-separated components stand in: OSM writes them coarsest-last, so the
 * final segment is reliably the country.
 */
function describeAddress(
  address: Record<string, string>,
  full: string,
  feature?: FeatureHint,
): PlaceDescription {
  const locality =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.suburb ??
    address.hamlet;

  const region = address.state ?? address.province ?? address.county;
  const country = address.country;

  // A named feature is only surfaced as a POI when its class is one of the
  // point-of-interest categories — this keeps a city's own name (category
  // "place") or an administrative boundary from masquerading as a business.
  let poi: string | undefined;
  let poiKind: string | undefined;
  if (feature) {
    const category = typeof feature.category === "string" ? feature.category : undefined;
    const type = typeof feature.type === "string" ? feature.type : undefined;
    const name = typeof feature.name === "string" ? feature.name.trim() : "";
    if (name && category && POI_CATEGORIES.has(category)) {
      poi = name;
      poiKind = humanizeKind(category, type);
    }
  }

  if (poi || locality || region || country) {
    return { poi, poiKind, locality, region, country, full };
  }

  const parts = full.split(",").map((p) => p.trim()).filter(Boolean);
  return {
    poi,
    poiKind,
    locality: parts.length > 1 ? parts[0] : undefined,
    region: parts.length > 2 ? parts[parts.length - 2] : undefined,
    country: parts.length > 1 ? parts[parts.length - 1] : undefined,
    full,
  };
}

/**
 * Trims administrative boilerplate off a place name.
 *
 * Nominatim returns the legal designation — "City of White Plains", "Town of
 * Babylon" — while the vector tiles label the same feature "White Plains". The
 * verbose form is both wrong for a HUD pin and the reason a naive equality
 * check fails to spot that the two labels are the same place.
 */
export function tidyPlaceName(name: string): string {
  return name
    .replace(/^(city|town|village|borough|municipality|township|county)\s+of\s+/i, "")
    .replace(/\s+(city|municipality)$/i, "")
    .trim();
}

/** Attribution required by the Nominatim usage policy wherever results show. */
export const GEOCODER_ATTRIBUTION = "Gazetteer: OpenStreetMap / Nominatim";
