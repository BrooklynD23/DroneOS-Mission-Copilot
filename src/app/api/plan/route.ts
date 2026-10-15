import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { getServerConfig, isLive } from "@/lib/env";
import {
  clientIp,
  errorResponse,
  HttpError,
  MAX_BODY_BYTES,
  RATE_LIMIT,
  RATE_WINDOW_MS,
  readJsonBody,
} from "@/lib/http/guard";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { CAPTION_MODEL, PLAN_MODEL } from "@/lib/llm/anthropic";
import { selectProvider } from "@/lib/llm/select";
import { ReplayMissError, UpstreamError } from "@/lib/llm/types";
import { applyCaptions, buildFindings } from "@/lib/report/report";
import { getScenario } from "@/lib/scenarios";
import { PlanRequest, type PlanResponse } from "@/lib/schema/api";
import { Mission } from "@/lib/schema/mission";
import { TelemetrySample } from "@/lib/schema/replay";
import type { Finding } from "@/lib/schema/report";
import type { Scenario } from "@/lib/schema/scenario";
import { validate } from "@/lib/validator/validate";

export const maxDuration = 60;

const limiter = createRateLimiter({
  limit: RATE_LIMIT,
  windowMs: RATE_WINDOW_MS,
});

export async function GET(): Promise<Response> {
  return Response.json({ live_available: getServerConfig().liveConfigured });
}

// Findings from the committed replay when the mission matches it; any miss -> null.
async function committedFindings(
  scenario: Scenario,
  mission: Mission,
): Promise<Finding[] | null> {
  try {
    const dir = path.join(process.cwd(), "public", "replays", scenario.id);
    const committed = Mission.parse(
      JSON.parse(await readFile(path.join(dir, "mission.json"), "utf8")),
    );
    if (!isDeepStrictEqual(committed, mission)) return null;
    const lines = (await readFile(path.join(dir, "telemetry.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
    return buildFindings(
      scenario,
      lines.map((l) => TelemetrySample.parse(JSON.parse(l))),
    );
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  let op = "unknown";
  try {
    const rl = limiter.check(clientIp(req));
    if (!rl.ok) {
      return errorResponse("rate_limited", "Too many requests", 429, {
        "Retry-After": String(rl.retryAfterS),
      });
    }
    const parsed = PlanRequest.safeParse(
      await readJsonBody(req, MAX_BODY_BYTES),
    );
    if (!parsed.success) {
      const fields = [
        ...new Set(
          parsed.error.issues.map((i) => i.path.join(".") || "(body)"),
        ),
      ];
      return errorResponse(
        "bad_request",
        `Invalid request: ${fields.join(", ")}`,
        400,
      );
    }
    const body = parsed.data;
    op = body.op;
    const scenario = getScenario(body.scenario_id);
    if (!scenario) return errorResponse("bad_request", "Unknown scenario", 400);

    const config = getServerConfig();
    const live = isLive(config, body.access_code);
    if (body.access_code && !live) {
      return errorResponse("unauthorized", "Invalid access code", 401);
    }
    const provider = selectProvider({ live, apiKey: config.apiKey });
    const mode = live ? "live" : "replay";

    if (body.op === "report") {
      const findings =
        (await committedFindings(scenario, body.mission)) ??
        // ponytail: client evidence trusted for captions only; no safety impact, captions still pass applyCaptions
        body.evidence;
      const captioned = await provider.caption({ scenario, findings });
      const captions = Object.fromEntries(
        captioned.map((f) => [f.poi_id, f.caption]),
      );
      return Response.json({
        ok: true,
        mode,
        report: {
          scenario_id: scenario.id,
          mission_id: body.mission.mission_id,
          generated_by: live ? CAPTION_MODEL : "template",
          findings: applyCaptions(findings, captions),
        },
      } satisfies PlanResponse);
    }

    let mission: Mission;
    if (body.op === "plan") {
      mission = await provider.plan({
        scenario,
        request: body.request,
        area: body.area,
      });
    } else {
      const current = validate(body.mission, scenario);
      if (current.ok) {
        return Response.json({
          ok: true,
          mode,
          model: live ? PLAN_MODEL : undefined,
          mission: body.mission,
          validation: current,
        } satisfies PlanResponse);
      }
      mission = await provider.repair({
        scenario,
        request: body.request,
        mission: body.mission,
        violations: current.violations,
        round: body.round,
      });
    }
    return Response.json({
      ok: true,
      mode,
      model: live ? PLAN_MODEL : undefined,
      mission,
      validation: validate(mission, scenario),
    } satisfies PlanResponse);
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown";
    if (err instanceof HttpError)
      return errorResponse(err.code, err.message, err.status);
    console.error({
      route: "plan",
      op,
      code: err instanceof ReplayMissError ? "replay_miss" : "error",
      cause: name,
    });
    if (err instanceof ReplayMissError)
      return errorResponse("replay_miss", err.message, 422);
    if (err instanceof UpstreamError)
      return errorResponse("upstream", "The planning service failed", 502);
    return errorResponse("upstream", "Internal error", 500);
  }
}
