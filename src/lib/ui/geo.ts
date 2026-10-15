import { type LatLon, Ring } from "../schema/geo";

export type LatLngTuple = [number, number];
type LeafletPoint = LatLngTuple | { lat: number; lng: number };

export const toLatLngs = (ring: readonly LatLon[]): LatLngTuple[] =>
  ring.map((p) => [p.lat, p.lon]);

/** Leaflet polygon ring -> schema Ring; null if invalid (<3 or >100 vertices, bad coords). */
export function fromLeafletRing(latlngs: readonly LeafletPoint[]): Ring | null {
  const pts = latlngs.map((p) =>
    Array.isArray(p) ? { lat: p[0], lon: p[1] } : { lat: p.lat, lon: p.lng },
  );
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (
    pts.length > 1 &&
    first &&
    last &&
    first.lat === last.lat &&
    first.lon === last.lon
  ) {
    pts.pop();
  }
  const parsed = Ring.safeParse(pts);
  return parsed.success ? parsed.data : null;
}

export function boundsOf(
  rings: readonly (readonly LatLon[])[],
): [LatLngTuple, LatLngTuple] | null {
  const pts = rings.flat();
  if (pts.length === 0) return null;
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
}
