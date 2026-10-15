import type { Mission, Waypoint } from "../schema/mission";
import type { Scenario } from "../schema/scenario";
import type { RepairDiff } from "../schema/validation";
import { validate } from "../validator/validate";

type Change = RepairDiff["changes"][number];

/** Changes matched by waypoint id; order: before's waypoints, then added. */
export function diffMissions(before: Mission, after: Mission): Change[] {
  const next = new Map(after.waypoints.map((w) => [w.id, w]));
  const prev = new Map(before.waypoints.map((w) => [w.id, w]));
  const changes: Change[] = [];
  for (const b of before.waypoints) {
    const a = next.get(b.id);
    if (!a) changes.push({ kind: "removed", waypoint_id: b.id, before: b });
    else if (a.lat !== b.lat || a.lon !== b.lon)
      changes.push({ kind: "moved", waypoint_id: b.id, before: b, after: a });
    else if (a.alt_m !== b.alt_m)
      changes.push({
        kind: "altitude",
        waypoint_id: b.id,
        before: b,
        after: a,
      });
  }
  for (const a of after.waypoints as Waypoint[])
    if (!prev.has(a.id))
      changes.push({ kind: "added", waypoint_id: a.id, after: a });
  return changes;
}

export function buildRepairDiff(
  source: RepairDiff["source"],
  round: RepairDiff["round"],
  before: Mission,
  after: Mission,
  scenario: Scenario,
): RepairDiff {
  return {
    source,
    round,
    changes: diffMissions(before, after),
    before: validate(before, scenario),
    after: validate(after, scenario),
  };
}
