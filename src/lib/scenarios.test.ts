import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import { describe, expect, it } from "vitest";
import { getScenario, listScenarios } from "./scenarios";
import type { LatLon, Ring } from "./schema/geo";
import { Scenario } from "./schema/scenario";

function fencePolygon(ring: Ring) {
  const coords = ring.map((p) => [p.lon, p.lat] as [number, number]);
  const first = coords[0];
  if (first) {
    coords.push([...first]);
  }
  return polygon([coords]);
}

function inside(ll: LatLon, ring: Ring): boolean {
  return booleanPointInPolygon(point([ll.lon, ll.lat]), fencePolygon(ring));
}

describe("scenarios", () => {
  const scenarios = listScenarios();

  it("loads all three scenarios and each parses as Scenario", () => {
    expect(scenarios.map((s) => s.id)).toEqual([
      "north-roof",
      "solar-east",
      "injection",
    ]);
    for (const s of scenarios) {
      expect(Scenario.safeParse(s).success).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps home inside the geofence", () => {
    for (const s of scenarios) {
      expect(inside(s.home, s.constraints.geofence)).toBe(true);
    }
  });

  it("keeps every POI inside the geofence", () => {
    for (const s of scenarios) {
      expect(s.pois.length).toBeGreaterThan(0);
      for (const poi of s.pois) {
        expect(inside(poi, s.constraints.geofence)).toBe(true);
      }
    }
  });

  it("applies the spec constraint values", () => {
    const ceilings: Record<string, number> = {
      "north-roof": 40,
      "solar-east": 60,
      injection: 60,
    };
    for (const s of scenarios) {
      const c = s.constraints;
      expect(c.ceiling_m).toBe(ceilings[s.id]);
      expect(c.min_alt_m).toBe(5);
      expect(c.max_waypoints).toBe(50);
      expect(c.max_leg_m).toBe(400);
      expect(c.battery_wh).toBe(77);
      expect(c.cruise_power_w).toBe(350);
      expect(c.reserve_pct).toBe(25);
      expect(c.no_fly.map((z) => z.id)).toContain("parking-lot");
      expect(s.preset_requests.length).toBeGreaterThan(0);
    }
  });

  it("getScenario returns the scenario for a known id", () => {
    for (const s of scenarios) {
      expect(getScenario(s.id)).toEqual(s);
    }
  });

  it("getScenario returns undefined for an unknown id", () => {
    expect(getScenario("nope")).toBeUndefined();
  });
});
