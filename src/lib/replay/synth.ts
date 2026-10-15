import type { Mission } from "../schema/mission";
import type { ReplayManifest, TelemetrySample } from "../schema/replay";
import type { Scenario } from "../schema/scenario";

// ponytail: flat-earth projection around home, fine for <2 km sites; use a
// real geodesic (turf distance / pyproj) if sites grow. Shared with the
// WAVE-02 fixture formula: dlat = m/111_320, dlon = m/(111_320*cos(lat0)).
const M_PER_DEG = 111_320;
const CLIMB_MPS = 2.5; // takeoff/landing climb rate (named calibration knob)
const SAMPLE_HZ = 2;
const FRAME_EVERY_S = 1;
const EPS = 1e-9;

export type SynthFrame = { id: string; svg: string };

export type SynthReplayResult = {
  manifest: ReplayManifest;
  mission: Mission;
  telemetry: TelemetrySample[];
  frames: SynthFrame[];
};

type Vec = { lat: number; lon: number; alt: number };
type Seg = { mode: string; from: Vec; to: Vec; t0: number; dur: number };

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const frameId = (n: number): string => String(n).padStart(6, "0");

export function synthReplay({
  scenario,
  mission,
  created,
}: {
  scenario: Scenario;
  mission: Mission;
  created: string;
}): SynthReplayResult {
  const cosLat = Math.cos((scenario.home.lat * Math.PI) / 180);
  const horizontalM = (a: Vec, b: Vec): number =>
    Math.hypot(
      (a.lat - b.lat) * M_PER_DEG,
      (a.lon - b.lon) * M_PER_DEG * cosLat,
    );
  const dist3dM = (a: Vec, b: Vec): number =>
    Math.hypot(horizontalM(a, b), a.alt - b.alt);

  // Phase timeline: TAKEOFF at home → MISSION legs + holds → RTL → LAND.
  const home: Vec = { lat: scenario.home.lat, lon: scenario.home.lon, alt: 0 };
  const segs: Seg[] = [];
  let t = 0;
  const push = (mode: string, from: Vec, to: Vec, dur: number): void => {
    if (dur <= EPS) return;
    segs.push({ mode, from, to, t0: t, dur });
    t += dur;
  };

  const first = mission.waypoints[0];
  if (!first) throw new Error("mission requires at least one waypoint");
  push("TAKEOFF", home, { ...home, alt: first.alt_m }, first.alt_m / CLIMB_MPS);

  let prev: Vec = { ...home, alt: first.alt_m };
  for (const wp of mission.waypoints) {
    const target: Vec = { lat: wp.lat, lon: wp.lon, alt: wp.alt_m };
    push("MISSION", prev, target, dist3dM(prev, target) / mission.speed_mps);
    push("MISSION", target, target, wp.hold_s);
    prev = target;
  }

  const homeAtAlt: Vec = { ...home, alt: prev.alt };
  push("RTL", prev, homeAtAlt, horizontalM(prev, home) / mission.speed_mps);
  push("LAND", homeAtAlt, home, prev.alt / CLIMB_MPS);
  const durationS = t;

  const at = (time: number): { pos: Vec; mode: string } => {
    for (const s of segs) {
      if (time < s.t0 + s.dur) {
        const f = Math.min(1, Math.max(0, (time - s.t0) / s.dur));
        return {
          pos: {
            lat: s.from.lat + (s.to.lat - s.from.lat) * f,
            lon: s.from.lon + (s.to.lon - s.from.lon) * f,
            alt: s.from.alt + (s.to.alt - s.from.alt) * f,
          },
          mode: s.mode,
        };
      }
    }
    const last = segs[segs.length - 1];
    return { pos: last ? last.to : home, mode: last ? last.mode : "LAND" };
  };

  const { battery_wh, cruise_power_w } = scenario.constraints;
  const batteryPct = (tS: number): number =>
    Math.min(
      100,
      Math.max(0, 100 * (1 - (cruise_power_w * tS) / 3600 / battery_wh)),
    );

  // 2 Hz sample times plus segment boundaries (exact waypoint arrivals)
  // and the exact endpoint.
  const times: number[] = [];
  for (let k = 0; k / SAMPLE_HZ < durationS - EPS; k++)
    times.push(k / SAMPLE_HZ);
  for (const s of segs) times.push(s.t0 + s.dur);
  times.push(durationS);
  times.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const v of times) {
    const lastT = deduped[deduped.length - 1];
    if (lastT === undefined || v - lastT > EPS) deduped.push(v);
  }

  const baseMs = Date.parse(created);
  const telemetry: TelemetrySample[] = [];
  const frames: SynthFrame[] = [];

  for (const tS of deduped) {
    const { pos, mode } = at(tS);
    // Frames attach to whole-second grid samples only (exact binary halves).
    const isFrame = Number.isInteger(tS / FRAME_EVERY_S);
    const id = isFrame ? frameId(frames.length) : undefined;
    telemetry.push({
      t_s: tS,
      ts: new Date(baseMs + Math.round(tS * 1000)).toISOString(),
      lat: pos.lat,
      lon: pos.lon,
      alt_m: pos.alt,
      battery_pct: batteryPct(tS),
      mode,
      ...(id !== undefined ? { frame_id: id } : {}),
    });
    if (id !== undefined) frames.push({ id, svg: frameSvg(id, tS, pos) });
  }

  function frameSvg(id: string, tS: number, pos: Vec): string {
    const lines = [
      "SYNTHETIC",
      `frame ${id}`,
      `t=${tS.toFixed(1)}s`,
      `lat ${pos.lat.toFixed(5)} lon ${pos.lon.toFixed(5)}`,
      `alt ${pos.alt.toFixed(1)}m`,
    ];
    for (const poi of scenario.pois) {
      if (horizontalM(pos, { ...poi, alt: pos.alt }) <= poi.radius_m) {
        lines.push(`poi: ${poi.label}`);
      }
    }
    const text = lines
      .map(
        (line, i) =>
          `<text x="12" y="${28 + i * 20}" fill="#7ee787" font-family="monospace" font-size="14">${escapeXml(line)}</text>`,
      )
      .join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#101418"/>${text}</svg>`;
  }

  const manifest: ReplayManifest = {
    scenario_id: scenario.id,
    source: "synthetic",
    created,
    frame_ext: "svg",
    frame_count: frames.length,
    duration_s: durationS,
  };

  return { manifest, mission, telemetry, frames };
}
