import { describe, expect, it } from "vitest";
import type { Ring } from "../schema/geo";
import { boundsOf, fromLeafletRing, toLatLngs } from "./geo";

const ring: Ring = [
  { lat: 1, lon: 2 },
  { lat: 3, lon: 4 },
  { lat: 5, lon: 1 },
];

describe("geo", () => {
  it("round trips", () => {
    expect(fromLeafletRing(toLatLngs(ring))).toEqual(ring);
  });
  it("converts to [lat, lon] tuples", () => {
    expect(toLatLngs(ring)[1]).toEqual([3, 4]);
  });
  it("drops closing duplicate", () => {
    expect(fromLeafletRing([...toLatLngs(ring), [1, 2]])).toEqual(ring);
  });
  it("accepts leaflet {lat,lng} objects", () => {
    const pts = ring.map((p) => ({ lat: p.lat, lng: p.lon }));
    expect(fromLeafletRing(pts)).toEqual(ring);
  });
  it("rejects <3 vertices, including after closure drop", () => {
    expect(
      fromLeafletRing([
        [1, 2],
        [3, 4],
      ]),
    ).toBeNull();
    expect(
      fromLeafletRing([
        [1, 2],
        [3, 4],
        [1, 2],
      ]),
    ).toBeNull();
  });
  it("accepts 100 and rejects 101 vertices", () => {
    const mk = (n: number): [number, number][] =>
      Array.from({ length: n }, (_, i) => [i / 1000, (i * i) / 10000]);
    expect(fromLeafletRing(mk(100))).toHaveLength(100);
    expect(fromLeafletRing(mk(101))).toBeNull();
  });
  it("rejects non-finite or out-of-range coordinates", () => {
    expect(
      fromLeafletRing([
        [1, 2],
        [3, 4],
        [Number.NaN, 0],
      ]),
    ).toBeNull();
    expect(
      fromLeafletRing([
        [1, 2],
        [3, 4],
        [95, 0],
      ]),
    ).toBeNull();
  });
  it("computes bounds across rings", () => {
    expect(boundsOf([ring, [{ lat: -1, lon: 9 }]])).toEqual([
      [-1, 1],
      [5, 9],
    ]);
  });
  it("bounds of nothing is null", () => {
    expect(boundsOf([])).toBeNull();
  });
});
