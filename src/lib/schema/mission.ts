import { z } from "zod";

// LLM output; no home, no constraints — those come from the scenario.
export const Waypoint = z
  .object({
    id: z.string().regex(/^wp\d{1,3}$/),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    alt_m: z.number(),
    action: z.enum(["photo", "hover", "none"]),
    hold_s: z.number().min(0).max(60),
  })
  .strict();
export type Waypoint = z.infer<typeof Waypoint>;

export const Mission = z
  .object({
    mission_id: z.string().max(64),
    speed_mps: z.number().min(1).max(15),
    waypoints: z.array(Waypoint).min(1).max(50),
    notes: z.array(z.string().max(200)).max(10),
  })
  .strict();
export type Mission = z.infer<typeof Mission>;
