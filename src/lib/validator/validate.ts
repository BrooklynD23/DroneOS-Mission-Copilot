import booleanIntersects from "@turf/boolean-intersects";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import booleanWithin from "@turf/boolean-within";
import { lineString, point, polygon } from "@turf/helpers";
import length from "@turf/length";
import type { LatLon, Ring } from "../schema/geo";
import type { Mission } from "../schema/mission";
import type { Scenario } from "../schema/scenario";
import {
  type ValidationResult,
  type Violation,
  ViolationCode,
} from "../schema/validation";

/** Climb/descent rate for the battery model (m/s); calibration knob. */
export const CLIMB_RATE_MPS = 2.5;

const xy = (p: LatLon): [number, number] => [p.lon, p.lat];
const toPolygon = (r: Ring) =>
  polygon([[...r.map(xy), xy(r[0] ?? { lat: 0, lon: 0 })]]);
const round = (n: number) => Math.round(n * 10) / 10;

export function validate(
  mission: Mission,
  scenario: Scenario,
): ValidationResult {
  const c = scenario.constraints;
  const wps = mission.waypoints;
  const fence = toPolygon(c.geofence);
  const zones = c.no_fly.map((z) => ({ id: z.id, poly: toPolygon(z.ring) }));
  const found: Violation[] = [];
  const add = (v: Violation) => found.push(v);

  const home = { id: "home", ...scenario.home };
  const stops = [home, ...wps, home];
  const legs = stops.slice(1).map((to, i) => {
    const from = stops[i] ?? home;
    return {
      i,
      from,
      to,
      name: `${from.id}->${to.id}`,
      line: lineString([xy(from), xy(to)]),
    };
  });
  const inside = (p: LatLon, poly: typeof fence) =>
    booleanPointInPolygon(point(xy(p)), poly);

  // geofence: waypoints, then legs whose ends are both inside (concave corners)
  for (const w of wps)
    if (!inside(w, fence))
      add({
        code: "geofence",
        waypoint_id: w.id,
        detail: `${w.id} is outside the geofence`,
      });
  for (const l of legs)
    if (
      inside(l.from, fence) &&
      inside(l.to, fence) &&
      !booleanWithin(l.line, fence)
    )
      add({
        code: "geofence",
        leg: l.i,
        detail: `leg ${l.i} (${l.name}) leaves the geofence`,
      });

  for (const w of wps) {
    if (w.alt_m > c.ceiling_m)
      add({
        code: "ceiling",
        waypoint_id: w.id,
        measured: w.alt_m,
        limit: c.ceiling_m,
        detail: `${w.id} is ${round(w.alt_m - c.ceiling_m)} m above the ${c.ceiling_m} m ceiling`,
      });
  }
  for (const w of wps) {
    if (w.alt_m < c.min_alt_m)
      add({
        code: "min_alt",
        waypoint_id: w.id,
        measured: w.alt_m,
        limit: c.min_alt_m,
        detail: `${w.id} is ${round(c.min_alt_m - w.alt_m)} m below the ${c.min_alt_m} m minimum altitude`,
      });
  }

  // no_fly: waypoint inside a zone, or a leg crossing it with both ends outside
  for (const z of zones) {
    for (const w of wps)
      if (inside(w, z.poly))
        add({
          code: "no_fly",
          waypoint_id: w.id,
          zone_id: z.id,
          detail: `${w.id} is inside no-fly zone ${z.id}`,
        });
    for (const l of legs)
      if (
        !inside(l.from, z.poly) &&
        !inside(l.to, z.poly) &&
        booleanIntersects(l.line, z.poly)
      )
        add({
          code: "no_fly",
          leg: l.i,
          zone_id: z.id,
          detail: `leg ${l.i} (${l.name}) crosses no-fly zone ${z.id}`,
        });
  }

  const legM = legs.map((l) => length(l.line, { units: "kilometers" }) * 1000);
  const routeM = legM.reduce((a, b) => a + b, 0);
  const maxAlt = Math.max(...wps.map((w) => w.alt_m));
  const holdS = wps.reduce((a, w) => a + w.hold_s, 0);
  const flightS =
    routeM / mission.speed_mps + (2 * maxAlt) / CLIMB_RATE_MPS + holdS;
  const energyWh = (flightS / 3600) * c.cruise_power_w;
  const reserveLeft = 100 * (1 - energyWh / c.battery_wh);
  if (reserveLeft < c.reserve_pct)
    add({
      code: "battery",
      measured: round(reserveLeft),
      limit: c.reserve_pct,
      detail: `reserve ${round(reserveLeft)}% is below the ${c.reserve_pct}% minimum`,
    });

  if (wps.length > c.max_waypoints)
    add({
      code: "max_waypoints",
      measured: wps.length,
      limit: c.max_waypoints,
      detail: `${wps.length} waypoints exceed the limit of ${c.max_waypoints}`,
    });
  legM.forEach((m, i) => {
    const l = legs[i];
    if (l && m > c.max_leg_m)
      add({
        code: "max_leg",
        leg: i,
        measured: round(m),
        limit: c.max_leg_m,
        detail: `leg ${i} (${l.name}) is ${round(m - c.max_leg_m)} m over the ${c.max_leg_m} m limit`,
      });
  });

  const rank = (v: Violation) => ViolationCode.options.indexOf(v.code);
  const violations = found
    .map((v, k) => [v, k] as const)
    .sort(([a, ka], [b, kb]) => rank(a) - rank(b) || ka - kb)
    .map(([v]) => v);

  return {
    ok: violations.length === 0,
    violations,
    stats: {
      route_m: routeM,
      flight_s: flightS,
      energy_wh: energyWh,
      reserve_left_pct: reserveLeft,
    },
  };
}
