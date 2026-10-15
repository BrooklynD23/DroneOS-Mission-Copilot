import { z } from "zod";

export const Evidence = z
  .object({
    frame_id: z.string(),
    t_s: z.number().nonnegative(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    alt_m: z.number(),
  })
  .strict();
export type Evidence = z.infer<typeof Evidence>;

export const Finding = z
  .object({
    poi_id: z.string(),
    label: z.string(),
    status: z.enum(["observed", "abstained"]),
    evidence: z.array(Evidence).max(3),
    caption: z.string().max(200),
    abstain_reason: z.string().max(200).optional(),
  })
  .strict()
  .check((ctx) => {
    const finding = ctx.value;
    if (finding.status === "observed" && finding.evidence.length < 1) {
      ctx.issues.push({
        code: "custom",
        message: "observed findings require at least one evidence item",
        path: ["evidence"],
        input: finding,
      });
    }
    if (
      finding.status === "abstained" &&
      finding.abstain_reason === undefined
    ) {
      ctx.issues.push({
        code: "custom",
        message: "abstained findings require abstain_reason",
        path: ["abstain_reason"],
        input: finding,
      });
    }
  });
export type Finding = z.infer<typeof Finding>;

export const Report = z
  .object({
    scenario_id: z.string(),
    mission_id: z.string(),
    generated_by: z.enum(["template", "claude-haiku-5-5"]),
    findings: z.array(Finding),
  })
  .strict();
export type Report = z.infer<typeof Report>;
