import type { Mission } from "../schema/mission";
import type { Scenario } from "../schema/scenario";
import type { Violation } from "../schema/validation";
import { validate } from "../validator/validate";

const without = (m: Mission, i: number): Mission => ({
  ...m,
  waypoints: m.waypoints.filter((_, k) => k !== i),
});

/**
 * Deterministic repair. Never adds waypoints.
 * ponytail: drop-not-reroute; add detour planning when dropping loses coverage.
 */
export function autoFix(
  mission: Mission,
  scenario: Scenario,
): { mission: Mission; unresolved: Violation[] } {
  const c = scenario.constraints;
  let m: Mission = {
    ...mission,
    waypoints: mission.waypoints.map((w) => ({
      ...w,
      alt_m: Math.min(c.ceiling_m, Math.max(c.min_alt_m, w.alt_m)),
    })),
  };
  // each pass removes at most one waypoint, so length+1 passes always suffice
  for (let pass = 0; pass <= mission.waypoints.length; pass++) {
    if (m.waypoints.length === 0) {
      return {
        mission: m,
        unresolved: [
          {
            code: "max_waypoints",
            measured: 0,
            limit: c.max_waypoints,
            detail: "no waypoints left after repair",
          },
        ],
      };
    }
    const { violations } = validate(m, scenario);
    const v = violations.find((x) =>
      ["geofence", "no_fly", "max_waypoints", "battery"].includes(x.code),
    );
    if (!v) break;
    const last = m.waypoints.length - 1;
    if (v.code === "max_waypoints")
      m = { ...m, waypoints: m.waypoints.slice(0, c.max_waypoints) };
    else if (v.code === "battery") m = without(m, last);
    else if (v.waypoint_id !== undefined)
      m = without(
        m,
        m.waypoints.findIndex((w) => w.id === v.waypoint_id),
      );
    // leg i ends at wp[i]; the return leg (i = n) ends at home, so drop the last wp
    else m = without(m, Math.min(v.leg ?? last, last));
  }
  return { mission: m, unresolved: validate(m, scenario).violations };
}
