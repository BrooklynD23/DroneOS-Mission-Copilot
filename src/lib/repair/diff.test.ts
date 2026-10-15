import { describe, expect, it } from "vitest";
import { getScenario } from "../scenarios";
import type { Mission } from "../schema/mission";
import { buildRepairDiff, diffMissions } from "./diff";

const wp = (id: string, lat = 47.3985, lon = 8.545, alt_m = 35) => ({
  id,
  lat,
  lon,
  alt_m,
  action: "none" as const,
  hold_s: 0,
});
const m = (waypoints: Mission["waypoints"]): Mission => ({
  mission_id: "m",
  speed_mps: 5,
  waypoints,
  notes: [],
});

describe("diffMissions", () => {
  it("unchanged -> empty", () => {
    expect(diffMissions(m([wp("wp1")]), m([wp("wp1")]))).toEqual([]);
  });
  it("altitude", () => {
    const c = diffMissions(m([wp("wp1")]), m([wp("wp1", 47.3985, 8.545, 40)]));
    expect(c.map((x) => x.kind)).toEqual(["altitude"]);
  });
  it("moved (wins over altitude)", () => {
    const c = diffMissions(m([wp("wp1")]), m([wp("wp1", 47.3986, 8.545, 40)]));
    expect(c.map((x) => x.kind)).toEqual(["moved"]);
  });
  it("removed and added", () => {
    const c = diffMissions(
      m([wp("wp1"), wp("wp2")]),
      m([wp("wp1"), wp("wp3")]),
    );
    expect(c.map((x) => [x.kind, x.waypoint_id])).toEqual([
      ["removed", "wp2"],
      ["added", "wp3"],
    ]);
  });
});

describe("buildRepairDiff", () => {
  it("includes before/after validation", () => {
    const s = getScenario("injection");
    if (!s) throw new Error("missing");
    const d = buildRepairDiff(
      "deterministic",
      2,
      m([wp("wp1", 47.3985, 8.545, 120)]),
      m([wp("wp1", 47.3985, 8.545, 60)]),
      s,
    );
    expect(d.source).toBe("deterministic");
    expect(d.before.ok).toBe(false);
    expect(d.after.ok).toBe(true);
    expect(d.changes).toHaveLength(1);
  });
});
