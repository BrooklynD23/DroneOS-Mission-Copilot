import { z } from "zod";
import { Ring } from "./geo";
import { Mission } from "./mission";
import { Finding, Report } from "./report";
import { ValidationResult } from "./validation";

const scenarioId = z.string();
const requestText = z.string().min(3).max(500);
const accessCode = z.string().max(64).optional();

export const PlanRequest = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("plan"),
      scenario_id: scenarioId,
      request: requestText,
      area: Ring.optional(),
      access_code: accessCode,
    })
    .strict(),
  z
    .object({
      op: z.literal("repair"),
      scenario_id: scenarioId,
      request: requestText,
      mission: Mission,
      round: z.union([z.literal(1), z.literal(2)]),
      access_code: accessCode,
    })
    .strict(),
  z
    .object({
      op: z.literal("report"),
      scenario_id: scenarioId,
      mission: Mission,
      evidence: z.array(Finding).max(20),
      access_code: accessCode,
    })
    .strict(),
]);
export type PlanRequest = z.infer<typeof PlanRequest>;

export const PlanResponse = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      mode: z.enum(["live", "replay"]),
      model: z.string().optional(),
      mission: Mission.optional(),
      validation: ValidationResult.optional(),
      report: Report.optional(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum([
            "bad_request",
            "too_large",
            "unauthorized",
            "rate_limited",
            "replay_miss",
            "upstream",
          ]),
          message: z.string(),
        })
        .strict(),
    })
    .strict(),
]);
export type PlanResponse = z.infer<typeof PlanResponse>;

// GET /api/plan; true when both env vars are set; never reveals secrets.
export const Health = z
  .object({
    live_available: z.boolean(),
  })
  .strict();
export type Health = z.infer<typeof Health>;
