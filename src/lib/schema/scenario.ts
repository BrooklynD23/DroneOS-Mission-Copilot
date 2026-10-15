import { z } from "zod";
import { LatLon, Ring } from "./geo";

export const NoFlyZone = z
  .object({
    id: z.string(),
    name: z.string(),
    ring: Ring,
  })
  .strict();
export type NoFlyZone = z.infer<typeof NoFlyZone>;

export const Constraints = z
  .object({
    geofence: Ring,
    no_fly: z.array(NoFlyZone).max(10),
    ceiling_m: z.number().positive(),
    min_alt_m: z.number().nonnegative(),
    max_waypoints: z.number().int().positive(),
    max_leg_m: z.number().positive(),
    battery_wh: z.number().positive(),
    cruise_power_w: z.number().positive(),
    reserve_pct: z.number().min(0).max(90),
  })
  .strict();
export type Constraints = z.infer<typeof Constraints>;

export const Poi = z
  .object({
    id: z.string(),
    label: z.string(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    radius_m: z.number().positive(),
  })
  .strict();
export type Poi = z.infer<typeof Poi>;

export const Scenario = z
  .object({
    id: z.string(),
    title: z.string(),
    home: LatLon,
    area: Ring,
    constraints: Constraints,
    pois: z.array(Poi),
    preset_requests: z.array(z.string().max(500)),
  })
  .strict();
export type Scenario = z.infer<typeof Scenario>;
