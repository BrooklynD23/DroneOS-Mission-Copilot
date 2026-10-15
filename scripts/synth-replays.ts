import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import northRoofFx from "@/lib/llm/fixtures/north-roof.json";
import solarEastFx from "@/lib/llm/fixtures/solar-east.json";
import { Fixture } from "@/lib/llm/replay";
import { synthReplay } from "@/lib/replay/synth";
import { buildReport } from "@/lib/report/report";
import { getScenario } from "@/lib/scenarios";
import { ReplayManifest, TelemetrySample } from "@/lib/schema/replay";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CREATED = "2026-10-14T00:00:00.000Z";
const FIXTURES: Record<string, unknown> = {
  "north-roof": northRoofFx,
  "solar-east": solarEastFx,
};

const writeJson = (path: string, v: unknown): void =>
  writeFileSync(path, `${JSON.stringify(v, null, 2)}\n`);

function scenarioOrDie(id: string) {
  const s = getScenario(id);
  if (!s) {
    console.error(`unknown scenario: ${id}`);
    process.exit(1);
  }
  return s;
}

function readManifest(dir: string): ReplayManifest | undefined {
  const p = join(dir, "manifest.json");
  return existsSync(p)
    ? ReplayManifest.parse(JSON.parse(readFileSync(p, "utf8")))
    : undefined;
}

function rebuildReport(dir: string, id: string): void {
  const scenario = scenarioOrDie(id);
  const samples = readFileSync(join(dir, "telemetry.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => TelemetrySample.parse(JSON.parse(l)));
  const mission = JSON.parse(readFileSync(join(dir, "mission.json"), "utf8"));
  writeJson(
    join(dir, "report.json"),
    buildReport(scenario, mission.mission_id, samples),
  );
  console.log(`report rebuilt: ${dir}`);
}

function synth(id: string, force: boolean): void {
  const scenario = scenarioOrDie(id);
  const fx = Fixture.array().parse(FIXTURES[id])[0];
  if (!fx) throw new Error(`no fixture for ${id}`);
  const mission = fx.repairs[fx.repairs.length - 1] ?? fx.plan;
  const dir = join(ROOT, "public", "replays", id);
  if (readManifest(dir)?.source === "recorded-sitl" && !force) {
    console.error(
      `refusing to overwrite recorded-sitl replay ${id} (use --force)`,
    );
    process.exit(1);
  }
  const r = synthReplay({ scenario, mission, created: CREATED });
  rmSync(join(dir, "frames"), { recursive: true, force: true });
  mkdirSync(join(dir, "frames"), { recursive: true });
  writeJson(join(dir, "manifest.json"), r.manifest);
  writeJson(join(dir, "mission.json"), r.mission);
  writeFileSync(
    join(dir, "telemetry.jsonl"),
    `${r.telemetry.map((s) => JSON.stringify(s)).join("\n")}\n`,
  );
  writeJson(
    join(dir, "report.json"),
    buildReport(scenario, mission.mission_id, r.telemetry),
  );
  for (const f of r.frames)
    writeFileSync(join(dir, "frames", `${f.id}.svg`), f.svg);
  console.log(
    `${id}: ${r.frames.length} frames, ${r.telemetry.length} samples`,
  );
}

const args = process.argv.slice(2);
const ri = args.indexOf("--report");
if (ri >= 0) {
  const [d, id] = [args[ri + 1], args[ri + 2]];
  if (!d || !id) {
    console.error(
      "usage: synth-replays.ts --report <replay_dir> <scenario_id>",
    );
    process.exit(1);
  }
  rebuildReport(resolve(d), id);
} else {
  const force = args.includes("--force");
  for (const id of Object.keys(FIXTURES)) synth(id, force);
}
