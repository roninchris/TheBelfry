/**
 * Coordinate recognition for free text.
 *
 * ARG material hands you a position in whatever notation the author felt like
 * using — a clean decimal pair, a transcribed DMS string with degree symbols,
 * or degrees-decimal-minutes lifted off a nautical chart. This module reads all
 * three out of surrounding prose, so a coordinate buried in an evidence note is
 * found without the analyst having to isolate it first.
 *
 * Everything here is pure and offline. Turning a *place name* into a position
 * needs a network geocoder; turning a written position into numbers does not,
 * and keeping that distinction sharp means the common case never leaves the
 * machine.
 */

/** Which notation a coordinate was written in. */
export type CoordinateFormat = "decimal" | "dms" | "ddm";

/**
 * A position another module has asked the map to open on.
 *
 * `label` and `origin` exist so the map can say where the position came from
 * rather than dropping an anonymous pin — an analyst arriving from an evidence
 * note should see which note sent them.
 */
export interface MapTarget {
  lat: number;
  lon: number;
  /** Human-readable name for the marker, e.g. the note's title. */
  label?: string;
  /** Which module handed this over, for the map's provenance readout. */
  origin?: string;
}

export interface GeoCoordinate {
  lat: number;
  lon: number;
  format: CoordinateFormat;
  /** The exact substring this was read from. */
  raw: string;
  /** Where `raw` starts in the scanned text. */
  index: number;
  /**
   * 0..1 — how sure we are this is a position at all.
   *
   * Notation carries its own evidence. `51°30'26"N 0°7'39"W` cannot plausibly
   * be anything else, but `12, 45` is two small integers and far more likely to
   * be a date, a score or a byte offset than a point in the Gulf of Guinea. The
   * score lets callers set their own bar: the map accepts anything the analyst
   * typed deliberately, while passive scanning of note text demands much more.
   */
  confidence: number;
}

/** Hemisphere letters, lowercased, to their axis and sign. */
const HEMISPHERES: Record<string, { axis: "lat" | "lon"; sign: number }> = {
  n: { axis: "lat", sign: 1 },
  s: { axis: "lat", sign: -1 },
  e: { axis: "lon", sign: 1 },
  w: { axis: "lon", sign: -1 },
};

/**
 * One half of a position — a single axis value, before we know which axis.
 *
 * Parsing happens in two passes: find every individual degree value in the
 * text, then pair adjacent ones into positions. That way `40.7128 N, 74.0060 W`
 * and `40.7128, -74.0060` go down the same path after the first pass, and a
 * lone value with no partner is discarded rather than half-read.
 */
interface Component {
  value: number;
  axis: "lat" | "lon" | null; // null = no hemisphere letter, infer from order
  format: CoordinateFormat;
  start: number;
  end: number;
  /** True when the notation itself proves this is a coordinate. */
  unambiguous: boolean;
}

/**
 * Degrees / minutes / seconds, e.g. `51°30'26"N` or `51 30 26 N`.
 *
 * The seconds mark is optional because transcriptions routinely drop it, but a
 * hemisphere letter is not — without one, three bare numbers separated by
 * spaces are far too common in ordinary text to claim.
 */
const DMS_RE =
  /(\d{1,3})\s*[°d:]\s*(\d{1,2})\s*['′m:]\s*(\d{1,2}(?:\.\d+)?)\s*["″s]?\s*([NSEWnsew])|(\d{1,3})\s+(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*([NSEWnsew])/g;

/** Degrees and decimal minutes, e.g. `51°30.433'N`. */
const DDM_RE = /(\d{1,3})\s*[°d:]\s*(\d{1,2}(?:\.\d+)?)\s*['′m]\s*([NSEWnsew])/g;

/** Decimal degrees carrying a hemisphere letter, e.g. `51.5074°N` or `N51.5074`. */
const DECIMAL_HEMI_RE =
  /([NSEWnsew])\s*(\d{1,3}(?:\.\d+)?)\s*°?|(\d{1,3}(?:\.\d+)?)\s*°?\s*([NSEWnsew])/g;

/**
 * A bare signed decimal pair, e.g. `51.5074, -0.1278`.
 *
 * Requires a decimal point on both halves. Integer pairs are excluded on
 * purpose — `10, 20` appears constantly in ordinary text and admitting it would
 * make passive scanning useless.
 */
const DECIMAL_PAIR_RE =
  /([+-]?\d{1,3}\.\d+)\s*[,;/|]\s*([+-]?\d{1,3}\.\d+)|([+-]?\d{1,3}\.\d+)\s+([+-]?\d{1,3}\.\d+)/g;

const inLatRange = (v: number) => v >= -90 && v <= 90;
const inLonRange = (v: number) => v >= -180 && v <= 180;

/** Collects every individual degree value in `text`, in reading order. */
function findComponents(text: string): Component[] {
  const found: Component[] = [];

  const claim = (start: number, end: number) =>
    found.some((c) => start < c.end && end > c.start);

  // Most specific notation first: DMS before DDM before plain decimal, so
  // `51°30'26"N` is read whole rather than as a decimal 51 followed by junk.
  for (const m of text.matchAll(DMS_RE)) {
    const [deg, min, sec, hemi] = m[1] !== undefined
      ? [m[1], m[2], m[3], m[4]]
      : [m[5], m[6], m[7], m[8]];
    const minutes = Number(min);
    const seconds = Number(sec);
    // Sexagesimal: anything at or past 60 means this was never a DMS reading.
    if (minutes >= 60 || seconds >= 60) continue;
    const h = HEMISPHERES[hemi.toLowerCase()];
    const value = h.sign * (Number(deg) + minutes / 60 + seconds / 3600);
    found.push({
      value,
      axis: h.axis,
      format: "dms",
      start: m.index,
      end: m.index + m[0].length,
      unambiguous: true,
    });
  }

  for (const m of text.matchAll(DDM_RE)) {
    if (claim(m.index, m.index + m[0].length)) continue;
    const minutes = Number(m[2]);
    if (minutes >= 60) continue;
    const h = HEMISPHERES[m[3].toLowerCase()];
    found.push({
      value: h.sign * (Number(m[1]) + minutes / 60),
      axis: h.axis,
      format: "ddm",
      start: m.index,
      end: m.index + m[0].length,
      unambiguous: true,
    });
  }

  for (const m of text.matchAll(DECIMAL_HEMI_RE)) {
    if (claim(m.index, m.index + m[0].length)) continue;
    const [hemi, num] = m[1] !== undefined ? [m[1], m[2]] : [m[4], m[3]];
    const h = HEMISPHERES[hemi.toLowerCase()];
    found.push({
      value: h.sign * Number(num),
      axis: h.axis,
      format: "decimal",
      start: m.index,
      end: m.index + m[0].length,
      unambiguous: true,
    });
  }

  for (const m of text.matchAll(DECIMAL_PAIR_RE)) {
    if (claim(m.index, m.index + m[0].length)) continue;
    const [a, b] = m[1] !== undefined ? [m[1], m[2]] : [m[3], m[4]];
    // Whitespace-separated pairs are much weaker evidence than comma-separated
    // ones, but both are recorded; the pairing pass scores them differently.
    const offset = m[0].indexOf(a);
    found.push({
      value: Number(a),
      axis: null,
      format: "decimal",
      start: m.index + offset,
      end: m.index + offset + a.length,
      unambiguous: false,
    });
    const bOffset = m[0].lastIndexOf(b);
    found.push({
      value: Number(b),
      axis: null,
      format: "decimal",
      start: m.index + bOffset,
      end: m.index + bOffset + b.length,
      unambiguous: false,
    });
  }

  return found.sort((a, b) => a.start - b.start);
}

/**
 * How much text may sit between the two halves of one position.
 *
 * Wide enough for `40.7128 degrees north, 74.0060 degrees west`, tight enough
 * that two unrelated numbers in different sentences are never married together.
 */
const MAX_PAIR_GAP = 24;

/** Reads every coordinate in `text`, strongest first. */
export function findCoordinates(text: string): GeoCoordinate[] {
  const components = findComponents(text);
  const results: GeoCoordinate[] = [];

  for (let i = 0; i < components.length - 1; i++) {
    const a = components[i];
    const b = components[i + 1];

    const between = text.slice(a.end, b.start);
    if (between.length > MAX_PAIR_GAP) continue;
    // A sentence boundary between the halves means they belong to different
    // statements, however close together they happen to sit.
    if (/[.!?]\s/.test(between) || /\n\s*\n/.test(between)) continue;

    // Two values on the same axis are not a position — `40N 51N` is a range or
    // a list, not a point.
    if (a.axis && b.axis && a.axis === b.axis) continue;

    let lat: number;
    let lon: number;
    if (a.axis === "lon" || b.axis === "lat") {
      // Written longitude-first, which is legal and does happen.
      lat = b.value;
      lon = a.value;
    } else {
      lat = a.value;
      lon = b.value;
    }

    if (!inLatRange(lat) || !inLonRange(lon)) continue;

    // Confidence is driven by how much the notation itself commits to being a
    // coordinate, then adjusted for the weaker signals.
    let confidence: number;
    if (a.unambiguous && b.unambiguous) {
      confidence = 0.97;
    } else if (a.unambiguous || b.unambiguous) {
      confidence = 0.8;
    } else {
      // Bare decimals. A comma between them is the conventional separator and
      // reads as deliberate; whitespace alone is much weaker.
      confidence = /[,;/|]/.test(between) ? 0.62 : 0.4;
      // Values only a coordinate would plausibly carry.
      //
      // Precision is the strongest signal available on a bare pair. Six decimal
      // places is roughly 10cm on the ground — ordinary prose numbers (versions,
      // prices, measurements, percentages) essentially never carry it, so a
      // high-precision pair is worth enough on its own to clear the passive bar
      // even when written with only a space between the halves.
      const places = Math.min(countDecimals(a.value), countDecimals(b.value));
      if (places >= 5) confidence += 0.35;
      else if (places >= 4) confidence += 0.15;
      // A longitude outside latitude range proves the pair is not, say, two
      // percentages that happen to sit next to each other.
      if (Math.abs(lon) > 90) confidence += 0.1;
    }

    results.push({
      lat,
      lon,
      format: a.unambiguous ? a.format : b.format,
      raw: text.slice(a.start, b.end),
      index: a.start,
      confidence: Math.min(1, confidence),
    });

    // A component belongs to exactly one position, so skip past the partner.
    i++;
  }

  return results.sort((x, y) => y.confidence - x.confidence);
}

function countDecimals(v: number): number {
  const s = String(v);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Reads a string the analyst typed as a coordinate, or null.
 *
 * Deliberate input, so the bar is lower than passive scanning: if the whole
 * string is essentially one coordinate we take it, because someone typing into
 * a field marked "coordinates" has already told us what they meant.
 */
export function parseCoordinate(input: string): GeoCoordinate | null {
  const text = input.trim();
  if (!text) return null;

  const found = findCoordinates(text);
  if (found.length === 0) return null;

  const best = found[0];
  // Typed directly and covering most of the input is itself strong evidence.
  const coverage = best.raw.length / text.length;
  if (coverage > 0.8 && best.confidence >= 0.4) {
    return { ...best, confidence: Math.max(best.confidence, 0.9) };
  }
  return best.confidence >= 0.6 ? best : null;
}

/**
 * Passive scan for coordinates worth surfacing unprompted.
 *
 * Used where nobody asked for coordinate detection — note text, dashboard
 * input — so the bar is high. A false positive here interrupts the analyst
 * with a wrong answer, which costs more than silently missing an oddly written
 * position they can still search by hand.
 */
export function detectCoordinates(text: string): GeoCoordinate[] {
  return findCoordinates(text).filter((c) => c.confidence >= 0.75);
}

/** Renders a position as signed decimal degrees. */
export function formatDecimal(c: Pick<GeoCoordinate, "lat" | "lon">, places = 5): string {
  return `${c.lat.toFixed(places)}, ${c.lon.toFixed(places)}`;
}

/** Renders a position as degrees/minutes/seconds with hemisphere letters. */
export function formatDMS(c: Pick<GeoCoordinate, "lat" | "lon">): string {
  const part = (value: number, axis: "lat" | "lon") => {
    const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    return `${deg}°${String(min).padStart(2, "0")}'${sec.toFixed(1).padStart(4, "0")}"${hemi}`;
  };
  return `${part(c.lat, "lat")} ${part(c.lon, "lon")}`;
}
