import { describe, expect, it } from "vitest";
import { getScenario } from "../scenarios";
import { Mission } from "../schema/mission";
import { validate } from "../validator/validate";
import injection from "./fixtures/injection.json";
import northRoof from "./fixtures/north-roof.json";
import solarEast from "./fixtures/solar-east.json";
import { replayKey } from "./key";

const sets = { "north-roof": northRoof, "solar-east": solarEast, injection };
const R = 6371000;
const dist = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) => {
  const dy = ((b.lat - a.lat) * Math.PI * R) / 180;
  const dx =
    ((b.lon - a.lon) * Math.PI * R * Math.cos((a.lat * Math.PI) / 180)) / 180;
  return Math.hypot(dx, dy);
};

function codes(id: string, m: unknown): string[] {
  const s = getScenario(id);
  if (!s) throw new Error(id);
  return [
    ...new Set(validate(Mission.parse(m), s).violations.map((v) => v.code)),
  ].sort();
}
const visits = (id: string, m: Mission, poi: string) => {
  const p = getScenario(id)?.pois.find((x) => x.id === poi);
  if (!p) throw new Error(poi);
  return m.waypoints.some((w) => dist(w, p) <= p.radius_m);
};

describe("fixtures", () => {
  for (const [id, list] of Object.entries(sets)) {
    it(`${id}: parse, keys, presets`, () => {
      const s = getScenario(id);
      expect(list.map((f) => f.request)).toEqual(s?.preset_requests);
      for (const f of list) {
        expect(f.key).toBe(replayKey(id, f.request));
        Mission.parse(f.plan);
        for (const r of f.repairs) Mission.parse(r);
      }
    });
  }
  it("north-roof verdicts", () => {
    const f = northRoof[0];
    expect(f?.plan.waypoints).toHaveLength(8);
    expect(f?.plan.waypoints.every((w) => w.alt_m === 35)).toBe(true);
    expect(codes("north-roof", f?.plan)).toEqual(["geofence"]);
    expect(codes("north-roof", f?.repairs[0])).toEqual([]);
  });
  it("solar-east verdicts", () => {
    expect(codes("solar-east", solarEast[0]?.plan)).toEqual([]);
  });
  it("injection verdicts", () => {
    const f = injection[0];
    expect(codes("injection", f?.plan)).toEqual(["ceiling", "no_fly"]);
    expect(codes("injection", f?.repairs[0])).toEqual(["ceiling"]);
    expect(codes("injection", f?.repairs[1])).toEqual([]);
  });
  it("POI visits", () => {
    for (const m of [northRoof[0]?.plan, northRoof[0]?.repairs[0]]) {
      const mm = Mission.parse(m);
      expect(visits("north-roof", mm, "roof-hatch-n")).toBe(true);
      expect(visits("north-roof", mm, "solar-array")).toBe(true);
      expect(visits("north-roof", mm, "hvac-3")).toBe(false);
    }
    expect(
      visits("solar-east", Mission.parse(solarEast[0]?.plan), "solar-east"),
    ).toBe(true);
    expect(
      visits(
        "injection",
        Mission.parse(injection[0]?.repairs[1]),
        "roof-hatch-n",
      ),
    ).toBe(true);
  });
});
