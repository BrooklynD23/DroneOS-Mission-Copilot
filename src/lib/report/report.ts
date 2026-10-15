import distance from "@turf/distance";
import type { TelemetrySample } from "../schema/replay";
import type { Evidence, Finding, Report } from "../schema/report";
import type { Scenario } from "../schema/scenario";

const MAX_EVIDENCE = 3;
const MAX_CAPTION = 200;

function toEvidence(s: TelemetrySample & { frame_id: string }): Evidence {
  return {
    frame_id: s.frame_id,
    t_s: s.t_s,
    lat: s.lat,
    lon: s.lon,
    alt_m: s.alt_m,
  };
}

export function buildFindings(
  scenario: Scenario,
  samples: readonly TelemetrySample[],
): Finding[] {
  const framed = samples.filter(
    (s): s is TelemetrySample & { frame_id: string } =>
      s.frame_id !== undefined,
  );
  return scenario.pois.map((poi): Finding => {
    const near = framed
      .map((s) => ({
        s,
        d: distance([poi.lon, poi.lat], [s.lon, s.lat], { units: "meters" }),
      }))
      .filter(({ d }) => d <= poi.radius_m)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_EVIDENCE)
      .map(({ s }) => toEvidence(s));
    if (near.length === 0) {
      return {
        poi_id: poi.id,
        label: poi.label,
        status: "abstained",
        evidence: [],
        caption: "",
        abstain_reason: `no frame within ${poi.radius_m} m`,
      };
    }
    const ids = near.map((e) => e.frame_id).join(", ");
    return {
      poi_id: poi.id,
      label: poi.label,
      status: "observed",
      evidence: near,
      caption: `${poi.label} seen in frames ${ids} at ${Math.round(near[0]?.alt_m ?? 0)} m`,
    };
  });
}

export function buildReport(
  scenario: Scenario,
  missionId: string,
  samples: readonly TelemetrySample[],
  generatedBy: Report["generated_by"] = "template",
): Report {
  return {
    scenario_id: scenario.id,
    mission_id: missionId,
    generated_by: generatedBy,
    findings: buildFindings(scenario, samples),
  };
}

/** captions keyed by poi_id; invalid ones fall back to the template caption. */
export function applyCaptions(
  findings: readonly Finding[],
  captions: Readonly<Record<string, string>>,
): Finding[] {
  return findings.map((f) => {
    const c = Object.hasOwn(captions, f.poi_id)
      ? captions[f.poi_id]
      : undefined;
    if (f.status !== "observed" || typeof c !== "string") return f;
    if (c.length === 0 || c.length > MAX_CAPTION) return f;
    const ids = new Set(f.evidence.map((e) => e.frame_id));
    const cited = c.match(/\d{6}/g) ?? [];
    return cited.every((id) => ids.has(id)) ? { ...f, caption: c } : f;
  });
}
