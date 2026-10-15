import { z } from "zod";
import { Waypoint } from "./mission";

export const ViolationCode = z.enum([
  "geofence",
  "ceiling",
  "min_alt",
  "no_fly",
  "battery",
  "max_waypoints",
  "max_leg",
]);
export type ViolationCode = z.infer<typeof ViolationCode>;

// leg i = wp[i-1] -> wp[i]; leg 0 = home -> wp[0]
export const Violation = z
  .object({
    code: ViolationCode,
    waypoint_id: z.string().optional(),
    leg: z.number().int().optional(),
    zone_id: z.string().optional(),
    measured: z.number().optional(),
    limit: z.number().optional(),
    detail: z.string(),
  })
  .strict();
export type Violation = z.infer<typeof Violation>;

export const ValidationResult = z
  .object({
    ok: z.boolean(),
    violations: z.array(Violation),
    stats: z
      .object({
        route_m: z.number(),
        flight_s: z.number(),
        energy_wh: z.number(),
        reserve_left_pct: z.number(),
      })
      .strict(),
  })
  .strict();
export type ValidationResult = z.infer<typeof ValidationResult>;

export const RepairDiff = z
  .object({
    source: z.enum(["llm", "deterministic"]),
    round: z.number().int().min(0).max(2),
    changes: z.array(
      z
        .object({
          kind: z.enum(["moved", "removed", "added", "altitude"]),
          waypoint_id: z.string(),
          before: Waypoint.optional(),
          after: Waypoint.optional(),
        })
        .strict(),
    ),
    before: ValidationResult,
    after: ValidationResult,
  })
  .strict();
export type RepairDiff = z.infer<typeof RepairDiff>;
