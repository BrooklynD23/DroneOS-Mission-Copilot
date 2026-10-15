import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import northRootFx from "../llm/fixtures/north-roof.json";
import solarEastFx from "../llm/fixtures/solar-east.json";
import { Fixture } from "../llm/replay";
import { getScenario } from "../scenarios";
import { Mission } from "../schema/mission";
import { ReplayManifest, TelemetrySample } from "../schema/replay";
import { Report } from "../schema/report";
import { validate } from "../validator/validate";

const FIXTURES = { "north-roof": northRootFx, "solar-east": solarEastFx };
const dir = (id: string) => join(process.cwd(), "public", "replays", id);
const readJson = (id: string, f: string) =>
  JSON.parse(readFileSync(join(dir(id), f), "utf8"));

describe.each(Object.entries(FIXTURES))("replay %s", (id, raw) => {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`no scenario ${id}`);
  const fx = Fixture.array().parse(raw)[0];
  if (!fx) throw new Error("no fixture");
  const finalMission = fx.repairs[fx.repairs.length - 1] ?? fx.plan;

  const manifest = ReplayManifest.parse(readJson(id, "manifest.json"));
  const mission = Mission.parse(readJson(id, "mission.json"));
  const report = Report.parse(readJson(id, "report.json"));
  const lines = readFileSync(join(dir(id), "telemetry.jsonl"), "utf8")
    .trim()
    .split("\n");
  const samples = lines.map((l) => TelemetrySample.parse(JSON.parse(l)));

  it("is synthetic and counts match", () => {
    expect(manifest.scenario_id).toBe(id);
    expect(manifest.source).toBe("synthetic");
    expect(samples.filter((s) => s.frame_id).length).toBe(manifest.frame_count);
  });

  it("mission equals fixture final mission and validates", () => {
    expect(mission).toEqual(finalMission);
    expect(validate(mission, scenario).ok).toBe(true);
  });

  it("every evidence frame exists on disk", () => {
    for (const f of report.findings)
      for (const e of f.evidence)
        expect(
          existsSync(
            join(dir(id), "frames", `${e.frame_id}.${manifest.frame_ext}`),
          ),
        ).toBe(true);
  });

  if (id === "north-roof") {
    it("has observed and abstained findings", () => {
      expect(report.findings.some((f) => f.status === "observed")).toBe(true);
      expect(report.findings.some((f) => f.status === "abstained")).toBe(true);
    });
  }
});
