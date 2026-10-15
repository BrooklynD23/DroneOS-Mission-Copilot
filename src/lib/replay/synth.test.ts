import { describe, expect, it } from "vitest";
import type { Mission } from "../schema/mission";
import { ReplayManifest, TelemetrySample } from "../schema/replay";
import type { Scenario } from "../schema/scenario";
import { synthReplay } from "./synth";

const HOME = { lat: 47.397742, lon: 8.545594 };
const M_PER_DEG_LAT = 111_320;

// Same helper as WAVE-02 fixtures: metres east/north of home → lat/lon.
const offset = (eastM: number, northM: number) => ({
  lat: HOME.lat + northM / M_PER_DEG_LAT,
  lon:
    HOME.lon + eastM / (M_PER_DEG_LAT * Math.cos((HOME.lat * Math.PI) / 180)),
});

const fence = [
  offset(-150, -100),
  offset(150, -100),
  offset(150, 150),
  offset(-150, 150),
];

const scenario: Scenario = {
  id: "test-site",
  title: "Test site",
  home: HOME,
  area: fence,
  constraints: {
    geofence: fence,
    no_fly: [],
    ceiling_m: 60,
    min_alt_m: 5,
    max_waypoints: 50,
    max_leg_m: 400,
    battery_wh: 77,
    cruise_power_w: 350,
    reserve_pct: 25,
  },
  pois: [
    {
      id: "poi-a",
      label: 'Roof hatch <script>alert("x")</script> & more',
      ...offset(0, 60),
      radius_m: 20,
    },
    {
      id: "poi-far",
      label: "Far away",
      ...offset(900, 900),
      radius_m: 10,
    },
  ],
  preset_requests: [],
};

const mission: Mission = {
  mission_id: "m-test",
  speed_mps: 5,
  waypoints: [
    { id: "wp1", ...offset(0, 60), alt_m: 20, action: "photo", hold_s: 4 },
    { id: "wp2", ...offset(80, 60), alt_m: 30, action: "hover", hold_s: 0 },
    { id: "wp3", ...offset(80, 120), alt_m: 30, action: "none", hold_s: 2 },
  ],
  notes: [],
};

const CREATED = "2026-01-02T03:04:05.000Z";
const run = () => synthReplay({ scenario, mission, created: CREATED });

describe("synthReplay", () => {
  it("produces identical output for identical input", () => {
    const a = run();
    const b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toEqual(b);
  });

  it("returns a manifest that parses as ReplayManifest", () => {
    const { manifest, frames } = run();
    expect(ReplayManifest.safeParse(manifest).success).toBe(true);
    expect(manifest.scenario_id).toBe("test-site");
    expect(manifest.source).toBe("synthetic");
    expect(manifest.frame_ext).toBe("svg");
    expect(manifest.frame_count).toBe(frames.length);
    expect(manifest.created).toBe(CREATED);
    expect(manifest.duration_s).toBeGreaterThan(0);
  });

  it("echoes the input mission", () => {
    expect(run().mission).toEqual(mission);
  });

  it("every telemetry sample parses as TelemetrySample", () => {
    const { telemetry } = run();
    expect(telemetry.length).toBeGreaterThan(10);
    for (const sample of telemetry) {
      const parsed = TelemetrySample.safeParse(sample);
      expect(parsed.success).toBe(true);
    }
  });

  it("has strictly increasing t_s and ts = created + t_s", () => {
    const { telemetry } = run();
    const base = Date.parse(CREATED);
    for (let i = 0; i < telemetry.length; i++) {
      const s = telemetry[i];
      const prev = telemetry[i - 1];
      if (!s || (i > 0 && !prev)) throw new Error("empty telemetry");
      if (prev) expect(s.t_s).toBeGreaterThan(prev.t_s);
      expect(Date.parse(s.ts)).toBeCloseTo(base + s.t_s * 1000, 0);
    }
  });

  it("has non-increasing battery matching the linear drain model", () => {
    const { telemetry } = run();
    const first = telemetry[0];
    const last = telemetry.at(-1);
    if (!first || !last) throw new Error("empty telemetry");
    expect(first.battery_pct).toBe(100);
    for (let i = 1; i < telemetry.length; i++) {
      const cur = telemetry[i];
      const prev = telemetry[i - 1];
      if (!cur || !prev) throw new Error("empty telemetry");
      expect(cur.battery_pct).toBeLessThanOrEqual(prev.battery_pct);
    }
    const expected = 100 * (1 - (350 * last.t_s) / 3600 / 77);
    expect(last.battery_pct).toBeCloseTo(expected, 9);
  });

  it("starts and ends at home on the ground", () => {
    const { telemetry } = run();
    const first = telemetry[0];
    const last = telemetry.at(-1);
    if (!first || !last) throw new Error("empty telemetry");
    expect(first.lat).toBeCloseTo(HOME.lat, 9);
    expect(first.lon).toBeCloseTo(HOME.lon, 9);
    expect(first.alt_m).toBeCloseTo(0, 9);
    expect(first.mode).toBe("TAKEOFF");
    expect(last.lat).toBeCloseTo(HOME.lat, 9);
    expect(last.lon).toBeCloseTo(HOME.lon, 9);
    expect(last.alt_m).toBeCloseTo(0, 9);
    expect(last.mode).toBe("LAND");
  });

  it("visits each waypoint position during MISSION", () => {
    const { telemetry } = run();
    for (const wp of mission.waypoints) {
      const hit = telemetry.some(
        (s) =>
          s.mode === "MISSION" &&
          Math.abs(s.lat - wp.lat) < 1e-9 &&
          Math.abs(s.lon - wp.lon) < 1e-9 &&
          Math.abs(s.alt_m - wp.alt_m) < 1e-9,
      );
      expect(hit).toBe(true);
    }
  });

  it("uses all four flight modes", () => {
    const modes = new Set(run().telemetry.map((s) => s.mode));
    for (const m of ["TAKEOFF", "MISSION", "RTL", "LAND"]) {
      expect(modes.has(m)).toBe(true);
    }
  });

  it("emits contiguous zero-padded frame ids once per second", () => {
    const { frames, telemetry } = run();
    expect(frames.length).toBeGreaterThan(10);
    frames.forEach((f, i) => {
      expect(f.id).toBe(String(i).padStart(6, "0"));
    });
    const withFrames = telemetry.filter((s) => s.frame_id !== undefined);
    expect(withFrames.map((s) => s.frame_id)).toEqual(frames.map((f) => f.id));
    // 1 Hz: frame times are whole seconds.
    for (const s of withFrames) expect(Number.isInteger(s.t_s)).toBe(true);
  });

  it("renders 320x240 SVG with labels and escapes POI text", () => {
    const { frames } = run();
    let sawPoiLabel = false;
    for (const f of frames) {
      expect(f.svg).toContain("<svg");
      expect(f.svg).toContain('width="320"');
      expect(f.svg).toContain('height="240"');
      expect(f.svg).toContain("SYNTHETIC");
      expect(f.svg).toContain(f.id);
      expect(f.svg).not.toContain("<script>");
      expect(f.svg).not.toContain("</script>");
      if (f.svg.includes("poi:")) {
        sawPoiLabel = true;
        expect(f.svg).toContain("&lt;script&gt;");
        expect(f.svg).toContain("&amp;");
      }
    }
    expect(sawPoiLabel).toBe(true);
  });

  it("does not label POIs outside their radius", () => {
    const { frames } = run();
    for (const f of frames) expect(f.svg).not.toContain("Far away");
  });
});
