import { Mission } from "../schema/mission";
import { type Frame, ReplayManifest, TelemetrySample } from "../schema/replay";
import { Report } from "../schema/report";
import type { SynthReplayResult } from "./synth";

export type Replay = {
  manifest: ReplayManifest;
  mission: Mission;
  samples: TelemetrySample[];
  frames: Frame[];
  report: Report;
};

type FetchFn = (url: string) => Promise<Response>;

const ID = /^[a-z0-9][a-z0-9-]*$/;

const deriveFrames = (
  samples: readonly TelemetrySample[],
  url: (id: string) => string,
): Frame[] =>
  samples.flatMap((s) =>
    s.frame_id === undefined
      ? []
      : [
          {
            id: s.frame_id,
            t_s: s.t_s,
            lat: s.lat,
            lon: s.lon,
            alt_m: s.alt_m,
            url: url(s.frame_id),
          },
        ],
  );

function parseJsonl(text: string): TelemetrySample[] {
  return text
    .split("\n")
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter((l) => l.raw !== "")
    .map(({ raw, line }) => {
      try {
        return TelemetrySample.parse(JSON.parse(raw));
      } catch (e) {
        throw new Error(
          `telemetry.jsonl line ${line}: invalid (${(e as Error).name})`,
          { cause: e },
        );
      }
    });
}

export async function loadReplay(
  scenarioId: string,
  fetchFn: FetchFn = (u) => fetch(u),
): Promise<Replay | null> {
  if (!ID.test(scenarioId)) throw new Error("invalid scenario id");
  const base = `/replays/${scenarioId}`;
  const get = async (name: string): Promise<string> => {
    const res = await fetchFn(`${base}/${name}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return res.text();
  };
  const first = await fetchFn(`${base}/manifest.json`);
  if (first.status === 404) return null;
  if (!first.ok) throw new Error(`manifest.json: HTTP ${first.status}`);
  const manifest = ReplayManifest.parse(JSON.parse(await first.text()));
  const [mission, telemetry, report] = await Promise.all([
    get("mission.json"),
    get("telemetry.jsonl"),
    get("report.json"),
  ]);
  const samples = parseJsonl(telemetry);
  return {
    manifest,
    mission: Mission.parse(JSON.parse(mission)),
    samples,
    frames: deriveFrames(
      samples,
      (id) => `${base}/frames/${id}.${manifest.frame_ext}`,
    ),
    report: Report.parse(JSON.parse(report)),
  };
}

export function replayFromSynth(
  out: SynthReplayResult,
  report: Report,
): Replay {
  const svgs = new Map(out.frames.map((f) => [f.id, f.svg]));
  return {
    manifest: out.manifest,
    mission: out.mission,
    samples: out.telemetry,
    frames: deriveFrames(
      out.telemetry,
      (id) =>
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgs.get(id) ?? "")}`,
    ),
    report,
  };
}
