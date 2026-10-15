import { describe, expect, it } from "vitest";
import {
  formatAlt,
  formatBattery,
  formatLatLon,
  formatTime,
  frameAlt,
  sourceLabel,
} from "./telemetry-format";

const base = {
  scenario_id: "x",
  created: "2026-01-01T00:00:00Z",
  frame_ext: "svg" as const,
  frame_count: 1,
  duration_s: 10,
};

describe("telemetry-format", () => {
  it("formats time, alt, battery", () => {
    expect(formatTime(42.4)).toBe("42 s");
    expect(formatAlt(35.4)).toBe("35 m");
    expect(formatBattery(41.6)).toBe("42%");
  });
  it("formats lat/lon to 5 dp", () => {
    expect(formatLatLon(47.3989, 8.54559)).toBe("47.39890, 8.54559");
  });
  it("builds frame alt text", () => {
    expect(frameAlt({ id: "000041", t_s: 42, alt_m: 35 })).toBe(
      "Frame 000041 at 42 s, 35 m",
    );
  });
  it("labels the source honestly", () => {
    expect(sourceLabel({ ...base, source: "recorded-sitl" })).toBe(
      "RECORDED SITL · PX4 geofence enforced (GF_ACTION=2)",
    );
    expect(sourceLabel({ ...base, source: "synthetic" })).toBe(
      "SYNTHETIC · validator-only, no autopilot",
    );
  });
});
