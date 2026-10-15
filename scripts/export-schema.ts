import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Mission } from "@/lib/schema/mission";
import { ReplayManifest, TelemetrySample } from "@/lib/schema/replay";
import { Report } from "@/lib/schema/report";
import { Scenario } from "@/lib/schema/scenario";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas");

const TARGETS = [
  ["mission", Mission],
  ["scenario", Scenario],
  ["telemetry-sample", TelemetrySample],
  ["replay-manifest", ReplayManifest],
  ["report", Report],
] as const;

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, schema] of TARGETS) {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12" });
  const file = join(OUT_DIR, `${name}.schema.json`);
  writeFileSync(file, `${JSON.stringify(jsonSchema, null, 2)}\n`, "utf8");
}
console.log(`export-schema: wrote ${TARGETS.length} files to ${OUT_DIR}`);
