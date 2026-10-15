import { z } from "zod";

export const LatLon = z
  .object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  })
  .strict();
export type LatLon = z.infer<typeof LatLon>;

// Implicit closure; first point must not equal the last.
export const Ring = z.array(LatLon).min(3).max(100);
export type Ring = z.infer<typeof Ring>;
