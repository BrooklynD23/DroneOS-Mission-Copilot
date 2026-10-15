import { describe, expect, it } from "vitest";
import { ValidationResult } from "../schema/validation";
import { invalidCases, validCases } from "./cases";
import { validate } from "./validate";

describe("fixtures", () => {
  it("has 50 valid and 50 invalid cases", () => {
    expect(validCases).toHaveLength(50);
    expect(invalidCases).toHaveLength(50);
  });

  it("has >=5 invalid cases per code", () => {
    const codes = [
      "geofence",
      "ceiling",
      "min_alt",
      "no_fly",
      "battery",
      "max_waypoints",
      "max_leg",
    ];
    for (const c of codes) {
      expect(
        invalidCases.filter((k) => k.codes.includes(c as never)).length,
      ).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("validate: valid cases", () => {
  it.each(validCases.map((c) => [c.name, c] as const))("%s is ok", (_n, c) => {
    const r = validate(c.mission, c.scenario);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe("validate: invalid cases", () => {
  it.each(invalidCases.map((c) => [c.name, c] as const))(
    "%s has exact codes",
    (_n, c) => {
      const r = validate(c.mission, c.scenario);
      expect(r.ok).toBe(false);
      expect([...new Set(r.violations.map((v) => v.code))].sort()).toEqual(
        [...c.codes].sort(),
      );
    },
  );
});

describe("validate: stats and ordering", () => {
  it("stats are finite and parse as ValidationResult", () => {
    for (const c of [...validCases, ...invalidCases]) {
      const r = validate(c.mission, c.scenario);
      expect(ValidationResult.safeParse(r).success).toBe(true);
      for (const v of Object.values(r.stats))
        expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("is deterministic and non-mutating", () => {
    const c = invalidCases.find((k) => k.codes.length > 1) ?? invalidCases[0];
    if (!c) throw new Error("no case");
    const before = JSON.stringify(c);
    const a = validate(c.mission, c.scenario);
    expect(validate(c.mission, c.scenario)).toEqual(a);
    expect(JSON.stringify(c)).toBe(before);
  });

  it("orders violations by code order then index", () => {
    const order = [
      "geofence",
      "ceiling",
      "min_alt",
      "no_fly",
      "battery",
      "max_waypoints",
      "max_leg",
    ];
    for (const c of invalidCases) {
      const codes = validate(c.mission, c.scenario).violations.map((v) =>
        order.indexOf(v.code),
      );
      expect(codes).toEqual([...codes].sort((x, y) => x - y));
    }
  });

  it("snapshots stats of one case", () => {
    const c = validCases[0];
    if (!c) throw new Error("no case");
    const { stats } = validate(c.mission, c.scenario);
    expect({
      route_m: Math.round(stats.route_m),
      flight_s: Math.round(stats.flight_s),
      reserve: Math.round(stats.reserve_left_pct),
    }).toMatchSnapshot();
  });

  it("detail text names the waypoint", () => {
    const c = invalidCases.find((k) => k.codes.includes("ceiling"));
    if (!c) throw new Error("no ceiling case");
    const v = validate(c.mission, c.scenario).violations.find(
      (x) => x.code === "ceiling",
    );
    expect(v?.waypoint_id).toMatch(/^wp\d+$/);
    expect(v?.detail).toContain(v?.waypoint_id);
  });
});
