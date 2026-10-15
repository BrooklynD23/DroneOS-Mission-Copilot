import { describe, expect, it } from "vitest";
import type { Finding, Report } from "../schema/report";
import { chipLabel, counts, orderFindings } from "./report-view";

const ev = {
  frame_id: "000041",
  t_s: 42,
  lat: 47.3989,
  lon: 8.54559,
  alt_m: 35,
};
const obs = (id: string): Finding => ({
  poi_id: id,
  label: id,
  status: "observed",
  evidence: [ev],
  caption: "c",
});
const abs = (id: string): Finding => ({
  poi_id: id,
  label: id,
  status: "abstained",
  evidence: [],
  caption: "",
  abstain_reason: "no frame",
});
const report = (findings: Finding[]): Report => ({
  scenario_id: "s",
  mission_id: "m",
  generated_by: "template",
  findings,
});

describe("report-view", () => {
  it("orders observed first, stable", () => {
    const r = report([abs("a"), obs("b"), abs("c"), obs("d")]);
    expect(orderFindings(r).map((f) => f.poi_id)).toEqual(["b", "d", "a", "c"]);
    expect(r.findings[0]?.poi_id).toBe("a");
  });
  it("formats chip label", () => {
    expect(chipLabel(ev)).toBe("000041 · 42 s · 47.39890, 8.54559 · 35 m");
  });
  it("rounds time and altitude", () => {
    expect(chipLabel({ ...ev, t_s: 41.6, alt_m: 34.5 })).toContain("42 s · 47");
    expect(chipLabel({ ...ev, alt_m: 34.4 })).toMatch(/34 m$/);
  });
  it("counts", () => {
    expect(counts(report([obs("a"), abs("b"), abs("c")]))).toEqual({
      observed: 1,
      abstained: 2,
    });
  });
});
