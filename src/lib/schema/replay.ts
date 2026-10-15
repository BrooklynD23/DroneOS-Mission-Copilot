import { z } from "zod";

// One JSON object per line in telemetry.jsonl.
export const TelemetrySample = z
  .object({
    t_s: z.number().nonnegative(),
    ts: z.iso.datetime(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    alt_m: z.number(),
    battery_pct: z.number().min(0).max(100),
    mode: z.string().max(32),
    frame_id: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .strict();
export type TelemetrySample = z.infer<typeof TelemetrySample>;

export const ReplayManifest = z
  .object({
    scenario_id: z.string(),
    source: z.enum(["recorded-sitl", "synthetic"]),
    created: z.iso.datetime(),
    frame_ext: z.enum(["jpg", "svg"]),
    frame_count: z.number().int(),
    duration_s: z.number(),
    px4_image: z.string().optional(),
    gf_action: z.number().int().optional(),
  })
  .strict();
export type ReplayManifest = z.infer<typeof ReplayManifest>;

// Derived from samples with frame_id; url = /replays/<id>/frames/<id>.<ext>
export const Frame = z
  .object({
    id: z.string(),
    t_s: z.number().nonnegative(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    alt_m: z.number(),
    url: z.string(),
  })
  .strict();
export type Frame = z.infer<typeof Frame>;
