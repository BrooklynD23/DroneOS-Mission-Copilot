import { describe, expect, it } from "vitest";
import type { Mission } from "../schema/mission";
import type { Frame, TelemetrySample } from "../schema/replay";
import { advance, frameAt, pickSource, sampleAt, timeOfFrame } from "./player";

const s = (
  t_s: number,
  lat: number,
  lon: number,
  alt_m: number,
  b: number,
): TelemetrySample => ({
  t_s,
  ts: "2026-10-14T00:00:00.000Z",
  lat,
  lon,
  alt_m,
  battery_pct: b,
  mode: "MISSION",
});
const samples = [
  s(0, 10, 20, 0, 100),
  s(2, 12, 24, 10, 90),
  s(4, 14, 28, 20, 80),
];
const fr = (id: string, t_s: number): Frame => ({
  id,
  t_s,
  lat: 0,
  lon: 0,
  alt_m: 0,
  url: `/${id}`,
});
const frames = [fr("000001", 1), fr("000002", 3)];

describe("sampleAt", () => {
  it("interpolates midpoint", () => {
    expect(sampleAt(samples, 1)).toEqual({
      lat: 11,
      lon: 22,
      alt_m: 5,
      battery_pct: 95,
    });
    expect(sampleAt(samples, 3)).toEqual({
      lat: 13,
      lon: 26,
      alt_m: 15,
      battery_pct: 85,
    });
  });
  it("clamps ends and handles empty", () => {
    expect(sampleAt(samples, -5)?.lat).toBe(10);
    expect(sampleAt(samples, 99)?.lat).toBe(14);
    expect(sampleAt(samples, 2)?.lat).toBe(12);
    expect(sampleAt([], 1)).toBeUndefined();
  });
});

describe("frames", () => {
  it("frameAt is last frame <= t", () => {
    expect(frameAt(frames, 0.5)).toBeUndefined();
    expect(frameAt(frames, 1)?.id).toBe("000001");
    expect(frameAt(frames, 2.9)?.id).toBe("000001");
    expect(frameAt(frames, 100)?.id).toBe("000002");
  });
  it("timeOfFrame", () => {
    expect(timeOfFrame(frames, "000002")).toBe(3);
    expect(timeOfFrame(frames, "nope")).toBeUndefined();
  });
});

describe("advance", () => {
  it("moves by dt*speed and clamps", () => {
    expect(advance(1, 500, 2, 10)).toBe(2);
    expect(advance(9.5, 1000, 4, 10)).toBe(10);
    expect(advance(0, -1000, 1, 10)).toBe(0);
  });
});

describe("pickSource", () => {
  const m = {
    id: "m",
    waypoints: [{ id: "a", lat: 1, lon: 2 }],
  } as unknown as Mission;
  it("equal vs changed waypoint", () => {
    expect(pickSource(m, structuredClone(m))).toBe("recorded");
    const c = structuredClone(m) as unknown as { waypoints: { lat: number }[] };
    c.waypoints = [{ lat: 1.1 }, ...c.waypoints.slice(1)];
    expect(pickSource(m, c as unknown as Mission)).toBe("synthesize");
    expect(pickSource(m, null)).toBe("synthesize");
  });
});
