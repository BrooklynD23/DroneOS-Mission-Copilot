import { describe, expect, it } from "vitest";
import type { ValidationResult } from "../schema/validation";
import { summary, toBadges } from "./badges";

const stats = {
  route_m: 100,
  flight_s: 60,
  energy_wh: 5,
  reserve_left_pct: 41,
};
const okResult: ValidationResult = { ok: true, violations: [], stats };
const CODES = [
  "GEOFENCE",
  "CEILING",
  "MIN ALT",
  "NO-FLY",
  "BATTERY",
  "WAYPOINTS",
  "LEG LENGTH",
];

describe("toBadges", () => {
  it("all ok: 7 passing badges in fixed order", () => {
    const b = toBadges(okResult);
    expect(b.map((x) => x.label)).toEqual(CODES);
    expect(b.every((x) => x.ok && x.text.startsWith("✓ "))).toBe(true);
    expect(b[4]?.text).toBe("✓ BATTERY — 41% reserve left");
  });

  it.each([
    ["geofence", "GEOFENCE"],
    ["ceiling", "CEILING"],
    ["min_alt", "MIN ALT"],
    ["no_fly", "NO-FLY"],
    ["battery", "BATTERY"],
    ["max_waypoints", "WAYPOINTS"],
    ["max_leg", "LEG LENGTH"],
  ] as const)("%s violation fails only its badge", (code, label) => {
    const v = {
      ok: false,
      violations: [{ code, detail: "wp7 18 m outside" }],
      stats,
    };
    const b = toBadges(v);
    const bad = b.filter((x) => !x.ok);
    expect(bad).toHaveLength(1);
    expect(bad[0]?.code).toBe(code);
    expect(bad[0]?.text).toBe(`✗ ${label} — wp7 18 m outside`);
  });

  it("collapses several violations of one code into one badge with a count", () => {
    const v = {
      ok: false,
      violations: [
        { code: "geofence" as const, detail: "wp1 5 m outside" },
        { code: "geofence" as const, detail: "wp2 9 m outside" },
      ],
      stats,
    };
    const b = toBadges(v);
    expect(b).toHaveLength(7);
    expect(b[0]?.text).toBe("✗ GEOFENCE ×2 — wp1 5 m outside");
  });
});

describe("summary", () => {
  it("ok", () => expect(summary(okResult)).toBe("✓ All 7 checks pass"));
  it("counts failing checks and violations", () => {
    const v = {
      ok: false,
      violations: [
        { code: "geofence" as const, detail: "a" },
        { code: "geofence" as const, detail: "b" },
        { code: "battery" as const, detail: "c" },
      ],
      stats,
    };
    expect(summary(v)).toBe("✗ 3 violations in 2 of 7 checks");
  });
});
