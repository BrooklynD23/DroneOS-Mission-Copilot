import { describe, expect, it } from "vitest";
import { getScenario } from "../scenarios";
import type { TelemetrySample } from "../schema/replay";
import { Report } from "../schema/report";
import { applyCaptions, buildFindings, buildReport } from "./report";

const found = getScenario("north-roof");
const foundPoi = found?.pois[0];
if (!found || !foundPoi) throw new Error("fixture missing");
const scenario = found;
const poi = foundPoi;
const M = 111_320;
const dlon = (m: number) => m / (M * Math.cos((poi.lat * Math.PI) / 180));

const s = (
  t_s: number,
  offsetM: number,
  frame_id?: string,
  alt_m = 35,
): TelemetrySample => ({
  t_s,
  ts: "2026-01-01T00:00:00.000Z",
  lat: poi.lat,
  lon: poi.lon + dlon(offsetM),
  alt_m,
  battery_pct: 90,
  mode: "MISSION",
  ...(frame_id ? { frame_id } : {}),
});

const track = [
  s(0, 500, "000001"),
  s(1, 10, "000041"),
  s(2, 5, "000042"),
  s(3, 8, "000043"),
  s(4, 2, "000044"),
  s(5, 1), // no frame
];

describe("buildFindings", () => {
  it("observed: nearest 3 frames sorted by distance", () => {
    const f = buildFindings(scenario, track).find((x) => x.poi_id === poi.id);
    expect(f?.status).toBe("observed");
    expect(f?.evidence.map((e) => e.frame_id)).toEqual([
      "000044",
      "000042",
      "000043",
    ]);
    expect(f?.caption).toBe(
      `${poi.label} seen in frames 000044, 000042, 000043 at 35 m`,
    );
  });

  it("abstains when no frame within radius", () => {
    const f = buildFindings(scenario, track.slice(0, 1)).find(
      (x) => x.poi_id === poi.id,
    );
    expect(f?.status).toBe("abstained");
    expect(f?.evidence).toEqual([]);
    expect(f?.caption).toBe("");
    expect(f?.abstain_reason).toBe(`no frame within ${poi.radius_m} m`);
  });
});

describe("buildReport", () => {
  it("parses as Report", () => {
    const r = buildReport(scenario, "m1", track);
    expect(Report.safeParse(r).success).toBe(true);
    expect(r.generated_by).toBe("template");
    expect(r.mission_id).toBe("m1");
  });
});

describe("applyCaptions", () => {
  const base = () => buildFindings(scenario, track);
  const pick = (fs: ReturnType<typeof base>) =>
    fs.find((x) => x.poi_id === poi.id);

  it("accepts a valid caption", () => {
    const c = `Roof damage in 000044.`;
    expect(pick(applyCaptions(base(), { [poi.id]: c }))?.caption).toBe(c);
  });

  it("rejects unknown frame id", () => {
    const f = pick(applyCaptions(base(), { [poi.id]: "Seen in 000099" }));
    expect(f?.caption).toContain("seen in frames");
  });

  it("rejects over-long caption", () => {
    const f = pick(applyCaptions(base(), { [poi.id]: "x".repeat(201) }));
    expect(f?.caption).toContain("seen in frames");
  });

  it("never captions abstained", () => {
    const fs = buildFindings(scenario, track.slice(0, 1));
    const out = applyCaptions(fs, { [poi.id]: "hello" });
    expect(pick(out)?.caption).toBe("");
  });
});
