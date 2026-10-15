import type { Mission } from "../schema/mission";
import type { Frame, TelemetrySample } from "../schema/replay";

export type Speed = 1 | 2 | 4;
export type Position = Pick<
  TelemetrySample,
  "lat" | "lon" | "alt_m" | "battery_pct"
>;

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
};

export function pickSource(
  approved: Mission,
  recorded: Mission | null,
): "recorded" | "synthesize" {
  return recorded !== null && deepEqual(approved, recorded)
    ? "recorded"
    : "synthesize";
}

// Index of the last item with t_s <= t, or -1.
function lastAtOrBefore(items: readonly { t_s: number }[], t: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const m = items[mid];
    if (m !== undefined && m.t_s <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export function sampleAt(
  samples: readonly TelemetrySample[],
  t: number,
): Position | undefined {
  if (samples.length === 0) return undefined;
  const i = lastAtOrBefore(samples, t);
  const a = samples[Math.max(i, 0)];
  const b = samples[Math.min(i + 1, samples.length - 1)];
  if (a === undefined || b === undefined) return undefined;
  const span = b.t_s - a.t_s;
  const f = span > 0 ? Math.min(Math.max((t - a.t_s) / span, 0), 1) : 0;
  const mix = (x: number, y: number): number => x + (y - x) * f;
  return {
    lat: mix(a.lat, b.lat),
    lon: mix(a.lon, b.lon),
    alt_m: mix(a.alt_m, b.alt_m),
    battery_pct: mix(a.battery_pct, b.battery_pct),
  };
}

export function frameAt(
  frames: readonly Frame[],
  t: number,
): Frame | undefined {
  return frames[lastAtOrBefore(frames, t)];
}

export const timeOfFrame = (
  frames: readonly Frame[],
  id: string,
): number | undefined => frames.find((f) => f.id === id)?.t_s;

export const advance = (
  t: number,
  dtMs: number,
  speed: Speed,
  duration: number,
): number => Math.min(Math.max(t + (dtMs / 1000) * speed, 0), duration);
