import { describe, expect, it } from "vitest";
import { getScenario } from "../scenarios";
import type { Mission } from "../schema/mission";
import { validate } from "../validator/validate";
import { autoFix } from "./autofix";

const s = (() => {
  const x = getScenario("injection");
  if (!x) throw new Error("injection scenario missing");
  return x;
})();
const wp = (id: string, lat: number, lon: number, alt_m: number) => ({
  id,
  lat,
  lon,
  alt_m,
  action: "none" as const,
  hold_s: 0,
});
const mission = (waypoints: Mission["waypoints"]): Mission => ({
  mission_id: "m",
  speed_mps: 5,
  waypoints,
  notes: [],
});

describe("autoFix", () => {
  it("clamps altitude into [min, ceiling]", () => {
    const m = mission([
      wp("wp1", 47.3985, 8.545, 120),
      wp("wp2", 47.3985, 8.547, 1),
    ]);
    const r = autoFix(m, s);
    expect(r.mission.waypoints.map((w) => w.alt_m)).toEqual([60, 5]);
    expect(r.unresolved).toEqual([]);
  });

  it("drops a waypoint inside a no-fly zone", () => {
    const m = mission([
      wp("wp1", 47.3985, 8.545, 35),
      wp("wp2", 47.3972, 8.547, 35),
      wp("wp3", 47.3985, 8.547, 35),
    ]);
    const r = autoFix(m, s);
    expect(r.mission.waypoints.map((w) => w.id)).toEqual(["wp1", "wp3"]);
    expect(validate(r.mission, s).ok).toBe(true);
  });

  it("drops the end waypoint of a leg crossing a no-fly zone", () => {
    const m = mission([
      wp("wp1", 47.3972, 8.5455, 35),
      wp("wp2", 47.3972, 8.5475, 35),
    ]);
    expect(validate(m, s).violations.some((v) => v.leg !== undefined)).toBe(
      true,
    );
    const r = autoFix(m, s);
    expect(r.mission.waypoints.map((w) => w.id)).toEqual(["wp1"]);
    expect(r.unresolved).toEqual([]);
  });

  it("drops a waypoint outside the fence", () => {
    const m = mission([
      wp("wp1", 47.3985, 8.545, 35),
      wp("wp2", 47.41, 8.545, 35),
    ]);
    expect(autoFix(m, s).mission.waypoints.map((w) => w.id)).toEqual(["wp1"]);
  });

  it("passes a valid mission through unchanged", () => {
    const m = mission([
      wp("wp1", 47.3985, 8.545, 35),
      wp("wp2", 47.3985, 8.547, 35),
    ]);
    const r = autoFix(m, s);
    expect(r.mission).toEqual(m);
    expect(r.unresolved).toEqual([]);
  });

  it("reports unresolved when nothing is left", () => {
    const r = autoFix(mission([wp("wp1", 47.3972, 8.547, 35)]), s);
    expect(r.mission.waypoints).toEqual([]);
    expect(r.unresolved).toHaveLength(1);
  });

  it("truncates to max_waypoints", () => {
    const tight = {
      ...s,
      constraints: { ...s.constraints, max_waypoints: 2 },
    };
    const m = mission([
      wp("wp1", 47.3985, 8.545, 35),
      wp("wp2", 47.3985, 8.546, 35),
      wp("wp3", 47.3985, 8.547, 35),
    ]);
    expect(autoFix(m, tight).mission.waypoints).toHaveLength(2);
  });

  it("drops trailing waypoints until battery reserve holds", () => {
    const weak = { ...s, constraints: { ...s.constraints, battery_wh: 10 } };
    const m = mission([
      wp("wp1", 47.3985, 8.545, 35),
      wp("wp2", 47.3985, 8.547, 35),
      wp("wp3", 47.3985, 8.5475, 35),
    ]);
    const r = autoFix(m, weak);
    expect(r.mission.waypoints.length).toBeLessThan(3);
    expect(r.mission.waypoints[0]?.id).toBe("wp1");
  });

  it("never adds waypoints and is idempotent", () => {
    const m = mission([
      wp("wp1", 47.3985, 8.545, 120),
      wp("wp2", 47.3972, 8.547, 120),
      wp("wp3", 47.3985, 8.547, 120),
    ]);
    const once = autoFix(m, s);
    expect(once.mission.waypoints.length).toBeLessThanOrEqual(3);
    expect(validate(once.mission, s).ok).toBe(true);
    expect(autoFix(once.mission, s)).toEqual(once);
  });
});
