import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Mission } from "./mission";
import { ReplayManifest, TelemetrySample } from "./replay";
import { Report } from "./report";
import { Scenario } from "./scenario";

const SCHEMAS_DIR = join(process.cwd(), "schemas");

const EXPORTED = {
  "mission.schema.json": Mission,
  "scenario.schema.json": Scenario,
  "telemetry-sample.schema.json": TelemetrySample,
  "replay-manifest.schema.json": ReplayManifest,
  "report.schema.json": Report,
} as const;

function freshExport(schema: z.ZodType): string {
  return `${JSON.stringify(
    z.toJSONSchema(schema, { target: "draft-2020-12" }),
    null,
    2,
  )}\n`;
}

describe("JSON Schema export", () => {
  it("Mission export is strict and requires waypoints", () => {
    const json = z.toJSONSchema(Mission, { target: "draft-2020-12" }) as {
      additionalProperties?: boolean;
      required?: string[];
      $schema?: string;
    };
    expect(json.additionalProperties).toBe(false);
    expect(json.required).toContain("waypoints");
    expect(json.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it("on-disk schemas/*.schema.json equal a fresh export (drift check)", () => {
    const onDisk = readdirSync(SCHEMAS_DIR)
      .filter((f) => f.endsWith(".schema.json"))
      .sort();
    expect(onDisk).toEqual(Object.keys(EXPORTED).sort());
    for (const [file, schema] of Object.entries(EXPORTED)) {
      const disk = readFileSync(join(SCHEMAS_DIR, file), "utf8");
      expect(disk).toBe(freshExport(schema));
      expect(disk.endsWith("}\n")).toBe(true);
    }
  });
});
