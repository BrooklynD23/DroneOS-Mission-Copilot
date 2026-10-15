import type { ReplayManifest } from "../schema/replay";

export const formatTime = (t: number): string => `${Math.round(t)} s`;
export const formatAlt = (m: number): string => `${Math.round(m)} m`;
export const formatBattery = (pct: number): string => `${Math.round(pct)}%`;
export const formatLatLon = (lat: number, lon: number): string =>
  `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

export const frameAlt = (f: {
  id: string;
  t_s: number;
  alt_m: number;
}): string => `Frame ${f.id} at ${formatTime(f.t_s)}, ${formatAlt(f.alt_m)}`;

export const sourceLabel = (m: Pick<ReplayManifest, "source">): string =>
  m.source === "recorded-sitl"
    ? "RECORDED SITL · PX4 geofence enforced (GF_ACTION=2)"
    : "SYNTHETIC · validator-only, no autopilot";
